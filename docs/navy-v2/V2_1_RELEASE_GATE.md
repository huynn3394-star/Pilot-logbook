# Avilog Navy V2.1 — release gate (PR #6)

This document records current verification evidence and remaining blockers. It does **not** authorize deployment.

## Confirmed in CI (commit `240967f675`)
- Navy teal UI verification — passed.
- System typography verification — passed.
- AviLog CI: admin container — passed; Firebase rules — passed.
- AviLog CI: unit-build — failed on `npm audit --audit-level=moderate` (13 moderate advisories on transitive `glob` and `minimatch`).
- AviLog CI: browser — failed during `verify-weather-attention.cjs`: a synthetic SPECI panel remained hidden after a weather tab remount on at least one browser test; see run 41778503192. Do not suppress this test.

## Work completed
- Compact white AVL logo in main and ATPL headers.
- Navy card typography and spacing; iPhone 320px overflow fixes.
- Continuous Flight Editor layout, retaining original inputs and Save handler.
- Grouped More navigation, existing routing/actions only.
- ATPL and Weather visual consistency.
- PWA assets cached without wiping workspace data.
- Extra unit tests for logo, route groups and nonduplicated time inputs.

## Release blockers — must pass
- [ ] Investigate `verify-weather-attention.cjs` failure, reproduce, fix and rerun in Chromium and WebKit.
- [ ] Resolve `npm audit` advisories without `--force`, disabling scans or unverified breaking transitive overrides. See issue #7.
- [ ] Pass all CI jobs at the SAME final commit.
- [ ] Verify no record mutation on load/edit/save and midnight UTC calculations.
- [ ] Verify authenticated staging, offline→online sync and access boundaries using test accounts only.
- [ ] Capture same-viewport iPhone screenshots from the actual PR build; compare with owner-approved reference.
- [ ] Confirm iPad/Desktop behavior after owner supplies reference screenshots.
- [ ] Obtain owner signoff before merge and separately before production deploy.

## Protected code/data
No changes to flight time computations, database schema, Firebase security rules, auth, quiz answers, or production records are intended by this UI PR.

## Evidence
- PR: https://github.com/huynn3394-star/Pilot-logbook/pull/6
- CI run: https://github.com/huynn3394-star/Pilot-logbook/actions/runs/41778503192
- Security issue: https://github.com/huynn3394-star/Pilot-logbook/issues/7

**Decision: HOLD — Draft PR, do not merge or deploy.**
