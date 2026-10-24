import {validateLogbook,timeTotals} from './flight-times.js';
import {validateAuditTrail} from './flight-audit.js';
export const eventKeys = ["out", "off", "on", "in"];
export const uid = () => globalThis.crypto.randomUUID();
export function validDate(date) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(date + "T00:00:00Z")) ||
    new Date(date + "T00:00:00Z").toISOString().slice(0, 10) !== date
  )
    throw Error("Ngày không hợp lệ");
  return date;
}
export function normalizeEvents(date, clocks) {
  validDate(date);
  let previous = Date.parse(date + "T00:00:00Z"),
    day = 0;
  const result = {};
  for (const key of eventKeys) {
    const value = clocks[key];
    if (!value) continue;
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))
      throw Error("Giờ UTC không hợp lệ: " + value);
    let t = Date.parse(`${date}T${value}:00Z`) + day * 86400000;
    if (t < previous) {
      day++;
      t += 86400000;
    }
    if (day > 1)
      throw Error("Chuỗi giờ qua ngày bất thường; nhập ngày cụ thể.");
    result[key] = new Date(t).toISOString();
    previous = t;
  }
  return result;
}
export const minutes = (a, b) =>
  a && b ? Math.round((Date.parse(b) - Date.parse(a)) / 60000) : 0;
export const duration = (n) =>
  `${n < 0 ? "-" : ""}${String(Math.floor(Math.abs(n || 0) / 60)).padStart(2, "0")}:${String(Math.abs(n || 0) % 60).padStart(2, "0")}`;
export const clock = (t) => (t ? new Date(t).toISOString().slice(11, 16) : "—");
export const flightKey = (f) =>
  `${f.date}:${String(f.flightNo)
    .toUpperCase()
    .replace(/\s/g, "")
    .replace(/^([A-Z]{2})0+(\d)/, "$1$2")}`;
