import { duration, flightKey, minutes, normalizeEvents, validDate, validateFlight } from "./domain.js";
import { airportAliases, icaoFor } from "./parsers.js";

export const WADER_CSV_MAX_BYTES = 10 * 1024 * 1024;
const maxRows = 10000;
const source = "Wader CSV";
const countFields = {
  dayTakeoffs: "takeoffDay", nightTakeoffs: "takeoffNight",
  dayLandings: "landingDay", nightLandings: "landingNight",
};
const requiredColumns = [
  "isPreviousExperience", "isSimulator", "flightDate", "flightNumber", "depAirport", "arrAirport",
  "startTime", "takeoffTime", "landingTime", "parkingTime", "totalTime", ...Object.keys(countFields),
];

function csvRows(input) {
  const rows = [];
  let fields = [], field = "", quoted = false, closed = false, line = 1, firstLine = 1;
  for (let i = input.charCodeAt(0) === 0xfeff ? 1 : 0; i <= input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char === undefined) throw Error("Thiếu dấu ngoặc kép đóng ở dòng " + firstLine + ".");
      if (char === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
        closed = true;
      } else {
        field += char;
        if (char === "\n" || (char === "\r" && input[i + 1] !== "\n")) line++;
      }
      continue;
    }
    if (char === '"' && !field && !closed) {
      quoted = true;
      continue;
    }
    if (char === "," || char === "\r" || char === "\n" || char === undefined) {
      fields.push(field);
      field = "";
      closed = false;
      if (char === ",") continue;
      if (fields.some(value => value.trim())) rows.push({ line: firstLine, fields });
      if (rows.length > maxRows * 2 + 1) throw Error("CSV có quá nhiều dòng. Hãy xuất theo khoảng ngày nhỏ hơn.");
      if (char === "\r" && input[i + 1] === "\n") i++;
      firstLine = ++line;
      fields = [];
    } else {
      if (closed) throw Error("Dữ liệu sau dấu ngoặc kép ở dòng " + line + " không hợp lệ.");
      field += char;
    }
  }
  return rows;
}

const flag = value => /^(?:true|false)$/i.test(value || "");

function* recordRows(rows, headers) {
  const width = headers.length;
  const hasWidth = fields => fields.length === width || (fields.length === width + 1 && fields[width] === "");
  const [experience, simulator] = ["isPreviousExperience", "isSimulator"].map(name => headers.indexOf(name));
  const startsRecord = fields => /^true$/i.test(fields[experience] || "") ||
    (flag(fields[experience]) && flag(fields[simulator]));
  for (let i = 0; i < rows.length; i++) {
    const { line, fields } = rows[i];
    if (hasWidth(fields)) {
      yield { line, fields };
      continue;
    }
    const next = rows[i + 1];
    const splitField = headers[fields.length - 1];
    // Wader can emit a newline inside an unquoted name or other free-text cell.
    if (next?.line === line + 1 && startsRecord(fields) && !startsRecord(next.fields) &&
        /^(?:pilotName[1-4]|remarks|depNotes|arrNotes|depThreats|arrThreats)$/.test(splitField)) {
      const combined = [...fields.slice(0, -1), fields.at(-1) + "\n" + next.fields[0], ...next.fields.slice(1)];
      if (hasWidth(combined)) {
        yield { line, fields: combined, repaired: true };
        i++;
        continue;
      }
    }
    yield { line };
  }
}

function integer(value, label, max = 1440) {
  if (!value) return undefined;
  if (!/^\d+$/.test(value) || Number(value) > max) throw Error(label + " phải là số nguyên từ 0 đến " + max + ".");
  return Number(value);
}

function timeEvents(row, { simulator = false } = {}) {
  if (!row.startTime || !row.parkingTime) throw Error("Thiếu giờ OUT hoặc IN.");
  return normalizeEvents(row.flightDate, {
    out: row.startTime, off: simulator ? "" : row.takeoffTime,
    on: simulator ? "" : row.landingTime, in: row.parkingTime,
  });
}

