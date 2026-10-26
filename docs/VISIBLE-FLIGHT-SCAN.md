# Visible Flight Log scan shortcut — scope and verification plan

Baseline: 929152a101405f8d2093faacb068b8a6d98a9f38.
User approved making Flight Log import discoverable directly from individual flights.

Design: add a labelled Scan Flight Log button to each Schedule day card, above its existing footer. Add the same button to the first Logbook table column under the flight number, so it is not buried in the far-right edit column. Keep the detail-page scanner and global import.

Ruling: use a small scoped presentation adapter, following the existing weather-report-highlights module pattern, instead of rewriting app.js. It copies the existing edit control's record ID and delegates to the existing image action. It never reads account credentials, creates flight records, changes parsers or writes user data. It observes only the main app container, not modal drafts, and does not duplicate controls after refresh. Empty and filtered lists follow existing rendering.

No changes to Navy/Teal, system typography, FINAL permission/reason, image review, weather controls, Firebase or ATPL. New module/style are included in the versioned offline shell; existing data and ATPL/OCR cache namespaces are preserved.

TDD: original source-rendering tests exposed missing list/card shortcuts in run 40256998775. Adapter contracts observed three expected missing-feature failures in run 40258236012. Real mounted browser tests must cover placement, correct record identity, keyboard operation, no duplication, filters, cancel, mismatch, preview without save, FINAL, and offline entry on Chromium and WebKit.

CI is read-only: no job may create commits, move references or deploy. Apply production edits through scoped GitHub actions, verify before promoting main. Local runtime remains unavailable (ClientError). No physical-device, camera or live-cloud result is assumed.
