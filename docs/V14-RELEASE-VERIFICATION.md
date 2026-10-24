# AviLog V14 release verification — 2026-10-24

Input: AviLog_V14_FULL_REDOWNLOAD_2026-10-24.zip, 253522692 bytes, SHA-256 `7378279fe149e049644193b8d80f9b75d33642d7510a1a02831d5751e455d94b`. All 293 archive entries passed CRC. Integrated onto main `459f7f6157a7b8751feb7e31e2ea7eff3d9289dc` in an isolated branch. The source archive is preserved separately.

## Data preservation

69 original ATPL bank/catalog/identity/media files (362014055 bytes) match their baseline SHA-256 hashes. Questions, answer keys and scoring were not edited. No browser storage, production workspace, photo or progress record was cleared. The owner confirmed full photo/logbook and ATPL progress backups before release.

Independent review found three release blockers. Regression tests reproduced them before fixes: roster must preserve operational fields/history after reopening FINAL; new V14 roster entries must leave blank SIC unknown; legacy backup must not erase explicit draft logbook metadata. The fixes cover guest/account persistence, flag-off edits/import/archive/restore, and conflict selection. Crew suggestion selection also no longer silently discards an unsaved form. New unit regressions failed before the fixes, then passed. The editor regression reproduces crew selection through the actual component.

## Fresh local results

- Node unit/API tests: 237/237, zero skips.
- Focused V14 tests: 52/52.
- ATPL Firestore rules: 12/12.
- Workspace Firestore rules/SDK transactions: 18/18.
- Evidence Storage rules: 4/4.
- Actual editor component checks: 53 regression + 37 V14 flows + 5 compact layout variants.
- Chromium and WebKit workspace emulator E2E passed after persistence fixes: same/different UID isolation, exact image bytes, offline reopen, independent merge/Actual conflict, lost acknowledgement and native IDB transaction abort, multipart backup integrity, async UID guards, 10000-flight scale/archive/reassignment.
- Additional Chromium and WebKit V14-enabled bundled-SDK emulator tests passed: offline native IDB preserves unknown SIC, explicit times and history; two devices exchange history; flag-off changes queue no writes and retain data.
- Native storage/recovery browser tests passed on Chromium and WebKit.
- Actual v5-to-V14 service-worker upgrade passed on Chromium and WebKit: the controlling worker acknowledges the build-specific V14 version before network removal; bookmark/progress/bank/source image/weather and pending operations survive offline cold entry.
- Firebase SDK rebuilt with the locked dependencies; runtime bundle/source guard passed. Manifest workspace contract is 14. SDK SHA prefix: da75c65e901d.

The old upgrade harness expected v10 and failed its controlling-worker check; it now checks the exact V14 SDK version from the build manifest. The compact-layout harness accepts CHROMIUM_PATH on macOS. No assertion of offline activation was removed.

## Limits and release order

These are synthetic emulator/browser checks, not a new real Google OAuth or physical iPhone/iPad acceptance test. No Docker runtime is installed locally; Railway must confirm the actual Dockerfile build, bundle generation and healthy startup. Deploy code with V14 off, publish the tested rules to avilog-atpl, then enable V14 only after the build and health checks pass. Keep avilog.up.railway.app and the existing project/service/bucket. Do not roll back to a V13 validator/rules after V14 data exists; flag-off preserves V14 data read-only.

History is application history with device timestamps, not a certified/tamper-proof audit ledger. The existing rules preserve earlier audit-entry membership; direct same-UID clients could reorder entries, although the normal client rejects that. This minor review finding is deferred rather than claiming stronger certification.

Locked dependencies retain npm audit advisories. Reviewed runtime paths: the pdfjs advisory requires the viewer scripting path, while this app uses core text extraction with isEvalSupported false; no viewer/scripting manager is shipped by the app. The grpc advisories concern server paths; this app runs an HTTP server, not a gRPC server. No reachable exploit was demonstrated in these paths, and no unrelated major dependency upgrade was made. This is a scoped release check, not a complete security audit.

Actual deployment/rules/activation identifiers and public smoke evidence are recorded in the external release ledger after publication.
