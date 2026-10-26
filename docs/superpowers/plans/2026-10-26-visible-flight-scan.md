# Visible Flight Log shortcuts implementation plan and verification ledger

Goal: expose `Scan Flight Log` directly on each saved Schedule card and under each Logbook flight number, retaining the existing detail-page/global scanners.
Baseline: `929152a101405f8d2093faacb068b8a6d98a9f38`; isolated branch `fix/visible-flight-scan-2026-10-26`.

Architecture: a small idempotent presentation adapter observes the existing main app container, adds labelled target-bound controls and delegates to the unchanged data-action=image handler. It does not modify app.js, modal drafts, parsers or storage. This replaces the initial plan to edit the large dayPanel/flightTable templates. New token-based CSS and a static-shell suffix provide styling/offline availability.
Tech stack: existing JavaScript/CSS, node:test and Playwright; read-only GitHub Actions for verification. Source writes and branch promotion use scoped connector actions, not runner tokens.

Constraints: keep Navy/Teal, native system fonts, FINAL permissions, explicit review/save, target identity, user data, weather behavior, Firebase rules/Variables, dependencies and ATPL untouched. No new OCR provider or automatic saves.
Review focus: first-column visibility on small screens, DRAFT/FINAL targets, cancellation/mismatch, no duplicate controls after render, filtered/empty lists, and cached offline entry.

- [x] Observe adapter contracts fail for missing functionality on the unchanged runtime (run 40258236012).
- [x] Implement presentation-only target-bound buttons, 44px touch controls, index loading and versioned precache.
- [x] Run 4 contracts and full unit suite: 269/271 pass, only the 2 documented baseline history-fixture failures.
- [x] Run 18 new Chromium/WebKit scenarios across both themes and mobile/tablet/desktop, including offline entry.
- [x] Run 250 shared UI, 12 Weather-view and 12 Weather-attention regressions; all pass.
- [x] Verify core app, parser, private data, font/theme, weather-provider and ATPL files unchanged; review the runtime diff inline.
- [x] Record exact tested head, evidence and limitations in docs/VISIBLE-FLIGHT-SCAN.md. Final run: 40259967385, head 3f129455eccb2143e79b34bfaf96474216aeccdf.
- [ ] Promote with expected-head lease and verify the existing Railway deployment; this result is reported separately after the release commit.

Local container/Python execution was unavailable (ClientError), so tests ran on hosted CI. No independent reviewer or physical iPhone/iPad test was available. Runtime source is unchanged since 7cc1aa026e575401045b82ce51154e177cd2fc81; subsequent changes synchronize tests with the real modal close lifecycle, menu layout and CSS readiness without weakening data, visibility or offline assertions.
