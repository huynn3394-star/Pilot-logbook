import assert from "node:assert/strict";
import { test } from "node:test";
import { flightKey, mergeRoster, statistics, validateFlight } from "../public/lib/domain.js";
import { newWaderCsvRecords, parseWaderCsv } from "../public/lib/wader-csv.js";
import { validateRecord } from "../public/workspace/schema.js";
import { overnight, partial, simulator, waderCsv } from "./fixtures/wader-csv.mjs";

test("Wader preserves actual UTC events, allocations, counts, and simulator duration", async () => {
  const result = await parseWaderCsv(waderCsv([overnight, partial, simulator]));
  assert.deepEqual(result.issues, []);
  const [flight, missing] = result.flights;
  assert.deepEqual(flight.actual, {
    out: "2026-10-31T23:40:00.000Z", off: "2026-10-31T23:55:00.000Z",
    on: "2026-11-01T00:40:00.000Z", in: "2026-11-01T00:55:00.000Z",
  });
  assert.equal(flight.dep, "SGN");
  assert.equal(flight.logbook.instrumentMinutes, 40);
  assert.equal(flight.logbook.landingNight, 1);
  assert.match(flight.note, /Fixture "remark", with comma/);
  assert.equal(missing.flightNo, "");
  assert.deepEqual(Object.keys(missing.actual), ["out", "in"]);
  assert.equal(missing.logbook.instrumentMinutes, undefined);
  assert.match(missing.note, /Actual Instrument \(Wader\): 01:15/);
  assert.equal(result.instrumentNotes, 1);
  assert.equal(result.duties[0].type, "SIM");
  assert.equal(result.duties[0].release, "2026-11-01T17:00:00.000Z");
  const totals = statistics(result.flights);
  assert.equal(totals.block, 150);
  assert.equal(totals.airborne, 45);
  assert.equal(totals.pf + totals.pm, 0);
  for (const [kind, records] of [["flight", result.flights], ["duty", result.duties]]) {
    for (const data of records) validateRecord({ kind, data, id: data.id, schemaVersion: 1, archived: false, revision: 0 });
  }
  assert.throws(() => validateFlight({ ...missing, id: "ordinary", flightNo: "ZZ123" }), /OUT\/OFF\/ON\/IN/);
});

test("Wader handles a split text field, rejects invalid timing, and reports summary and duplicate rows", async () => {
  const split = { ...overnight, pilotName1: "Synthetic\nPilot" };
  const bad = { ...partial, totalTime: "76" };
  const result = await parseWaderCsv(waderCsv([
    split, overnight, bad, { isPreviousExperience: "true", totalTime: "5000" },
  ], { unquotedPilotName: true }));
  assert.equal(result.flights.length, 1);
  assert.equal(result.repaired, 1);
  assert.equal(result.duplicates, 1);
  assert.equal(result.previousExperience, 1);
  assert.equal(result.issues.length, 1);
  assert.match(result.issues[0].reason, /Block không khớp/);
  assert.match(result.flights[0].note, /Synthetic\nPilot/);
  await assert.rejects(parseWaderCsv("flightNumber,totalTime\nZZ123,75"), /Thiếu cột/);
  await assert.rejects(parseWaderCsv(waderCsv([overnight]) + '\n"bad'), /ngoặc kép/);
});

test("repeat flight numbers keep separate sectors and repeat imports preserve existing and archived records", async () => {
  const repeat = { ...overnight, startTime: "13:00", takeoffTime: "13:10", landingTime: "14:00", parkingTime: "14:15",
    depAirport: overnight.arrAirport, arrAirport: overnight.depAirport };
  const result = await parseWaderCsv(waderCsv([overnight, repeat, simulator]));
  const [first, second] = result.flights;
  assert.notEqual(flightKey(first), flightKey(second));
  const known = { ...first, id: "existing-record", note: "Keep this note",
    actual: { ...first.actual, out: "2026-10-31T23:40:25.000Z", in: "2026-11-01T00:55:13.000Z" } };
  const state = { flights: [known], duties: [], trash: [{ kind: "duty", data: result.duties[0] }] };
  assert.deepEqual(newWaderCsvRecords(state, result), { flights: [second], duties: [] });
  const roster = { ...second, id: "roster", scheduled: { out: second.actual.out, in: second.actual.in }, actual: {}, confirmed: false };
  const merged = mergeRoster(result.flights, [roster]);
  assert.equal(merged.flights.length, 2);
  assert.deepEqual(merged.flights[1].actual, second.actual);
});
