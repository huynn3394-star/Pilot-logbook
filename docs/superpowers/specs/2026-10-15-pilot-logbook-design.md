# AviLog preview design

Purpose: a personal, mobile-first pilot logbook to review roster, capture actuals and inspect totals before supplying Vietnam Airlines FTL rules. The user authorized implementation, repository creation and Railway deployment in the same request.

## Architecture
Buildless ES modules and CSS, served by Node 22. IndexedDB stores one private workspace per browser, including attachments; no login, cloud sync or company credentials. Export JSON for transfer/backup. No database needed for this preview. Node backend exposes a cached, timeout-limited Aviation Weather Center METAR/TAF adapter. Dependencies: PDF.js and Tesseract.js for client-side PDF extraction and image OCR. Aircraft parser registry is separate from UI. PWA manifest/service worker caches the shell, never weather API responses.

## Data and invariants
UTC ISO datetimes are canonical. Scheduled and Actual are independent. Actual event order is OUT <= OFF <= ON <= IN; explicit dates handle crossings. Airborne OFF→ON; block OUT→IN. Pilot-in-command time, SIC, role PF/PM, takeoff/landing by, manual/autoland, night minutes, source, confidence, note, attachment and crew IDs are saved. Imports use date + normalized flight number as identity; route/time changes appear in preview and update Scheduled only. Actual is never altered by roster import. Actual replacement requires explicit review; incomplete/invalid actuals cannot be confirmed. Night is manually entered pending a validated astronomical calculator. Duty report/release is explicit and supports cross-date activities, including non-flying types.

## UX
Five tabs: Lịch bay, Logbook, Crew/People, Statistics, Settings. Desktop sidebar and mobile bottom nav. October 2026 sample month clearly labelled demo, sourced only from request; sample people fictional. Search/filter calendar/list; select day; add/edit flights, actuals, crew and duty. Import wizard extracts text from PDF or image locally, lets user correct raw text and rows, then explicitly confirms. PDF parser supports normalized date/flight/route/time rows; unknown layouts remain unrecognized, never silently fabricated. A320/A321 OCR supported with manual correction; B787/A350 registered as manual-review-only. AOC sample can be loaded explicitly. Backups validated and merged without overwriting confirmed actual. CSV export uses formula-injection escaping.

## Reminders, weather and rules
In-app reminders for tomorrow, report lead time and missing actual; browser notifications only while app is running, opt-in. No claim of closed-app push delivery. Settings save preferences and explain iOS constraints. Weather reports raw observation/forecast, retrieval time and failures; situational awareness only. FTL engine accepts versioned rules with source/effective dates and green/yellow/red severity; unconfigured rules return unknown and never green compliance. Source dialog explains no Vietnam Airlines rules are installed.

## Acceptance
Node tests cover overnight VN0343, sample A320 durations, invalid times, import dedupe/changed schedule/actual protection, parsing and statistics isolation of scheduled data. Browser checks cover CRUD, preview-before-save, persistence, responsive overflow, backup/restore and service worker. Deploy smoke test covers root, assets, health and weather validation. Real monthplan.pdf is absent in synced sources; supported normalization is documented and UI offers manual correction. Full FTL, payment, ads, cloud accounts and background push are deferred.
