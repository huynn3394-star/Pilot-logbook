import { normalizeEvents, uid, validDate } from "./domain.js";
export const airportAliases = {
  VVTS: "SGN",
  VTBS: "BKK",
  VVNB: "HAN",
  VVDL: "DLI",
  VVCI: "HPH",
  RJGG: "NGO",
};
export const icaoFor = (p) =>
  ({
    SGN: "VVTS",
    BKK: "VTBS",
    HAN: "VVNB",
    DLI: "VVDL",
    HPH: "VVCI",
    NGO: "RJGG",
    DAD: "VVDN",
    NRT: "RJAA",
    ICN: "RKSI",
    SIN: "WSSS",
  })[p] || p;
export const families = {
  A320: { label: "A320 / A321 · MCDU / AOC", supported: true },
  B787: { label: "B787 · nhập tay / chờ parser", supported: false },
  A350: { label: "A350 · nhập tay / chờ parser", supported: false },
  OTHER: { label: "Khác · nhập tay", supported: false },
};
export function parseAircraft(text, family, date) {
  if (!families[family]?.supported)
    throw Error(
      "Parser " +
        family +
        " chưa được xác minh. Vui lòng nhập Actual thủ công.",
    );
  const t = text.toUpperCase().replace(/\b0UT\b/g, "OUT");
  const rawFlight = t.match(/\bVN\s*[0-9OIL]{1,5}\b/)?.[0]?.replace(/\s/g, "") || "";
  const flightNo = rawFlight.slice(0,2) + rawFlight.slice(2).replace(/O/g,'0').replace(/[IL]/g,'1');
  const route = t.match(/\b([A-Z]{4})\s*(?:[→/\-]|\s)\s*([A-Z]{4})\b/);
  const clocks = {};
  for (const k of ["out", "off", "on", "in"]) {
    const m = t.match(
      new RegExp("\\b" + k + "\\b\\s*[:=]?\\s*(\\d{2})[:. ]?(\\d{2})", "i"),
    );
    if (m) clocks[k] = m[1] + ":" + m[2];
  }
  if (!Object.keys(clocks).length)
    throw Error("Không nhận ra OUT/OFF/ON/IN. Sửa văn bản OCR hoặc nhập tay.");
  return {
    id: uid(),
    date: validDate(date),
    flightNo,
    dep: airportAliases[route?.[1]] || route?.[1] || "",
    dest: airportAliases[route?.[2]] || route?.[2] || "",
    aircraft: "A321",
    actual: normalizeEvents(date, clocks),
    scheduled: {},
    confirmed: false,
    source: "image OCR · A320/A321",
    confidence: Math.round((Object.keys(clocks).length / 4) * (rawFlight!==flightNo?65:85)),
    role: "PF",
    nightMinutes: 0,
    picMinutes: 0,
  };
}
export function parseRoster(text, month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw Error("Chọn tháng roster");
  let date = null;
  const flights = [],
    unrecognized = [];
  for (const line of text
    .split(/\n/)
    .map((x) => x.trim())
    .filter(Boolean)) {
    const dm = line.match(/^(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{4}))?\b/);
    if (dm) {
      date = `${dm[3] || month.slice(0, 4)}-${dm[2].padStart(2, "0")}-${dm[1].padStart(2, "0")}`;
      validDate(date);
    }
    const re =
      /\b(VN\s*\d{1,5})\s+([A-Z]{3,4})\s*[-–→/]\s*([A-Z]{3,4})\s+(\d{2}:\d{2})\s*[-–→/]\s*(\d{2}:\d{2})/g;
    let matched = false,
      m;
    while ((m = re.exec(line.toUpperCase()))) {
      if (!date) {
        unrecognized.push(line);
        break;
      }
      matched = true;
      flights.push({
        id: uid(),
        date,
        flightNo: m[1].replace(/\s/g, ""),
        dep: airportAliases[m[2]] || m[2],
        dest: airportAliases[m[3]] || m[3],
        aircraft: "",
        scheduled: normalizeEvents(date, { out: m[4], in: m[5] }),
        actual: {},
        confirmed: false,
        source: "month-plan PDF",
        confidence: 70,
        role: "PM",
        nightMinutes: 0,
        picMinutes: 0,
      });
    }
    if (!matched && !dm) unrecognized.push(line);
  }
  return { flights, unrecognized };
}
