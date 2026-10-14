import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeEvents,
  minutes,
  mergeRoster,
  statistics,
  validateFlight,
  restoreBackup,
  csvCell,
} from "../public/lib/domain.js";
import { parseAircraft, parseRoster } from "../public/lib/parsers.js";
import { evaluateRules } from "../public/lib/rules.js";
test("overnight 0343 UTC crosses date and is 5:28", () => {
  const e = normalizeEvents("2026-10-03", {
    out: "23:55",
    off: "00:05",
    on: "05:13",
    in: "05:23",
  });
  assert.equal(e.in, "2026-10-04T05:23:00.000Z");
  assert.equal(minutes(e.out, e.in), 328);
});
test("A320 AOC sample and independent durations", () => {
  const p = parseAircraft(
    "VN0605 VVTS VTBS OUT 04:29 OFF 04:39 ON 05:50 IN 06:00 FLIGHT 01:11 BLOCK 01:31",
    "A320",
    "2026-10-09",
  );
  assert.equal(p.flightNo, "VN0605");
  assert.equal(minutes(p.actual.out, p.actual.in), 91);
  assert.equal(minutes(p.actual.off, p.actual.on), 71);
  assert.equal(p.confirmed, false);
});
test("invalid clocks and impossible date rejected", () => {
  assert.throws(() => normalizeEvents("2026-02-30", { out: "04:29" }));
  assert.throws(() => normalizeEvents("2026-10-09", { out: "24:29" }));
  assert.throws(() =>
    validateFlight({
      date: "2026-10-09",
      flightNo: "VN605",
      dep: "SGN",
      dest: "BKK",
      actual: { out: "2026-10-09T06:00Z", off: "2026-10-09T05:00Z" },
      confirmed: true,
    }),
  );
});
test("roster merge deduplicates, updates route, never overwrites Actual", () => {
  const f = {
    id: "saved",
    date: "2026-10-09",
    flightNo: "VN0605",
    dep: "SGN",
    dest: "BKK",
    scheduled: { out: "old" },
    actual: { out: "actual" },
    confirmed: true,
  };
  const m = mergeRoster(
    [f],
    [
      {
        ...f,
        id: "new",
        flightNo: "VN605",
        dest: "HAN",
        scheduled: { out: "new" },
        actual: { out: "bad" },
      },
    ],
  );
  assert.equal(m.flights.length, 1);
  assert.equal(m.flights[0].id, "saved");
  assert.equal(m.flights[0].actual.out, "actual");
  assert.equal(m.flights[0].dest, "BKK");
  assert.equal(m.flights[0].scheduled.dest, "HAN");
  assert.equal(m.flights[0].scheduled.out, "new");
  assert.equal(mergeRoster([], [f, f]).flights.length, 1);
});
test("roster date carry and normalized source format", () => {
  const p = parseRoster(
    "09/10 VN7388 SGN-DLI 07:14-08:06\nVN7389 DLI-SGN 08:40-09:30",
    "2026-10",
  );
  assert.equal(p.flights.length, 2);
  assert.equal(p.flights[1].date, "2026-10-09");
  assert.equal(p.flights[0].scheduled.out, "2026-10-09T07:14:00.000Z");
});
test("unknown format and unsupported aircraft require review", () => {
  assert.equal(parseRoster("some random data", "2026-10").flights.length, 0);
  assert.throws(() => parseAircraft("OUT 99:99", "A350", "2026-10-09"));
});
test("statistics use only confirmed actual and separate PF/PM and night", () => {
  const actual = normalizeEvents("2026-10-09", {
    out: "04:29",
    off: "04:39",
    on: "05:50",
    in: "06:00",
  });
  const s = statistics([
    {
      confirmed: true,
      actual,
      role: "PF",
      nightMinutes: 20,
      takeoffBy: "self",
      landingBy: "self",
    },
    { confirmed: false, actual },
  ]);
  assert.equal(s.block, 91);
  assert.equal(s.airborne, 71);
  assert.equal(s.sectors, 1);
  assert.equal(s.pf, 1);
  assert.equal(s.night, 20);
});
test("FTL unconfigured is unknown; configured rules expose version/source", () => {
  assert.equal(evaluateRules([], null).status, "unknown");
  const r = evaluateRules([{ minutes: 650 }], {
    version: "test-only",
    source: { section: "test" },
    rules: [{ field: "minutes", max: 600, near: 60 }],
  });
  assert.equal(r.status, "red");
  assert.equal(r.version, "test-only");
});
test("backup invalid shape rejected and confirmed data protected", () => {
  assert.throws(() => restoreBackup({ version: 1, flights: "bad" }, []));
  const f = {
    id: "one",
    date: "2026-10-09",
    flightNo: "VN605",
    dep: "SGN",
    dest: "BKK",
    confirmed: true,
    actual: normalizeEvents("2026-10-09", {
      out: "04:29",
      off: "04:39",
      on: "05:50",
      in: "06:00",
    }),
  };
  assert.deepEqual(
    restoreBackup(
      { version: 1, flights: [{ ...f, confirmed: false, actual: {} }] },
      [f],
    ).flights[0].actual,
    f.actual,
  );
});
test("CSV untrusted strings cannot execute formulas", () => {
  assert.equal(csvCell("=1+1"), '"\'=1+1"');
});
test("confirmed route, aircraft and source survive roster schedule changes", () => {
  const f = {
    id: "s",
    date: "2026-10-09",
    flightNo: "VN605",
    dep: "SGN",
    dest: "BKK",
    aircraft: "A321",
    source: "reviewed image",
    confirmed: true,
    actual: normalizeEvents("2026-10-09", {
      out: "04:29",
      off: "04:39",
      on: "05:50",
      in: "06:00",
    }),
    scheduled: {
      out: "2026-10-09T04:20:00.000Z",
      in: "2026-10-09T06:10:00.000Z",
    },
  };
  const m = mergeRoster(
    [f],
    [{ ...f, dep: "HAN", dest: "SGN", aircraft: "A350", source: "new PDF" }],
  ).flights[0];
  assert.equal(m.dep, "SGN");
  assert.equal(m.dest, "BKK");
  assert.equal(m.aircraft, "A321");
  assert.equal(m.source, "reviewed image");
  assert.equal(m.scheduled.dep, "HAN");
  assert.equal(m.scheduled.dest, "SGN");
  assert.equal(m.scheduled.aircraft, "A350");
  assert.deepEqual(statistics([m]).airports, { SGN: 1, BKK: 1 });
});
test("backup rejects bad crew arrays, duplicate IDs and collision with workspace", () => {
  const f = {
    id: "s",
    date: "2026-10-09",
    flightNo: "VN605",
    dep: "SGN",
    dest: "BKK",
    confirmed: false,
    actual: {},
  };
  assert.throws(() =>
    restoreBackup({ version: 1, flights: [{ ...f, crewIds: 123 }] }, []),
  );
  assert.throws(() =>
    restoreBackup(
      { version: 1, flights: [f, { ...f, flightNo: "VN606" }] },
      [],
    ),
  );
  assert.throws(() =>
    restoreBackup({ version: 1, flights: [{ ...f, flightNo: "VN606" }] }, [f]),
  );
});
test("deliberate duty exclusion and negative rest stay visible", async () => {
  const { dutySummary, duration } = await import("../public/lib/domain.js");
  const d = {
    id: "d",
    date: "2026-10-09",
    type: "FLIGHT",
    report: "2026-10-09T06:00Z",
    release: "2026-10-09T10:00Z",
  };
  const s = dutySummary(d, [{ id: "f", date: d.date, dutyId: null }], {
    release: "2026-10-09T08:00Z",
  });
  assert.equal(s.sectors, 0);
  assert.equal(s.rest, -120);
  assert.equal(duration(-120), "-02:00");
});
test("flight and duty removal are recoverable", async () => {
  const { archiveRecord, restoreRecord } = await import(
    "../public/lib/domain.js"
  );
  const state = {
    flights: [{ id: "f", date: "2026-10-09", flightNo: "VN605", dutyId: "d" }],
    duties: [{ id: "d" }],
  };
  const a = archiveRecord(state, "flight", "f");
  assert.equal(a.flights.length, 0);
  assert.equal(restoreRecord(a, a.trash[0].id).flights[0].id, "f");
  const b = archiveRecord(state, "duty", "d");
  assert.equal(b.duties.length, 0);
  assert.equal(b.flights[0].dutyId, null);
  const c = restoreRecord(b, b.trash[0].id);
  assert.equal(c.duties[0].id, "d");
  assert.equal(c.flights[0].dutyId, "d");
});
test('OCR flight number handles O/0 confusion with review confidence',()=>{const p=parseAircraft('VNO605 VVTS VTBS OUT 04:29 OFF 04:39 ON 05:50 IN 06:00','A320','2026-10-09');assert.equal(p.flightNo,'VN0605');assert.ok(p.confidence<85);});
