# Private AviLog administration

The owner dashboard is `/admin/`. Its HTML is a public sign-in screen; every statistics API request is authenticated and authorized independently on the server. Knowing the URL never grants access.

The dashboard covers approximate active browsers in 5/30 minutes, unique browsers today/7/30 days, daily users/page views, feature/device usage, tab sessions, browser/server/weather-request errors, deployment status and CSV export. It links to the existing Firebase, Railway and GitHub management pages; those services retain their own permissions. It does not provide other users' flight records, evidence, quiz answers or credentials.

## Activation and chosen storage mode

The owner explicitly chose not to add a paid storage volume. Use the existing service with:

- `AVILOG_ADMIN_ENABLED=true`
- `AVILOG_ADMIN_EMAILS=` the Google email confirmed by the owner, server-only
- `AVILOG_ADMIN_MEMORY_ONLY=true`

Google/Firebase login must already be configured. Missing owner or login configuration keeps the admin API and collection disabled. There is no default owner, URL token or shared password. No volume, database service, Google Analytics setup, Firebase permission change or service-account key is created. The Docker image continues to run as the non-root `node` user.

**Statistics are temporary.** SQLite uses `:memory:` and starts empty after a server restart or new deployment. The dashboard displays this warning prominently and identifies the exact start time. The 7/30/90-day views include only data collected since that start; dates before collection show an unavailable marker instead of a misleading zero. CSV export lets the owner retain aggregate snapshots. No historic traffic is reconstructed. The 90-day retention window is a maximum within the current process, not a durability promise.

## Authentication and privacy

The browser reuses the existing Google/Firebase login and sends a short-lived Firebase ID token only in the Authorization header. The server checks project/issuer/expiry, verifies the token with the fixed Firebase Auth `accounts:lookup` endpoint, and requires an active, verified Google account matching the owner allowlist. Claimed email or client UI state alone never grants access.

Admin responses and assets have `no-store`; all API requests bypass the offline worker. Sign-out/account switching clears the dashboard and discards pending responses. Statistics and tokens are not written to browser storage by the admin page.

Visitors are approximate browser counts, not a list of people or an account census. First-party random browser/tab identifiers are HMAC-hashed before storage. Accepted event fields are opaque identifiers, a fixed event kind, a fixed feature and a device category. No arbitrary URL, message, email, answer, IP address or flight data is collected. Do Not Track is respected; offline, blocked and older cached clients can be absent. Actual rendered tab changes are observed; canceled navigation is not counted as a feature opening.

Public event writes require the exact same origin, JSON, bounded bodies and enum values. Event IDs deduplicate delivery; per-browser/service rate limits bound ingestion. The SQLite page limit is approximately 80 MiB. Counts remain estimates and can be affected by automated traffic or identifier resets. Logs contain neither tokens nor event bodies.

## Verification

- `node --test tests/admin.test.js`: owner/member authorization; forged/foreign/expired tokens; unverified/disabled/non-Google accounts; private cache headers; bounded event validation; duplicate delivery; Vietnam-midnight bucketing; memory reset; unavailable history; and optional store persistence/retention.
- `node scripts/verify-admin.cjs`: synthetic local Google identities, Chromium/WebKit, 320/820/1440 px; owner/member gating, logout clearing, safe rendering, chart/CSV, warning banner, anonymous usage, actual tab changes, Do Not Track and overflow. This does not prove real Google OAuth.
- `bash scripts/verify-admin-container.sh`: actual Docker image, application PID running as UID 1000, routed/protected admin API and anonymous collection without a volume. No production login or data is used.

Reference: [Firebase Auth get user data](https://firebase.google.com/docs/reference/rest/auth#section-get-account-info).
