# Study interface aligned with AviLog — 7 November 2026

Base: `690de7609b678bbaa67e322c8690eaf23af11cd6` (the Wader 5.0 reference interface).

The study area previously imported the same color tokens but retained its older 156px sidebar, blue header, square menus and heavier card typography. This change brings both the subject library and the immutable question-bank pages into the same visual frame as Logbook.

## Changes

- Floating 88px tablet rail and separate add button, matching the main app; shared mobile navigation, glass surfaces and spacing.
- Charcoal/teal and light themes, circular header controls, consistent native typography, rounded cards, grouped settings and account menus.
- Library overview generated from the catalog: 11 original subjects and 6,126 original questions; the corrected Mass & Balance bank remains separately labelled.
- Per-bank offline status styling follows the actual download/check state. Download/cancel/retry behavior remains owned by the existing offline module.
- Question, answer, explanation, language toggle, picker, settings, source-image dialog and bottom question toolbar share the same presentation. Correct/incorrect selections retain both color and explicit check/cross cues.
- External CSS and the existing DOM adapter handle bank presentation. No published bank HTML, source images, scoring engine, question payload, answer key, storage key or account transport was changed.
- PWA shell version advances to `…wader-v5-20261106-study-20261107`; existing study downloads and progress remain in their existing stores.

## Verification

- `node scripts/build-atpl-account.mjs`: passed.
- `node --test tests/*.test.js`: **315/315 passed**, including source-bank byte/hash checks, original key/choice identities and scoring integrity.
- `npm run test:study-ui`: **Chromium and WebKit passed** at 320, 390, 820 and 1440 px. Shared navigation, dark/light round trips, no horizontal overflow, wrong and correct answers, bookmarks, explanation language switches, settings, original progress preservation and return to Logbook are checked.
- At 390px both engines additionally verify downloaded MB offline reopening and return to Logbook. Chromium uses native offline mode; WebKit refuses origin connections, matching the established harness.
- Both browsers also exercise INS question 148 through the actual question picker: original E/F/G/H letters, correct answer, decoded full-resolution source image on its white viewing background, and no changes to MB progress.
- `git diff --check`: passed.

Browser results contain 12 completed checks and zero errors in `test-results/study-shell/QA.json`; screenshots in that ignored directory include library dark/light, quiz, settings and source image. Before captures are in `test-results/study-alignment/before/`.

The existing preview tab at `http://127.0.0.1:3245/atpl/` was opened and reloaded after the new worker activated. Its visible library now shows the new rail, summary and management controls. This verification uses the existing local origin, preserving its browser storage.

No live account sync or physical iPad test is claimed. No merge or Railway deployment was performed.
