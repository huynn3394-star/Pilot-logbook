# Weather folder selector and quick search

> Execution: inline with hosted CI because the local container and Python return ClientError.

Goal: one METAR/TAF quick-view switch per saved folder, and a saved-airport search field on the same toolbar row as Update all. Preserve Navy/Teal, fonts, SPECI and TSRA/CB warnings.
Baseline: 1624bc0ac166bda7c79de2397aed8f42374c60a1.

Design: METAR/SPECI is the default quick preview. An explicit TAF selection affects every airport in that folder only; expanded station details still contain both original products. Missing selected products say so instead of substituting a different product. Selectors and search are transient, account-scoped view state, retained across refresh/re-mount but not synced or persisted in user records. Search matches partial ICAO and the exact IATA aliases already supported by AviLog; it is not an external airport lookup.

Search filters existing station nodes, temporarily reveals matching collapsed folders, restores collapse state when cleared, and performs no data/provider writes. The top SPECI list always considers all saved airports. Activating its link clears a blocking search and reveals the station. Sorting and membership controls still use complete original group indices.

Files: public/workspace/weather-watch-ui.js (helpers, controls, view state), public/ui/weather-attention.css (compact controls), public/sw.js (cache version only), corresponding tests and browser verification. No changes to schemas, Firebase, provider/parsers, Logbook, ATPL or font/color tokens.

- [ ] Observe new unit tests fail on unchanged baseline.
- [ ] Implement helpers/controls and cache update.
- [ ] Verify unit tests and real mounted UI on Chromium/WebKit, light/dark, 320/390/820px.
- [ ] Verify folder independence, missing products, stable typing focus, search clearing and collapse state, SPECI escape from filters, no source mutations and no horizontal overflow.
- [ ] Run full unit suite and existing shared UI, per-flight scan, Weather/SPECI/offline regressions. Report existing two history-fixture failures by name.
- [ ] Inspect diff and screenshots, promote via expected-head lease, then verify existing Railway service. No new project or credentials.
