# Weather attention implementation plan

Goal: show SPECI for every airport in saved Weather groups at the top, even collapsed, with a red attention panel; highlight TSRA and CB independently in all rendered weather reports.
Base: 073ec63a763e5ef67936aad9f86d37164b1ab025, existing AviLog project.
Architecture: pure escaped text renderer + pure saved-group SPECI projection; integrate existing Weather view, and a narrowly scoped observer for the existing flight-weather modal. Do not modify stored reports, providers, refresh cadence, account data, ATPL or Firebase.
Ruling: saved file means the saved airport groups/watchlist in the existing Weather tab. Keep manually arranged groups unchanged, duplicate eligible airports in a top summary only, deduplicated across groups. Do not reorder saved data.
Ruling: SPECI note reflects the currently retained observation. An ordinary METAR replacement removes it; offline/stale/error states keep it with explicit UTC/age labels and a button opening the original report. This is attention styling, not a hazardous-weather or validity certification.
Ruling: TSRA and CB each qualify on their own. Match intensity/recent/vicinity TSRA tokens and cloud suffix CB, not arbitrary station substrings. Preserve every original character and escape HTML.
User confirmation: SPECI panel only at the top of the Weather tab. Move Bản lưu below the airport identifier, leaving the report in the second column. A fresh or missing report has no empty saved-label row. Per-product retrieval age and failed refresh keep the saved label honest.

- [x] Original 13 unit cases for highlighting/SPECI; follow-up three identity-renderer tests demonstrated RED/GREEN; fourth VV005CB test demonstrated RED/GREEN.
- [x] Hosted browser checks: actual stopped-origin offline diagnostics, airport-column geometry on both SPECI and ordinary reports, all widths/themes, fresh/stale transitions. 12 weather scenarios passed, existing Weather regressions passed, 250 shared-interface checks and 18 flight-editor scenarios passed.
- [x] Unit suite: 254 passed, 2 unchanged failures referencing missing historical commits. Failures remain visible; no tests skipped.
- [x] Inline complete-diff review, original-data/provider/ATPL preservation check and screenshot inspection. No independent reviewer available.
- [ ] Recheck main, fast-forward the existing project, and verify Railway deployment separately. The release report does not pre-claim deployment success.

Evidence and limitations: docs/WEATHER-ATTENTION-RELEASE.md. Existing provider returns the latest retained observation, not a complete history of every SPECI between refreshes.
