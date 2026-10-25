# AviLog system typography implementation plan

Goal: apply the user's approved Facebook/iPhone-like interface typography throughout the existing app, while retaining Navy + Teal, Compact geometry, every data field and the released Weather attention feature.

Approved direction: prefer -apple-system/BlinkMacSystemFont on Apple devices, then Inter and existing platform fallbacks elsewhere. Use the shared native monospace stack for UTC/OOOI and numeric flight summaries. This is not Facebook's proprietary brand font and is not a claim of pixel-identical rendering on all operating systems.

Approach: update existing CSS tokens and remove explicit legacy family declarations/imports, rather than adding a replacement app or rebuilding data-bearing screens. The same shared stylesheet already reaches the ATPL library and immutable bank pages. Keep source banks byte-for-byte unchanged.

Baseline: 5dfbd15b78fd81b7dc68ebb8f1b7a5feca9a05de. Isolated branch: ui/system-font-facebook-2026-10-25.

- [x] Inspect main, all font declarations, shared and Flight editor browser checks.
- [x] Write four contracts and observe RED on unchanged source: run 40169537787, three expected failures and one existing shared-style check passing.
- [ ] Apply validated typography-only transforms (scripts/apply-system-font.mjs), cache suffix sf-ui and corresponding version assertions.
- [ ] Run contracts, locked SDK build, complete unit suite, all-tab/ATPL browser suite, existing color/editor and SPECI regressions. Preserve and disclose the two historical weather-upgrade failures.
- [ ] Inspect exact diff and screenshots. A separate minimally privileged workflow job may create candidate Git objects from verified source bytes, but never moves a ref or deploys. Review candidate through the connector before promotion.
- [ ] Recheck main lease, promote only tested bytes to the existing project, verify Railway status.

Constraints: no Firebase/rules/variables/dependency changes, no credential access, no font binaries distributed, no stored data mutations, no ATPL source/question/key changes. Google Fonts remains the existing optional web-font provider; system fallbacks work without it. Physical iPhone/iPad SF rendering remains a separate device check.

Review focus: inherited legacy fonts, monospaced input overflow at 320px, Vietnamese labels, both themes and offline fallback; genuine warning colors and raw weather text must remain intact. There is no independent reviewer tool in this session; use inline whole-diff review and report that limit.