export function validateFlight(f) {
  validDate(f.date);
  if (typeof f.id !== "string" || !f.id || f.id.length > 100)
    throw Error("ID chuyến bay không hợp lệ");
  for (const k of ["flightNo", "dep", "dest"])
    if (typeof f[k] !== "string")
      throw Error("Thông tin chuyến bay phải là văn bản");
  for (const k of [
    "aircraft",
    "reg",
    "source",
    "note",
    "role",
    "captainId",
    "foId",
    "landingMode",
    "takeoffBy",
    "landingBy",
  ])
    if (f[k] !== undefined && typeof f[k] !== "string")
      throw Error("Trường " + k + " không hợp lệ");
  if (
    f.crewIds !== undefined &&
    (!Array.isArray(f.crewIds) || f.crewIds.some((x) => typeof x !== "string"))
  )
    throw Error("Crew IDs phải là danh sách");
  if (f.confirmed !== undefined && typeof f.confirmed !== "boolean")
    throw Error("Trạng thái xác nhận không hợp lệ");
  if (
    f.confidence !== undefined &&
    (!Number.isFinite(f.confidence) || f.confidence < 0 || f.confidence > 100)
  )
    throw Error("Confidence không hợp lệ");
  for (const k of ["actual", "scheduled"])
    if (
      f[k] !== undefined &&
      (!f[k] || typeof f[k] !== "object" || Array.isArray(f[k]))
    )
      throw Error("Giờ chuyến bay không hợp lệ");
  if (!/^[A-Z0-9]{2,3}\d{1,5}[A-Z]?$/.test(f.flightNo || ""))
    throw Error("Kiểm tra số hiệu chuyến bay");
  if (!/^[A-Z]{3,4}$/.test(f.dep || "") || !/^[A-Z]{3,4}$/.test(f.dest || ""))
    throw Error("Sân bay phải là mã IATA hoặc ICAO");
  for (const name of ["scheduled", "actual"]) {
    let prev = null;
    for (const k of eventKeys) {
      const t = f[name]?.[k];
      if (!t) continue;
      if (
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{3})?)?Z$/.test(t) ||
        !Number.isFinite(Date.parse(t)) ||
        new Date(t).toISOString().slice(0, 16) !== t.slice(0, 16)
      )
        throw Error("Cần ngày giờ UTC cho " + k);
      if (prev && Date.parse(t) < prev)
        throw Error("Thứ tự phải là OUT ≤ OFF ≤ ON ≤ IN");
      prev = Date.parse(t);
    }
    const e = f[name];
    if (e?.out && e?.in && minutes(e.out, e.in) > 1440)
      throw Error("Block vượt 24 giờ; kiểm tra lại ngày");
  }
  if (f.confirmed && !eventKeys.every((k) => f.actual?.[k]))
    throw Error("Cần đủ OUT/OFF/ON/IN trước khi xác nhận");
  if (
    f.nightMinutes !== undefined &&
    (!Number.isInteger(f.nightMinutes) ||
      f.nightMinutes < 0 ||
      f.nightMinutes > minutes(f.actual?.out, f.actual?.in))
  )
    throw Error("Night time phải nằm trong Block time");
  if (
    f.picMinutes !== undefined &&
    (!Number.isInteger(f.picMinutes) ||
      f.picMinutes < 0 ||
      f.picMinutes > minutes(f.actual?.out, f.actual?.in))
  )
    throw Error("PIC time phải nằm trong Block time");
  validateLogbook(f);
  validateAuditTrail(f.auditTrail);
  return f;
}
export function mergeRoster(existing, incoming, { v14Enabled = false } = {}) {
  const flights = structuredClone(existing),
    changes = [];
  const scheduleFor = (f) => ({
    ...f.scheduled,
    dep: f.scheduled?.dep || f.dep,
    dest: f.scheduled?.dest || f.dest,
    aircraft: f.scheduled?.aircraft || f.aircraft || "",
    source: f.scheduled?.source || f.source || "",
  });
  for (const f of incoming) {
    const i = flights.findIndex((x) => flightKey(x) === flightKey(f));
    if (i < 0) {
      flights.push({
        ...f,
        id: f.id || uid(),
        scheduled: scheduleFor(f),
        actual: {},
        confirmed: false,
        ...(v14Enabled ? { logbook: { version: 1 } } : {}),
      });
      changes.push({ type: "new", flight: f });
    } else {
      const old = flights[i],
        before = scheduleFor(old),
        next = { ...scheduleFor(f), aircraft: f.aircraft || before.aircraft };
      if (!v14Enabled && (old.logbook || old.auditTrail)) {
        changes.push({ type: "unchanged", flight: f, protected: true });
        continue;
      }
      const changed = ["out", "in", "dep", "dest", "aircraft"].some(
        (k) => before[k] !== next[k],
      );
      flights[i] = {
        ...old,
        scheduled: next,
        ...(!old.confirmed && !old.auditTrail
          ? {
              dep: f.dep,
              dest: f.dest,
              aircraft: f.aircraft || old.aircraft,
              source: Object.keys(old.actual || {}).length
                ? old.source
                : f.source || old.source,
            }
          : {}),
      };
      changes.push({ type: changed ? "updated" : "unchanged", flight: f });
    }
  }
  return { flights, changes };
}
export function statistics(flights) {
  const s = {
    block: 0,
    airborne: 0,
    sectors: 0,
    pf: 0,
    pm: 0,
    takeoffs: 0,
    landings: 0,
    night: 0,
    pic: 0,
    sic: 0,
    picus: 0, ifr: 0, vfr: 0, instrument: 0, crossCountry: 0,
    unknownSIC: 0, legacySIC: 0,
    takeoffDay: 0, takeoffNight: 0, landingDay: 0, landingNight: 0,
    aircraft: {},
    airports: {},
  };
  for (const f of flights.filter((x) => x.confirmed)) {
    const b = minutes(f.actual?.out, f.actual?.in),
      a = minutes(f.actual?.off, f.actual?.on);
    s.block += b;
    s.airborne += a;
    s.sectors++;
    s[f.role === "PF" ? "pf" : "pm"]++;
    const l=f.logbook||{},totals=timeTotals(f);
    s.takeoffs += l.takeoffDay!==undefined||l.takeoffNight!==undefined?(l.takeoffDay||0)+(l.takeoffNight||0):f.takeoffBy==='self'?1:0;
    s.landings += l.landingDay!==undefined||l.landingNight!==undefined?(l.landingDay||0)+(l.landingNight||0):f.landingBy==='self'?1:0;
    for(const k of ['takeoffDay','takeoffNight','landingDay','landingNight'])s[k]+=l[k]||0;
    for(const k of ['picus','ifr','vfr','instrument','crossCountry'])s[k]+=totals[k]??0;
    if(totals.sic===null)s.unknownSIC++;
    if(totals.legacySIC)s.legacySIC++;
    s.night += f.nightMinutes || 0;
    s.pic += f.picMinutes || 0;
    s.sic += totals.sic??0;
    s.aircraft[f.aircraft || "Unknown"] =
      (s.aircraft[f.aircraft || "Unknown"] || 0) + b;
    for (const p of [f.dep, f.dest]) s.airports[p] = (s.airports[p] || 0) + 1;
  }
  return s;
}
export function restoreBackup(data, existing) {
  if (
    !data ||
    data.version !== 1 ||
    !Array.isArray(data.flights) ||
    data.flights.length > 10000
  )
    throw Error("Backup không đúng định dạng AviLog v1");
  const ids = new Set(),
    keys = new Set();
  for (const f of data.flights) {
    validateFlight(f);
    if (ids.has(f.id) || keys.has(flightKey(f)))
      throw Error("Backup có ID hoặc chuyến trùng");
    ids.add(f.id);
    keys.add(flightKey(f));
    if (existing.some((x) => x.id === f.id && flightKey(x) !== flightKey(f)))
      throw Error("ID backup xung đột với chuyến hiện có");
  }
  const flights = structuredClone(existing);
  for (const f of data.flights) {
    const i = flights.findIndex((x) => flightKey(x) === flightKey(f));
    if (i < 0) flights.push({ ...f, id: f.id || uid() });
    else if (!flights[i].confirmed && !flights[i].auditTrail && !(flights[i].logbook && !f.logbook)) flights[i] = { ...f, id: flights[i].id };
  }
  return { flights };
}
export function csvCell(value) {
  let s = String(value ?? "");
  if (/^[\s]*[=+@-]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
export function dutySummary(duty, flights, previous) {
  const group = flights.filter(
    (f) =>
      f.dutyId === duty.id ||
      (f.dutyId === undefined &&
        f.date === duty.date &&
        duty.type === "FLIGHT"),
  );
  return {
    flights: group,
    sectors: group.length,
    block: statistics(group).block,
    minutes: minutes(duty.report, duty.release),
    rest:
      previous?.release && duty.report
        ? minutes(previous.release, duty.report)
        : null,
  };
}
export function reminders(state, now = new Date()) {
  const current = now.toISOString().slice(0, 10),
    tomorrow = new Date(+now + 86400000).toISOString().slice(0, 10),
    r = [];
  if (state.settings.tomorrow) {
    const fs = state.flights.filter((f) => f.date === tomorrow);
    const ds = state.duties.filter((d) => d.date === tomorrow);
    if (fs.length || ds.length)
      r.push({
        id: "tomorrow:" + tomorrow,
        title: "Lịch ngày mai (UTC)",
        text: fs.length
          ? `${fs.length} sectors · ${fs.map((f) => f.flightNo).join(", ")}`
          : ds.map((d) => d.type).join(", "),
      });
  }
  if (state.settings.missingActual)
    for (const f of state.flights) {
      if (
        !f.confirmed &&
        f.scheduled?.in &&
        Date.parse(f.scheduled.in) < +now - 1800000
      )
        r.push({
          id: "actual:" + f.id,
          flightId: f.id,
          title: f.flightNo + " chưa ghi Actual",
          text: `${f.dep} → ${f.dest} · ${f.date}`,
        });
    }
  if (state.settings.beforeDuty)
    for (const d of state.duties) {
      const t = Date.parse(d.report) - +now;
      if (t > 0 && t <= (state.settings.leadMinutes || 120) * 60000)
        r.push({
          id: "report:" + d.id,
          title: "Sắp đến giờ report",
          text: `${d.type} · ${clock(d.report)} UTC`,
        });
    }
  return r;
}
export function archiveRecord(state, kind, id) {
  const next = structuredClone(state),
    key = kind === "flight" ? "flights" : "duties",
    record = next[key].find((x) => x.id === id);
  if (!record) throw Error("Không tìm thấy bản ghi");
  next[key] = next[key].filter((x) => x.id !== id);
  const flightIds =
    kind === "duty"
      ? next.flights.filter((x) => x.dutyId === id).map((x) => x.id)
      : [];
  if (kind === "duty")
    next.flights = next.flights.map((f) =>
      f.dutyId === id ? { ...f, dutyId: null } : f,
    );
  next.trash = [
    ...(next.trash || []),
    { id: uid(), kind, data: record, flightIds, at: new Date().toISOString() },
  ];
  return next;
}
export function restoreRecord(state, id) {
  const next = structuredClone(state),
    record = next.trash?.find((x) => x.id === id);
  if (!record) throw Error("Không tìm thấy bản ghi");
  const key = record.kind === "flight" ? "flights" : "duties";
  if (
    next[key].some(
      (x) =>
        x.id === record.data.id ||
        (record.kind === "flight" && flightKey(x) === flightKey(record.data)),
    )
  )
    throw Error("Bản ghi đã có. Không khôi phục trùng.");
  next[key].push(record.data);
  if (record.kind === "duty")
    next.flights = next.flights.map((f) =>
      record.flightIds.includes(f.id) && !f.dutyId
        ? { ...f, dutyId: record.data.id }
        : f,
    );
  next.trash = next.trash.filter((x) => x.id !== id);
  return next;
}