function sectorKey(f) {
  if (!f.actual?.out || !f.actual?.in) return null;
  const [out, arrival] = [f.actual.out, f.actual.in].map(time => Math.floor(Date.parse(time) / 60000));
  return JSON.stringify([icaoFor(f.dep), icaoFor(f.dest), out, arrival]);
}

async function stableId(prefix, key) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return prefix + Array.from(new Uint8Array(hash), value => value.toString(16).padStart(2, "0")).join("");
}

function notes(lines) {
  const value = lines.filter(Boolean).join("\n");
  if (value.length > 3000) throw Error("Ghi chú vượt 3.000 ký tự.");
  return value;
}

function airport(value) {
  const code = value.toUpperCase();
  return Object.hasOwn(airportAliases, code) ? airportAliases[code] : code;
}

async function parseFlight(row) {
  const actual = timeEvents(row);
  const block = minutes(actual.out, actual.in);
  if (actual.in.slice(0, 10) > row.flightDate && actual.in.slice(11, 16) >= actual.out.slice(11, 16))
    throw Error("Chuỗi giờ OFF/ON nằm ngoài khoảng OUT/IN.");
  if (integer(row.totalTime, "Block") !== block) throw Error("Tổng Block không khớp OUT và IN.");
  const logbook = { version: 1 };
  for (const [column, field] of Object.entries({
    sicTime: "sicMinutes", picusTime: "picusMinutes", ifrTime: "ifrMinutes",
    crossCountryTime: "crossCountryMinutes", ...countFields,
  })) {
    const value = integer(row[column], column, Object.hasOwn(countFields, column) ? 20 : block);
    if (value !== undefined) logbook[field] = value;
  }
  const instrument = integer(row.actualInstrumentTime, "Actual Instrument");
  const instrumentInNotes = instrument !== undefined &&
    (!actual.off || !actual.on || instrument > minutes(actual.off, actual.on));
  if (instrument !== undefined && !instrumentInNotes) logbook.instrumentMinutes = instrument;

  const flightNo = row.flightNumber.toUpperCase().replace(/\s/g, "");
  const validNumber = /^[A-Z0-9-]{0,16}$/.test(flightNo);
  const names = [row.pilotName1, row.pilotName2, row.pilotName3, row.pilotName4].filter(Boolean);
  const extraTimes = [
    ["soloTime", "Solo"], ["dualTime", "Dual"], ["spicTime", "SPIC"], ["examinerTime", "Examiner"],
    ["instructorTime", "Instructor"], ["simulatedInstrumentTime", "Simulated instrument"], ["reliefTime", "Relief"],
  ].map(([field, label]) => {
    const value = integer(row[field], label);
    return value ? label + " (Wader): " + duration(value) : "";
  });
  const picMinutes = integer(row.picTime, "PIC", block);
  const nightMinutes = integer(row.nightTime, "Night", block);
  const flight = {
    date: row.flightDate, flightNo: validNumber ? flightNo : "",
    dep: airport(row.depAirport), dest: airport(row.arrAirport),
    aircraft: row.aircraftType || "", reg: (row.aircraftTailnumber || "").replace(/\s/g, ""),
    scheduled: {}, actual, confirmed: true, source, logbook,
    ...(picMinutes === undefined ? {} : { picMinutes }),
    ...(nightMinutes === undefined ? {} : { nightMinutes }),
    note: notes([
      row.remarks, !validNumber && "Flight number (Wader): " + row.flightNumber,
      row.function && "Function (Wader): " + row.function,
      names.length && "Crew (Wader): " + names.join(" · "),
      instrumentInNotes && instrument && "Actual Instrument (Wader): " + duration(instrument),
      ...extraTimes,
    ]),
  };
  if (flight.aircraft.length > 80 || flight.reg.length > 80) throw Error("Thông tin tàu bay quá dài.");
  flight.id = await stableId("wader-csv-", sectorKey(flight));
  return { flight: validateFlight(flight), instrumentInNotes: Boolean(instrumentInNotes && instrument) };
}

