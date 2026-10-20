# ATPL sync: implementation decisions

These decisions preserve the approved offline/account/source-key constraints. Provider activation and physical iPad testing remain separate release checks.

- Task 1: Ruling: model session/revision sidecars live under _sync in remote snapshots and are stripped at the engine boundary — preserves the source v2 engine while keeping independent session IDs — cost if wrong: adapter/transport serialization correction.

- Task 1: Ruling: npm executable is absent until Task 3; ran the exact package test command with pinned bundled Node instead. The two-device import receipt transaction is verified with real Firestore in Task 3, not invented in the pure model — cost if wrong: delayed discovery at the transport gate.

- Task 3: Ruling: immutable report/import document IDs prefix their canonical hash with epoch (epoch~hash), so explicit reset can exclude prior history while retaining immutable recovery records — same canonical report deduplicates within a bank epoch — cost if wrong: one storage-path migration before production activation.

- Task 3: Ruling: production rule core/session revisions are nondecreasing (not strict +1), letting concurrent optimistic transactions reach update-time conflict/retry; transport still increments once per new receipt. Owner restrictions and immutable receipts enforce privacy/retry boundaries — cost if wrong: a deliberately modified owner client can corrupt its own statistics, never another UID's data.

- Task 4: Ruling: authenticated token-expiry/provider-rejection scenarios are exercised with the real Auth emulator/browser flow in Task 6, alongside account-switch races; this task verifies the disabled/failure boundary and proxy — cost if wrong: provider integration defects are discovered before the release gate, not at HTTP-only testing.

- Task 5: Ruling: adapter retains the last state delivered to the active engine, applies only its new local changes to the newest durable merged envelope, and exposes the merged counters back after a successful save. Session selection updates only at home/explicit refresh; resumed server sessions retain their UUID — unchanged engine bytes cannot otherwise absorb an acknowledgement without losing later clicks — cost if wrong: progress/session divergence, covered by active-answer-after-ack and resumed-UUID RED→GREEN regressions.

- Task 6: Ruling: use official forced long polling with auto-detection disabled for all browser clients — WebKit streaming stalled with correct HTTP200/CORS headers; forced polling passed every functional assertion through expiry/logout/logbook — cost if wrong: extra short HTTP requests compared with streaming. No security rule/CORS weakening.

- Task 6: Ruling: record WebKit localhost-emulator “due to access control checks” connection-cancellation diagnostics separately from JavaScript exceptions, sanitizing query strings — native WebKit reports cancelled navigation/offline XHRs as pageerror; all actual sync/count/privacy/offline assertions must still pass, so a broken connection still fails the suite — cost if wrong: a nonfatal emulator network diagnostic could require later investigation; retained in the browser report.

- Task 7 independent review: four Important and one Minor findings accepted; no Critical and no deferred code finding. The single fix pass validates raw account backup wrappers before engine normalization, retains the original JSON text in recovery exports and emits bankSHA256 in new account backups. Legacy guest imports keep the original engine behavior; backups without a hash require conservative review.
- Task 7 lifecycle ruling: reload the library on persisted pageshow, matching bank recovery after pagehide stops the controller. The browser regression uses actual library→bank→Back plus deterministic persisted lifecycle events and requires a subsequent real Firestore request; this does not claim that the browser used BFCache on every run.
- Task 7 reset ruling: multiple unsent resets retain the last server ancestor; imported session IDs hash epoch/import/kind into 71-character IDs. Async stageImport rechecks writer and epoch immediately before its atomic persistence. Real emulator tests cover repeat resets and same backup before/after reset with resumed answers and a second-client pull.
- Task 7 iPad routing ruling: Macintosh UA plus positive maxTouchPoints selects redirect. Tests simulate desktop iPad UA with five touch points; Chromium and WebKit complete the real Auth emulator redirect. Physical iPad and real Google remain separate gates.
- Task 7 provider setup ruling: no Firebase connector is available, but the authenticated in-app browser exposes Huy's dedicated avilog-atpl Spark project. Use that existing project through its console rather than create a duplicate or alter the unrelated wedding project. No billing/Analytics/Storage or service-account secret is enabled. Cost if wrong: provider setup is kept disabled in the app until real OAuth/owner-rules validation.

## Exhaustive execution rulings at release close

- Task 1: Ruling: model session/revision sidecars live under _sync in remote snapshots and are stripped at the engine boundary — preserves the source v2 engine while keeping independent session IDs — cost if wrong: adapter/transport serialization correction.

- Task 1: Ruling: npm executable is absent until Task 3; ran the exact package test command with pinned bundled Node instead. The two-device import receipt transaction is verified with real Firestore in Task 3, not invented in the pure model — cost if wrong: delayed discovery at the transport gate.

- Task 3: Ruling: immutable report/import document IDs prefix their canonical hash with epoch (epoch~hash), so explicit reset can exclude prior history while retaining immutable recovery records — same canonical report deduplicates within a bank epoch — cost if wrong: one storage-path migration before production activation.

- Task 3: Ruling: production rule core/session revisions are nondecreasing (not strict +1), letting concurrent optimistic transactions reach update-time conflict/retry; transport still increments once per new receipt. Owner restrictions and immutable receipts enforce privacy/retry boundaries — cost if wrong: a deliberately modified owner client can corrupt its own statistics, never another UID's data.

- Task 4: Ruling: authenticated token-expiry/provider-rejection scenarios are exercised with the real Auth emulator/browser flow in Task 6, alongside account-switch races; this task verifies the disabled/failure boundary and proxy — cost if wrong: provider integration defects are discovered before the release gate, not at HTTP-only testing.

- Task 5: Ruling: adapter retains the last state delivered to the active engine, applies only its new local changes to the newest durable merged envelope, and exposes the merged counters back after a successful save. Session selection updates only at home/explicit refresh; resumed server sessions retain their UUID — unchanged engine bytes cannot otherwise absorb an acknowledgement without losing later clicks — cost if wrong: progress/session divergence, covered by active-answer-after-ack and resumed-UUID RED→GREEN regressions.

- Task 6: Ruling: use official forced long polling with auto-detection disabled for all browser clients — WebKit streaming stalled with correct HTTP200/CORS headers; forced polling passed every functional assertion through expiry/logout/logbook — cost if wrong: extra short HTTP requests compared with streaming. No security rule/CORS weakening.

- Task 6: Ruling: record WebKit localhost-emulator “due to access control checks” connection-cancellation diagnostics separately from JavaScript exceptions, sanitizing query strings — native WebKit reports cancelled navigation/offline XHRs as pageerror; all actual sync/count/privacy/offline assertions must still pass, so a broken connection still fails the suite — cost if wrong: a nonfatal emulator network diagnostic could require later investigation; retained in the browser report.

- Task 7 Ruling: desktop-mode iPad redirect finding was treated as Important for this user's explicit iPad/mobile requirement and fixed in the one review pass — popup routing deviated from the approved mobile flow — cost if wrong: extra routing heuristic; real emulator redirect with Macintosh/touch capability and pure device tests passed. No further review or implementation change.

- Task 7 Ruling: after final confirmation, align local main with the published identical tree; preserve the old shared-dependency symlink and relocate this task's private dependencies/tooling to primary, never write into the bundled shared runtime — enables the merged checkout's own full tests and preserves verified tooling before worktree cleanup — cost if wrong: revert the preserved symlink.

No deferred reviewer code finding remains. The desktop-iPad item was elevated for the approved mobile flow and fixed in the single pass. Direct user confirmation closes real Safari status and phone-to-physical-iPad transfer gates. Physical iPad offline remains untested. URL rename remains explicitly deferred until backup confirmation.
