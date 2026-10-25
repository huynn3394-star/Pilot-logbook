# AviLog system typography implementation plan

Goal: apply the approved Facebook/iPhone-like interface typography throughout the existing app while retaining Navy + Teal, Compact dimensions, every data field and the released Weather attention feature.

Direction: native Apple UI via -apple-system/BlinkMacSystemFont first; Inter and platform fallbacks elsewhere; shared native monospace stack for UTC/OOOI and flight figures. No proprietary Facebook font, SF font distribution or identical-rendering claim.

Baseline: 5dfbd15b78fd81b7dc68ebb8f1b7a5feca9a05de. Isolated branch: ui/system-font-facebook-2026-10-25.

- [x] Inspect all typography declarations and existing tests.
- [x] Four contracts; RED on unchanged source in run 40169537787 (three failures, one existing check passes).
- [x] Replace only font declarations/imports and shell cache suffix; keep source banks immutable.
- [x] Run locked SDK build and tests: 258/260 units with exactly two existing missing-history failures, 250 shared UI + 18 Flight Detail + 12 Weather scenarios passed in run 40170315309.
- [x] Verify protected files unchanged, artifact integrity, exact source-byte checks and final screenshots.
- [x] Inline whole-diff review; retain physical iOS and live cloud limits.
- [x] Remove one-time migration and write-scoped candidate job before production promotion. Final application bytes match tested commit 4df09ccc6825683dec0d361075ceb2480f3c7b50.
- [ ] Recheck main lease, promote to existing project and verify Railway deployment.

Ruling: wait for imported CSS readiness in offline WebKit tests while preserving exact assertions; also block external fonts and require an origin-failure probe. This fixes a test timing race and strengthens offline evidence, not production behavior.

Detailed verification and release instructions: docs/SYSTEM-TYPOGRAPHY.md.