async function parseSimulator(row) {
  const { out, in: arrival } = timeEvents(row, { simulator: true });
  const session = minutes(out, arrival);
  const trainee = integer(row.simTraineeTime, "Sim trainee");
  const trainer = integer(row.simTrainerTime, "Sim trainer");
  if (!session || (trainee || 0) > session || (trainer || 0) > session)
    throw Error("Giờ simulator không khớp thời lượng buổi tập.");
  const note = notes([
    [source, row.simType, row.aircraftType, row.function].filter(Boolean).join(" · "), row.remarks,
    trainee && "Sim trainee: " + duration(trainee), trainer && "Sim trainer: " + duration(trainer),
  ]);
  const id = await stableId("wader-csv-sim-", JSON.stringify([out, arrival, row.aircraftType, row.simType]));
  return { id, date: row.flightDate, type: "SIM", report: out, release: arrival, note };
}

export async function parseWaderCsv(text) {
  const [heading, ...raw] = csvRows(text);
  const headers = heading?.fields.map(value => value.trim());
  if (headers?.at(-1) === "") headers.pop();
  if (!headers || new Set(headers).size !== headers.length || requiredColumns.some(name => !headers.includes(name)))
    throw Error("Thiếu cột của Wader Logbook CSV. Hãy chọn file CSV xuất trực tiếp từ Wader.");
  const flights = [], duties = [], issues = [], seen = new Set();
  let duplicates = 0, previousExperience = 0, repaired = 0, instrumentNotes = 0, records = 0;
  for (const { line, fields, repaired: joined } of recordRows(raw, headers)) {
    if (++records > maxRows) throw Error("CSV tối đa 10.000 bản ghi. Hãy xuất theo khoảng ngày nhỏ hơn.");
    try {
      if (!fields) throw Error("Số cột không khớp tiêu đề.");
      const row = Object.fromEntries(headers.map((name, index) => [name, fields[index].trim()]));
      if (/^true$/i.test(row.isPreviousExperience)) {
        previousExperience++;
        continue;
      }
      if (!/^false$/i.test(row.isPreviousExperience) || !flag(row.isSimulator)) throw Error("Không nhận ra loại bản ghi.");
      validDate(row.flightDate);
      const simulator = /^true$/i.test(row.isSimulator);
      const parsed = simulator ? { duty: await parseSimulator(row) } : await parseFlight(row);
      const record = parsed.duty || parsed.flight;
      if (joined) repaired++;
      if (seen.has(record.id)) {
        duplicates++;
        continue;
      }
      seen.add(record.id);
      (simulator ? duties : flights).push(record);
      if (parsed.instrumentInNotes) instrumentNotes++;
    } catch (err) {
      issues.push({ line, reason: err.message });
    }
  }
  if (!flights.length && !duties.length) {
    const first = issues[0];
    throw Error(first ? `Không có bản ghi hợp lệ. Dòng ${first.line}: ${first.reason}` :
      "CSV không có chuyến bay hoặc buổi simulator theo ngày.");
  }
  return { flights, duties, issues, duplicates, previousExperience, repaired, instrumentNotes };
}

export function newWaderCsvRecords(state, parsed) {
  const archived = state.trash || [];
  const existing = [...state.flights, ...archived.filter(row => row.kind === "flight").map(row => row.data)];
  const ids = new Set(existing.map(flightKey));
  const sectors = new Set(existing.map(sectorKey).filter(Boolean));
  const dutyIds = new Set([...state.duties.map(duty => duty.id),
    ...archived.filter(row => row.kind === "duty").map(row => row.data.id)]);
  return {
    flights: parsed.flights.filter(flight => !ids.has(flightKey(flight)) && !sectors.has(sectorKey(flight))),
    duties: parsed.duties.filter(duty => !dutyIds.has(duty.id)),
  };
}
