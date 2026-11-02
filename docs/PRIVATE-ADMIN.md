# Private AviLog administration

The owner dashboard is `/admin/`. Its HTML is a public sign-in screen; every statistics API request is authenticated and authorized independently on the server. Opening or guessing the URL never grants access.

The dashboard covers approximate active browsers in 5/30 minutes, unique browsers today/7/30 days, daily users/page views, feature usage, device categories, tab sessions, weather-request and browser/server errors, deployment status and CSV export. It links to the existing Firebase, Railway and GitHub management pages; those services still apply their own permissions. It does not provide other users' flight records, source images, quiz answers, credentials or private account contents.

## Activation

1. Confirm the owner's Google email. Set `AVILOG_ADMIN_EMAILS` on the existing Railway service; this value is server-only and is not returned by public configuration.
2. Attach a private persistent Railway volume at `/data`. The database goes in `/data/avilog-admin/avilog-usage.sqlite`; Railway provides `RAILWAY_VOLUME_MOUNT_PATH` automatically. Do not store it under `public/` or use ephemeral container storage. Existing Firebase accounts and workspace/evidence flags are unchanged.
3. Set `AVILOG_ADMIN_ENABLED=true`. A missing owner, Firebase login configuration or persistent Railway mount keeps the admin API and collection disabled. No default owner, URL token or shared password is supplied.
4. Deploy, sign in at `/admin/` with the confirmed owner account, and verify a second account receives HTTP 403. A separate browser visit should appear as a visitor; visiting `/admin/` itself is excluded.

Volumes have usage-based Railway storage charges. This feature uses an approximately 80 MiB SQLite page limit and 90-day retention; obtain the owner's approval for new billed storage before provisioning if not already authorized. No Google Analytics, advertising service, new Firebase project, service-account key or public Firestore write rule is needed.

## Authentication and privacy

- The browser uses the existing Google/Firebase login and sends a short-lived Firebase ID token in the Authorization header. The server checks the project/issuer/expiry, verifies the token with the fixed Firebase Auth `accounts:lookup` endpoint, and requires an active, verified Google account matching the owner allowlist. Claimed email or client UI state alone never authorizes access.
- Admin responses and assets have `no-store`; all API requests bypass the existing offline worker. Sign-out/account switching clears the dashboard and discards pending responses. No admin statistics are written to browser storage.
- Visitors are approximate browser counts, not a list of people or an account census. First-party random browser/tab identifiers are HMAC-hashed before storage. Events accept only a fixed schema: opaque IDs, an event kind, a feature identifier and a device category. The collector does not accept arbitrary URLs, messages, emails, answers or flight data. Do Not Track is respected; offline, blocked and older cached clients can be absent.
- Public event writes require the exact same origin, JSON, bounded bodies and enum values. Event IDs deduplicate delivery; per-browser and service rate limits bound ingestion. Statistics are still approximate and can be affected by automated traffic or identifier resets.
- Data is private on the Railway volume. The container entry point prepares only the private subdirectory using a no-follow directory descriptor, drops supplementary groups and root privileges, then imports the application. The web process runs as UID/GID 1000. The private directory is 0700 and the database is 0600.
- SQLite persists across container replacement; events deduplicate for seven days and usage aggregates expire after 90 days. Data begins at activation and is not reconstructed for earlier periods. Logs contain neither ID tokens nor event bodies.

## Verification

`node --test tests/admin.test.js` checks owner authorization, forged/foreign/expired tokens, unverified/disabled/non-Google accounts, private headers, public-event validation, deduplication, Vietnam-midnight bucketing, persistence and retention.

`node scripts/verify-admin.cjs` uses synthetic Google identities on a local server, Chromium/WebKit and 320/820/1440 px. It checks owner/member gating, sign-out clearing, safe rendering, chart/CSV, anonymous usage, tab changes, Do Not Track and overflow. It does not prove real Google OAuth.

`bash scripts/verify-admin-container.sh` builds the actual Docker image, verifies the application PID runs without root, writes a synthetic usage record as UID 1000, replaces the container and verifies the record on the named test volume. It never mounts production storage.

Relevant platform references: [Firebase Auth get user data](https://firebase.google.com/docs/reference/rest/auth#section-get-account-info), [Railway volumes](https://docs.railway.com/volumes).
