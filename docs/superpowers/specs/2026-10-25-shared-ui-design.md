# AviLog shared interface — approved design

The owner approved one consistent Navy + Teal interface across Schedule, Logbook, Crew, Statistics, Weather, Settings, ATPL library, question screens and dialogs. Preserve the existing compact layout and each page's specialized content.

## Approach

Use one shared token sheet and shared component stylesheet, consumed by the main page, ATPL library and the existing bank presentation bridge. This is preferable to independently recoloring each tab (the original inconsistency) or rebuilding the app framework (unnecessary data and interaction risk).

## Contract

- Retain navy #142744; one teal accent: #0f766e on light and #2dd4bf on dark. Neutral surfaces; red only for genuine errors/destructive actions/incorrect answers.
- Shared body and heading fonts, typography scale, 16px card radius, 10px control radius, 44px standard controls, 16px mobile page gutters, 12px compact gaps, readable light/dark text.
- Consistent page headings, top-toolbar treatment, menus, primary/secondary controls, cards, empty/error/loading states, dialogs and input labels. Do not force calendar, raw weather or answer options into inappropriate identical layouts.
- Preserve V13 Compact flight-editor dimensions and all UTC controls, native dialog behavior, focus, tab-state retention and all V14 final-protection and synchronization behavior.
- Preserve original ATPL banks, source data, manifests, identities, answer keys, scoring engine, source images and progress. Style via existing external theme link only.
- Do not modify Firebase rules, credentials, providers, dependencies or Railway configuration. No new integrations.
- Use the existing repository and Railway service. Branch first; only promote verified application bytes. Keep the two known historical-weather test failures visible rather than skipping them.

## Acceptance

Check all main tabs, library and every question bank; light/dark; mobile/tablet/desktop; control and text contrast; no horizontal page overflow; quiz-answer semantics; shared appearance after navigation; offline CSS and retention of saved data. Report browser automation separately from physical iOS/cloud-account tests.
