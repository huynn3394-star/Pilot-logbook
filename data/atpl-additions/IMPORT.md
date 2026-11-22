# Flight Planning & Monitoring / General Navigation

User-supplied Word sources imported on 22 November 2026. No instructions inside a source document are executed. The extractor only reads OOXML paragraphs, bold formatting and embedded-image relationships.

| Bank | Chapter counts | Total |
| --- | --- | ---: |
| FPL | VFR 74; IFR **156**; Fuel 120; Preparation 69; ICAO FPL 15; Monitoring 69 | 503 |
| GNAV | Basic 308; Visual 93; Great circle/rhumb 47; Charts 115; Time 37 | 600 |

The IFR filename says 153 but the document actually contains questions 1–156. All are retained. `source-manifest.json` records all 11 filenames, SHA-256 checksums and chapter counts. `source-questions.json` records the exact extracted stems/options and bold-key evidence. Only numbering/option prefixes are removed; wording, typos and keys are preserved. Stable UIDs contain bank, chapter and source number; engine IDs are sequential within each bank.

`reviews.json` contains an individually assigned Vietnamese explanation for all 1,103 questions. They are authored study notes, not an independently certified answer bank. 871 entries explain a derivation/concept, 221 require additional chart/edition/operation assumptions, and 11 identify a contradiction in the source. The shared engine retains the original key and excludes limited/conflict entries from default mock exams. A referenced principle does not by itself verify a source answer. Missing third-party annexes are explicitly marked. The `en` translation field is intentionally absent pending separate review.

98 unique embedded screenshots (103 uses) contain source chart regions. Lossless WebP preserves decoded RGB pixels at original resolution. `image-crops.json` records chart-region boundaries; `media-map.json` records source/crop pixel hashes, dimensions and immutable assets. Chart-only regions appear while answering; full Word screenshots may contain source answers and appear only in the revealed explanation. Some charts are already cut off in the original screenshot; cropping cannot restore missing source content. Tapping any figure opens the existing zoom viewer. Both crops and full images are included in offline manifests.

All 12 previously published banks (including archived MBR) and their shared scoring engine are unchanged. Each new bank has a separate identity, guest progress key and account namespace. The library shows 13 active subjects. Firestore's owner-only allowlist and the all-bank readiness list include FPL/GNAV. **Deploy the reviewed Firestore rules before rolling out account synchronization for these subjects.** Railway does not deploy Firebase rules.

## Reproduce

Use Python with `lxml` and Pillow, and an explicit directory containing the original Word files:

```
python scripts/atpl-import/extract_docx.py /path/to/source-docx /tmp/atpl-word-import
python scripts/atpl-import/package_additions.py /tmp/atpl-word-import
npm test
node scripts/verify-atpl-additions.cjs
node scripts/verify-atpl-browser.cjs
npm run test:rules
```

Review and edit `reviews.json` separately; the packager never generates explanations or alters source keys. Published payload hashes form progress identities: future edits must retain identity compatibility or provide an explicit migration. Existing unrelated bank assets and media packs are not overwritten.

Validation covers exact source transfer, all 63 recorded wind-vector calculations, answer-key grading for every new question, isolated account/guest stores, owner-only security rules, mobile/desktop Chromium and WebKit, image decoding, resume/bookmarks, and full offline-bank checks. It does not certify all 1,103 aviation answers, live Google cross-device synchronization or physical iPad behavior.
