# AviLog Preview Implementation Plan

> For agentic workers: use superpowers:executing-plans inline. User has requested implementation and deployment directly.

Goal: deliver a usable PWA preview, GitHub source and Railway URL.
Architecture: independent UTC domain/parser/rules modules, IndexedDB browser storage, responsive vanilla frontend, Node weather adapter/static server.
Tech stack: Node 22, ES modules, PDF.js 5.6.205, Tesseract.js 7.0.0.
Spec: docs/superpowers/specs/2026-10-15-pilot-logbook-design.md

## Global constraints
- UTC canonical; Scheduled separate from Actual; preserve confirmed Actual on import.
- No company credentials, sensitive sample crew, real payments/ads or invented FTL limits.
- All imports previewed and editable; browser-local storage explicitly disclosed.

## Review focus
- Midnight crossings and invalid chronology: domain tests.
- Reimport schedule changes and duplicate rows: merge tests.
- Unknown PDF/OCR layout: parser returns review/error, no auto-save.
- Invalid backup or full storage: reject atomically and retain previous state.
- Narrow iPhone screen: browser QA at 390px.

## Task 1: Domain and import invariants
Files public/lib/domain.js, parsers.js, rules.js, sample.js; tests/domain.test.js.
- [ ] Write tests for timestamps/durations, imports, parser and rules, run RED.
- [ ] Implement interfaces normalizeEvents(date, clocks), mergeRoster(existing, incoming), parseRoster(text, month), parseAircraft(text, family, date), statistics(flights), evaluateRules(duties, ruleset).
- [ ] Run node --test; commit domain implementation.

## Task 2: Browser workflow
Files public/index.html, app.js, style.css, lib/storage.js, manifest.webmanifest, sw.js.
- [ ] Implement calendar/list, actual editor, crew, stats, duty and import review.
- [ ] Add browser-local IndexedDB, backups, reminder evaluation, cached shell.
- [ ] Verify mobile/desktop, CRUD and actual protection.

## Task 3: Hosting and release
Files server.js, lib/weather.js, Dockerfile, railway.json, package.json, README.md.
- [ ] Test health/static path restrictions/weather validation; implement server.
- [ ] Commit repository, publish to authorized GitHub account, deploy Railway.
- [ ] Review full change, fix important findings, smoke test deployed URL and record limits.
