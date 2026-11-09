# Automatic day/night entry

User-selected rule: **18:00 inclusive to 06:00 exclusive, local time**, fixed year-round. Input and stored event dates/times remain UTC. The browser/device timezone does not determine the flight's local clock.

## Behavior

- New flight: entering actual OUT and IN estimates Night minutes inside Block. With OFF/ON, taxi uses each airport's location and the airborne phase follows a shortest great-circle route at constant progress. Without OFF/ON, the whole block follows that estimated route.
- Each route sample uses a geographic IANA timezone lookup, then the device's `Intl` timezone rules at that UTC instant, including DST and fractional-hour offsets. Sampling is every 30 seconds, with separate taxi/flight phases; totals round once to whole minutes and cannot exceed rounded Block.
- Takeoff uses exact OFF at DEP; landing uses exact ON at DEST. `Takeoff by` / `Landing by = Tôi` gives one personal event in its day or night counter. Explicit other crew gives zero personal events. Unknown operator or event time remains blank. OUT/IN do not substitute for unknown OFF/ON; PF/PM does not establish ownership.
- Editing a Night value or either counter in a group disables automatic replacement for that group during this edit. **Tính lại ngày/đêm** explicitly re-enables and recomputes the available groups.
- All saved flights, including FINAL records, initially preserve their stored values. A note-only edit cannot recalculate allocations. Recalculation of FINAL remains subject to the existing replacement permission and revision reason/audit flow.
- Automatic mode is per edit and is not stored. Reopened flights keep their saved values until explicit recalculation. Calculated results use only existing `nightMinutes` and `logbook` fields; no cloud schema migration.
- Missing/invalid dates, chronology, Block above 24 hours, unknown airports, unsupported timezones or ambiguous antipodal routes leave automatic Night blank. An unavailable result is not saved as an invented zero. Manual entry remains available.

## Data and limits

Airport positions use the existing OurAirports snapshot (large/medium airports). Offline timezone geometry is vendored from [`@photostructure/tz-lookup` 11.7.0](https://github.com/photostructure/tz-lookup), CC0; license, npm integrity and source digest are in `public/lib/vendor/`. Geographic lookup is approximate near timezone borders and at sea. Historical/future clock accuracy also depends on the browser/OS timezone database.

The route is an estimate without actual track, speed, ATC routing or holding data. The chosen clock window is not a solar/twilight calculation. Users can review and override the estimate. The UI explicitly shows the fixed rule, timezone dependencies and estimated status.

## Verification

- `node scripts/build-atpl-account.mjs`: passed; Firebase bundle remains `80c44a81f174`.
- `node --test tests/*.test.js`: **328/328 passed**, including 13 new regression tests for boundaries, Vietnam/Asia offsets, fractional-hour timezone, DST changes, taxi inclusion, UTC/local midnight, date line, ownership, invalid dates and unknown airports.
- `node scripts/verify-flight-night.cjs`: **8/8 passed**: Chromium and WebKit at 320, 390, 820 and 1180 px, with device timezone Los Angeles and flight locations in Vietnam. Checked automatic values, missing OFF/ON, other crew, manual overrides/recalculation, existing FINAL note-only preservation, save/reload, FINAL protection, two-column counter alignment and absence of overflow/runtime errors. Offline reload and calculation verified on Chromium at all four widths; WebKit offline not tested.
- Example: SGN–HAN OUT 10:00Z, OFF 10:10Z, ON 12:00Z, IN 12:10Z gives **70 Night minutes**, takeoff Day 1, landing Night 1 when both operators are self.
- Service-worker cache version bumped; both new modules and the geographic lookup are included in the offline shell. Browser screenshots and matrix output are reproducible under `test-results/flight-night/`.

Tests used isolated synthetic guest storage and a local server, with no account writes. **Railway deployment, real-account sync, physical iOS devices and the production service-worker update were not verified.** This branch has not been merged or deployed.
