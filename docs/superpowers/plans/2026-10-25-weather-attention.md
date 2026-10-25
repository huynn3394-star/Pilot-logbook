# Weather attention implementation plan

Goal: show SPECI for every airport in saved Weather groups at the top, even collapsed, with a red attention panel; highlight TSRA and CB independently in all rendered weather reports.
Base: 073ec63a763e5ef67936aad9f86d37164b1ab025, existing AviLog project.
Architecture: pure escaped text renderer + pure saved-group SPECI projection; integrate existing Weather view, and a narrowly scoped observer for the existing flight-weather modal. Do not modify stored reports, providers, refresh cadence, account data, ATPL or Firebase.
Ruling: saved file means the saved airport groups/watchlist in the existing Weather tab. Keep manually arranged groups unchanged, duplicate eligible airports in a top summary only, deduplicated across groups. Do not reorder saved data.
Ruling: SPECI note reflects the currently retained observation. An ordinary METAR replacement removes it; offline/stale/error states keep it with explicit UTC/age labels and a button opening the original report. This is attention styling, not a hazardous-weather or validity certification.
Ruling: TSRA and CB each qualify on their own. Match intensity/recent/vicinity TSRA tokens and cloud suffix CB, not arbitrary station substrings. Preserve every original character and escape HTML.

- [x] RED: 13 local tests failed before the new module existed. The weather-report/UI files used locally were matched by Git blob hash to the current source, not published from an old archive.
- [x] GREEN: 13 local tests passed for keyword boundaries, HTML escaping, whitespace, SPECI/COR header, saved groups, deduplication, stale/offline/old anchors, replacement and removal.
- [ ] Hosted browser test real DOM interactions, all report views, red contrast, 320/390/820px light/dark, offline labels and raw-text equality; unit suite, shared-UI/flight regressions and protected-file diff.
- [ ] Inline review and evidence report, recheck main before fast-forward; verify existing Railway deployment. No independent reviewer available.

Reference verified 25 October 2026: NOAA Aviation Weather Center, https://aviationweather.gov/help/data/ (METAR/SPECI, TS/RA weather groups and CB cloud type). Highlighting is literal attention markup, not a replacement for the source briefing. Existing provider returns the latest retained observation, not a complete history of every SPECI between refreshes.
