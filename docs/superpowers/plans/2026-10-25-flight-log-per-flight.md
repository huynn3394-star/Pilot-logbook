# Per-flight Flight Log import implementation plan

Goal: expose the existing image/OCR import directly inside each saved flight's Log tab, beside Actual times, without returning to the global importer.
Baseline: f65d73f467a10b4a6865ed8acefc12febf0577ae. Isolated branch: feat/flight-log-per-flight-2026-10-25.

## Design and constraints
- Reuse imageImport(targetId), Smart Scan V2, parseAircraft, prepareScanDraft and existing review/save. No new provider, schema or cloud permission.
- One camera action in each saved DRAFT/FINAL; unsaved flights explain saving first. Preserve global import.
- Prefill the saved UTC date and aircraft family and display number, route and date.
- Protect edited forms, unsaved scan reviews and selected evidence: require explicit saving before opening another scan.
- Bind preview/cancel to the selected saved record. Reject missing targets and number/date mismatches; do not guess absent identifiers or create a duplicate.
- Preserve the original form-capture/base across editor, importer, review and cancel. Existing FINAL replacement consent and reason remain mandatory.
- Preserve parser, stored data, ATPL, Weather, fonts, colors, layout, Firebase and dependencies.

## Completion ledger
- [x] Read live source; create isolated branch and render/parser-preservation tests.
- [x] Add the target-bound action and guarded navigation, preserving capture and the existing scan/review/save flow.
- [x] Hosted run 40174506767: four feature unit contracts pass; 262/264 full unit suite passes. Only the two known missing-history-commit tests fail.
- [x] Twelve per-flight browser scenarios and 280 existing shared/flight/weather scenarios pass on Chromium/WebKit; no errors in the JSON reports.
- [x] Verify protected-file diff, exact candidate hashes, and final source diff; inspect light/dark screenshots. Review inline, no independent reviewer available.
- [x] Remove temporary transform and write-scoped CI candidate machinery; keep exact tested production bytes and document evidence in docs/PER-FLIGHT-SCAN.md.
- [ ] Promote release with expected-head lease and verify the existing Railway deployment; report actual deployment status, not an assumed result.

Ruling: reuse the importer instead of embedding a second OCR engine or redesigning the editor. Flight Log camera/OCR accuracy and physical devices are outside the synthetic browser validation and must not be claimed as tested. No user records or live Firebase settings are changed by these tests.
