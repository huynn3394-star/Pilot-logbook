# Security and CI fixes — 31 October 2026

Base: `bbc62b42fb5be1265044779353f88d211a05e2c7` on `main`.

## Changes

- MET Office login and feed requests require HTTPS at the fixed source origin.
  The provider rejects HTTP and other origins before issuing a request, and blocks
  redirects to them. Certificate verification remains the native Fetch default.
  A TLS/provider failure uses the existing NOAA fallback; no credential is sent
  over HTTP. Existing HTTP provenance remains readable in saved records/backups.
  HTTPS availability at the actual MET Office endpoint has not been established;
  until it serves a valid certificate, NOAA supplies the available products.
- Upgrade tests use checked-in historical validators from reachable original
  commits instead of unavailable abbreviated Git objects. The tests still assert
  rejection by old readers, retention of pending edits, and successful replay
  after upgrading. Snapshots and provenance are in `tests/fixtures/weather-readers/`.
- `.github/workflows/ci.yml` runs for every pull request, pushes to `main` and the
  fix branch, and manual dispatch. Unit/build/audit, Firebase emulator rules and
  browser regression jobs fail on errors. No baseline failure allowlist or
  `continue-on-error` is used in this workflow. It does not deploy anything.
- PDF.js updates from 5.6.205 to 6.4.299. Core text extraction remains local;
  eval/scripting are disabled, and the importer destroys the loading task in a
  `finally` block, including page-limit and load failures, for the new API.
- Scoped dependency overrides pin gRPC 1.14.5, gaxios's uuid 11.1.1 and Pub/Sub's
  OpenTelemetry Core 2.8.0. Compatible lockfile updates also patch body-parser and
  fast-uri. Firebase itself stays at 13.0.0. Emulator transactions exercised the
  updated gRPC path; the CLI and Pub/Sub construction smoke check passed.
- Rebuilt the checked-in Firebase browser bundle, its source hashes and the
  service-worker SDK fingerprint (`80c44a81f174`). ATPL questions, answer keys,
  source images and scoring data were not edited.
- Test synchronization fixes wait for two actual evidence workers instead of a
  fixed number of event-loop turns, and select navigation for the current viewport
  after shared CSS is ready. Assertions were preserved. The PDF race fixture now
  models the loading task's cleanup method.

## Verification completed locally

Environment: macOS ARM64, Node 24.22.1, Java 21, locked dependencies installed with
lifecycle scripts disabled. Synthetic guest/demo data only; no production account
or private records were used.

| Check | Result |
| --- | --- |
| Account SDK build | Passed |
| Clean locked install, offline npm cache | Passed |
| Node unit/API tests | 275 passed, 0 failed, 0 skipped |
| ATPL Firestore rules/transactions | 12 passed |
| Workspace Firestore rules/transactions | 18 passed |
| Evidence Storage rules | 4 passed |
| npm audit, all dependencies | 0 advisories reported |
| npm audit, production only | 0 advisories reported |
| Real PDF.js module and worker | Chromium and WebKit passed text extraction, 60-page rejection and subsequent import |
| Visible flight-scan shortcuts | 18 Chromium/WebKit scenarios passed |
| Shared interface and offline shell | 250 Chromium/WebKit scenarios passed |
| ATPL offline regression | Both engines opened/graded all 6,426 questions, verified source imagery/backup and preserved logbook IndexedDB |
| Upgrade tests in an archive without `.git` | 2 passed |
| Previously flaky evidence concurrency test | 10/10 repeated runs passed |

Detailed browser interface/ATPL results are recorded under the ignored
`test-results/` folder. The ATPL harness waits for initial shell installation
before its first navigation; it still verifies a controlling worker and refuses
uncached origin requests during offline checks. A passing local check does not claim a hosted CI run,
Docker build, physical iPhone/iPad acceptance, live Google OAuth or Railway
deployment. Firebase rules, project configuration and feature flags were not
changed by this fix.

## Release considerations

Use the normal build before deploying; old loaded clients may reject new HTTPS
weather provenance until they reload online. Keep site data and downloaded banks.
Do not clear IndexedDB or change the application's origin. The old HTTP URLs in
saved records remain supported.

Dependency advisory references:

- [Mozilla PDF.js](https://github.com/mozilla/pdf.js/security/advisories/GHSA-hq66-cqwq-w95j)
- [gRPC](https://github.com/grpc/grpc-node/security/advisories/GHSA-m9gg-hp2v-232j)
- [OpenTelemetry](https://github.com/open-telemetry/opentelemetry-js/security/advisories/GHSA-8988-4f7v-96qf)

Audit results describe the registry's advisory state at the time of verification;
they are not a guarantee against future or undisclosed vulnerabilities.
