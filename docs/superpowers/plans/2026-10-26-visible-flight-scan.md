# Visible Flight Log shortcuts implementation plan

> Execute inline using hosted CI; the local container and Python return ClientError. No independent subagent runner is available.

Goal: make Scan Flight Log discoverable directly on every saved flight in Schedule and Logbook, retaining the existing detail-page scanner.
Architecture: add two target-bound buttons to the existing dayPanel()/flightTable() renderers, reusing data-action=image/data-id and the unchanged imageImport(targetId), preview and save flow. Add narrow CSS and a new static-shell version. No additional OCR provider, event dispatcher or DOM observer.
Tech stack: existing vanilla JavaScript, CSS, node:test, Playwright, GitHub Actions.
Spec: user's request to make the per-flight scanner visible, followed by approval to implement.
Baseline: 929152a101405f8d2093faacb068b8a6d98a9f38; isolated branch fix/visible-flight-scan-2026-10-26.

Constraints: preserve Navy/Teal and system font; no Firebase/Variables/schema/provider/ATPL changes. No auto-save, no record re-keying, no FINAL bypass, no user data reset. Keep existing detail and global scanner entries.
Review focus: mobile table horizontal scrolling (button goes in first column); two flights with different IDs; FINAL vs DRAFT; cancel and mismatch; stale/offline shell.

- [ ] Add renderer contracts and observe missing shortcut failures on baseline.
- [ ] Modify the two view templates, add token-based 44px controls, bump shell cache and test expectations.
- [ ] Run contracts, full unit suite and real browser checks for both themes and mobile/tablet/desktop, target matching, cancellation, no duplicate/save, and offline entry.
- [ ] Run existing per-flight and shared UI/weather regressions; retain documented historical-fixture failures visibly.
- [ ] Review exact tested diff, remove temporary CI transformation/write job, promote with expected-head lease, verify existing Railway deployment.
