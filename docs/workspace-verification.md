# Whole-app account verification

Run with Node 24 and the pinned, task-private dependencies:

```sh
npm run test:workspace-all
```

The runner checks every child exit code and runs emulator suites sequentially.
Local Firebase uses only `demo-atpl-sync` (Auth 9099, Firestore 8080,
Storage 9199). Production credentials and real logbooks are not fixtures.

| Contract | Evidence |
|---|---|
| Immutable questions, choices, keys and scoring | `workspace-source` fixed published baseline tests; all-bank browser source-key grading of all 6,426 questions, including separate MB/MBR and INS E/F/G/H |
| Google account → Session → native IDB → Firestore/Storage → second device | `verify-workspace-browser.cjs`: actual SDK Google emulator popups, two contexts for one UID, another UID, separate guest |
| Offline metadata, original image bytes, reload and queued upload | Native repository and whole-workspace browser runners; image SHA-256 verified before/after authenticated Storage; metadata pull does not auto-download images |
| Independent fields converge; concurrent Actual stays a conflict | Actual Firestore/browser commits and explicit conflict resolution; confirmed Actual never replaced implicitly |
| Commit succeeded but reply/IDB acknowledgement failed | Lost-response injection after real commit, actual native IDB transaction abort, stable operation ID retry and retained later edit |
| Account switch during pending work | Main UI PDF, OCR and attachment file callbacks; production backup UI emission, image preparation and server-committed ack held across real Auth logout |
| Multipart continuation | Native IDB close/reopen between metadata and image-only parts, atomic restore-progress quota failure, same queued IDs on complete-set retry, unrelated local edits rejected |
| Background writes | Actual main UI/Session/IDB/controller with only external provider boundary stubbed; delayed upload/weather trigger metadata commits and invalidate stale synced labels without focus/manual sync |
| Recovery originals | Acknowledged and resolved image conflicts export every original; missing recovery bytes reject full backup or are explicitly listed in incomplete export |
| Multipart integrity | Native browser backup parts, missing-part and tampered-payload checks; model tests for missing image, mixed sets/UIDs, corrupt bytes, restore recovery and no arbitrary old-queue replay |
| Duty backlinks at scale | 10,000 synthetic flights, archive duty, move one flight, restore duty: 9,999 original backlinks and one reassigned backlink |
| Stable pagination | Actual Firestore SDK with 100-record pages and root changed between pages; observed root/page/document counts and resulting snapshot bytes/time in report |
| Writer ownership/quota | Native Chromium/WebKit lock, readonly fallback, atomic transaction failure, recovery quota and guest-preservation tests |
| Existing app upgrade/provider disabled | Actual v3→v4 service-worker lifecycle, cached UID, cold main offline, MB bookmark/source image; static cache excludes authenticated/private/API/OAuth requests |

The browser report and synthetic backup files are written under the ignored
`test-results/avilog-workspace/`. Reports include exact commit, engine versions,
source/engine hashes, scale metrics, failures and explicit OAuth/device flags.
`docs/WORKSPACE-Account-QA.json` is the sanitized release summary, created after
the completion run. Earlier exploratory runs do not establish release success.

Chromium uses real context offline mode. The installed Playwright WebKit build
rejects service-worker navigations in its offline emulation; WebKit therefore
refuses the app origin and uses preinstalled Auth/Firestore/Storage routes; each
provider cut is probed and recorded. Controlled network and parser fixtures
disable service workers; native cold-start/SW coverage runs separately. Only a
native diagnostic with exact deliberate request-abort proof, or a cancelled
Firestore channel with the same SID, database, page and timestamp (within two
seconds), is classified. Other JavaScript exceptions fail the run.

The parser-race fixtures hold an external parser/file-read boundary, not the
production account/modal/IDB guards. They check that an old callback cannot
populate a new account's same-shaped modal. The receipt mutation run deliberately
stops recovery and must fail the normal pending/synced assertions. The held parser boundaries are used in the passing acceptance run; the
stopped-recovery mutation is used only for the expected-failure sensitivity run.

The scale test uses admin access solely to seed synthetic records and introduce
the concurrent root revision. Pagination itself runs with owner rules and the
actual SDK, then the browser pulls and persists the same records. Read counts
are observed logical reads, not a quota or billing estimate. This does not
benchmark a 10,000-record restore/import.

Real Google OAuth, production rule/CORS checks and physical phone/iPad testing
are separate gates. Emulator and viewport results never establish those gates.
The latest rollout status is recorded in the release QA JSON and decision log.
