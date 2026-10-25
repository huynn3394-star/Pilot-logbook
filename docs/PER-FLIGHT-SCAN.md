# Per-flight Flight Log import — 25 October 2026

## Delivered interaction

Open an existing flight from Schedule or Logbook. In its Log tab, the camera button `Nhập ảnh Flight Log` appears under DEP/DEST and immediately above Actual times. It opens the existing local Smart Scan V2 importer with the saved flight's number, route and UTC date displayed. Date and aircraft family are prefilled (A321 maps to the A320 family).

The scan is bound to that record's ID and original edit capture. Preview uses the existing parser, comparison and save workflow. The same record is updated only after the user reviews and explicitly saves. A missing target or number/date mismatch is rejected rather than falling through to creating another flight. A cancel/back button returns to the same saved flight. The global image-import entry remains available.

New unsaved flights show a save-first explanation. An edited form, selected evidence file or unsaved scan review is not discarded by opening another scan: the action requests that the user save first, leaving the form intact. Existing FINAL replacement consent and revision reason are still required. Scheduled, crew, saved registration, notes and existing evidence handling are retained by the unchanged review/save logic.

No new OCR provider, data schema, Firebase rule, permission, dependency or paid API is introduced. Navy/teal, system fonts, Compact styling, Weather SPECI/highlights, original ATPL data and the underlying parser are unchanged. The service-worker cache version gains `-flight-scan`; ATPL/OCR caches and private storage are not cleared.

## Verification evidence

Baseline: `f65d73f467a10b4a6865ed8acefc12febf0577ae`.
Exact tested application source: `d65fdbc0917dacb2b101cad1cd0b57db889dbdf5`.
Hosted run: https://github.com/huynn3394-star/Pilot-logbook/actions/runs/40174506767

- Build and four per-flight unit-contract tests passed.
- Full unit suite: **262 passed / 264 total / 2 failed / 0 skipped**. Failures remain visible: `v4 rejects extended preferences without acknowledging pending edits; v5 replays the original reminder edit and keeps watchlist` and `v5 requires reload for grouped preferences while v6 still accepts flat v5 data`, requiring absent historical commits `15bb922` and `5a47d5a`. No additional failure was observed.
- **12 per-flight browser scenarios passed**, errors `[]`, across Chromium/WebKit, light/dark, and 320/390/820 px. They exercise action placement, date/family/record binding, dirty text and evidence protection, cancellation, number/date mismatch, preview without saving, correct-record update without duplication, FINAL replacement consent, invalid targets and the global importer.
- **250 shared-interface**, **18 Flight Detail/color/offline**, and **12 Weather attention** browser scenarios passed; **292 browser scenarios total**.
- Protected source-file diff against baseline passed. The exact verified UTF-8 source was packaged with SHA-256/byte-length checks before creating candidate Git objects.
- Verification ZIP: `avilog-flight-scan-checks`, artifact `12591054208`, **4211715 bytes**, SHA-256 `0be9c9c670e19a9e92ab820357c6c6aaf8db97b4095c0923d7fb8a223c932cc8`.

Tests use synthetic local guest records and OCR text to exercise parsing/review/save; they do not establish camera hardware behavior, real-photo recognition accuracy, physical iPhone/iPad operation, or live Google/Firebase sync. Review was inline because no independent reviewer was available. Light and dark screenshots were inspected.

## Release

The release wrapper removes the temporary source-transform helper and write-scoped candidate job, returns CI to direct read-only testing, and adds documentation. Application source stays byte-for-byte as tested. Promote with an expected-head lease only into the existing Pilot-logbook main branch. Keep the current Railway pilot-logbook / avilog-preview / preview service, hostname, Variables and Firebase unchanged.

After deployment succeeds, save unfinished work and reopen AviLog online. Do not clear website data or downloaded ATPL banks. A newly created flight must be saved before its per-flight scan button is available.
