# AviLog — Navy + Teal presentation update

Approved scope: preserve the existing AviLog navy brand and Compact flight editor, adding one teal accent to improve recognition. The preview is a color reference only, not authority to change data, navigation, flight-time fields, or add integrations.

## Design and boundaries

- Preserve navy `#142744` as the existing brand color; retain existing dark navy surfaces and white/gray neutrals.
- Use teal text `#0f766e` on light surfaces and `#2dd4bf` on dark surfaces. These are theme-specific shades of one accent, not separate status colors.
- Accent selected navigation, Save/primary actions, selected inputs, key calculated totals and existing confirmed records. Drafts and unconfirmed scan content remain neutral with their current text and border cues.
- Genuine error messages retain a restrained error color; do not add yellow/green/blue decorative status categories.
- Keep current Compact spacing, control sizes, labels, flight number/date identity, and all six Scheduled/Actual event controls.
- Do not change cloud data, Firebase rules/variables, account/SDK logic, ATPL payloads/answer keys/media, OCR, Lido/NOTAM or any provider integration.

## Implementation

Add a separate stylesheet loaded after `style.css` on the main app. Keep selectors scoped to the main app and flight editor. Add the stylesheet to the service-worker shell and advance only the shell's presentation version while preserving the SDK build suffix. Existing data/offline bank/OCR caches are not cleared by this change.

An editor FINAL badge is styled from the existing protected-original UI, not from merely selecting the unsaved confirmation checkbox. No new saved status or data schema is introduced.

## Verification gates

1. Run the new browser test against the old UI and record the missing accent failure.
2. Run the full unit regression suite on the locked dependencies with Node 24.12.0.
3. Run Chromium and WebKit for 320/390/820/1440 pixel viewports and light/dark themes. Check contrast, selected tab underline, focus, unchanged entered values across tab changes and horizontal overflow.
4. Check that the installed service worker caches the new stylesheet and can load it offline without removing local data.
5. Inspect the final diff before merging: product changes limited to CSS, its HTML link and public shell version/cache asset list. No Firebase or logbook model changes.

GitHub Actions runs on a clean disposable checkout with cloud features disabled and a read-only repository token. It does not deploy or receive production secrets. Screenshots use demo data. These checks do not claim physical iPhone/iPad or cloud-account validation.

## Progress

- Baseline: deployed V14 source at `4ac692ed22c27b598692c93de99251c5185e7944`.
- Local execution is unavailable (container ClientError). Verification uses the repository's GitHub Actions runner instead.
- Branch: `ui/navy-teal-2026-10-24`.
- CI/test outcomes will be recorded after observing actual results; this document is not evidence that tests have passed.
