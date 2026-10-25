# Per-flight Flight Log import implementation plan

Goal: expose the existing image/OCR import directly inside each saved flight's Log tab, beside Actual times, without requiring navigation back to the global Logbook importer.
Baseline: f65d73f467a10b4a6865ed8acefc12febf0577ae. Work isolated on feat/flight-log-per-flight-2026-10-25.

## Design and constraints
- Reuse the existing imageImport(targetId), Smart Scan V2, parseAircraft, prepareScanDraft and review/save flow. No new OCR provider, data schema or cloud permission.
- Render one camera action in each saved flight (DRAFT or FINAL). New unsaved flights explain that the flight must be saved first. Preserve the global import entry.
- Prefill the target flight's UTC date and aircraft family, and display its flight number/route/date prominently.
- Block opening the importer from an edited or unsaved scan-review form; preserve all unsaved fields and any selected evidence image. The user explicitly saves first.
- Bind preview and cancel to the selected saved record. Missing/deleted targets must never fall through to creating a new flight. Number/date mismatch remains an error; missing identifiers are not guessed.
- Preserve the original form-capture/base across editor -> import -> review (or cancel), so existing conflict detection stays effective. No autosave; FINAL replacement still requires existing consent and reason.
- Keep the original parser, confirmation logic, ATPL, weather, font/color/layout, Firebase and dependencies unchanged.

## Tasks and verification ledger
- [x] Read relevant live source and create an isolated branch; add render contract and parser-preservation unit tests.
- [ ] Observe those tests fail on the unchanged source (no action exists).
- [ ] Apply narrow fingerprint-checked source edits to app.js and flight-editor.js; bump shell suffix and corresponding cache expectations.
- [ ] Hosted Chromium/WebKit tests: 320/390/820px, both themes, target identity/date/family, dirty fields and evidence, cancel, mismatches, preview without save, correct record update, FINAL protection and global import.
- [ ] Run full unit suite and regression scripts for shared interface, Flight Detail and Weather. Report the two known history-fixture failures rather than hiding them.
- [ ] Review exact tested diff, package evidence, and promote with expected-head lease only after new feature/regression checks pass. Existing Railway project/service only.

Execution note: the local terminal returns ClientError. Use the repository's hosted CI to run real tests. Temporary candidate generation may create Git objects for the allowlisted tested source only; it must not move any branch or deploy. Remove temporary write-scoped workflow machinery before release. No independent subagent reviewer is available; final review is inline and reported as such.
