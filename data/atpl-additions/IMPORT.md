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


## Page-specific book evidence

`book-sources.json` records the book edition, original PDF SHA-256, physical PDF page, printed page, chapter, section and short excerpt or explicit paraphrase. All 1,103 UIDs have **CAE Oxford EASA ATPL 2014 as their first source**: the supplied `100-General_navigation.pdf` (576 PDF pages) and `070-Flight_planning_and.pdf` (340 PDF pages). In these two files PDF page = printed page + 6. No full textbook is published. `question-book-sources.json` is the reviewable mapping; `map_book_sources.py` reproduces it from the original question stems and explicit topic overrides. The generated `public/atpl/book-citations.js` is in the offline shell; no PDF download or network request blocks quiz entry or answer reveal.

These citations support the method, not independent certification of every Word key. Jeppesen figures still require the actual source chart. The 2014 Flight Planning book reproduces some older (2007) FPL instructions: affected equipment/STS cards say so. Precisely scoped FAA approach guidance, CAP 694 FPL definitions, EUROCONTROL NOTAM guidance and EASA's 2025 fuel implementation guide appear only as explicitly labelled supplemental sources where needed. The latter is CAT aeroplane guidance. External PDF links need a network connection; all embedded quotations and paraphrases work offline. CAP 697/758 links that are no longer served are not used as active book evidence.

The addition leaves all published question-bank HTML, manifests, catalog hashes and account identities byte-identical to release `01f7fcc`. It therefore preserves downloaded-bank readiness and existing progress. Run `python3 scripts/atpl-import/build_book_citations.py` after an editorial change. Original PDF pages and quote matches were checked during authoring; `scripts/atpl-import/verify_book_evidence.py <folder>` repeats exact SHA-256/page-text/quote checks against the six source PDFs (two provided textbooks and four supplemental manuals). The original textbooks remain in the user's source folder, outside Git.

## Images of cited book pages

All 1,103 questions also show the actual cited Oxford page inline after the explanation, with the existing image viewer for zoom and keyboard closing. The 81 unique pages are rendered in full (including diagrams, formulas and printed page numbers) at a maximum side of 2400 px. They total about 19.3 MB, shared across questions; duplicate references to one page in a question show the image once. Images use lazy loading and reserved dimensions. Unavailable images show a retry/download message without removing the explanation.

`book-page-images.json` records the source PDF SHA, physical/printed page, rendered pixel hash, dimensions and encoded image hash/bytes. `render_book_pages.py SOURCE_DIR --pdftoppm PATH` reproduces the pages from the supplied PDFs, appends immutable images to existing media packs, and creates contact sheets outside Git for visual review. Existing media entries are retained. Full textbooks are not published.

`build_book_citations.py` adds page images to the citation module and emits a small, separate `book-page-assets.js` download index. Original bank manifests, catalog, keys and account identities stay unchanged. The offline downloader adds only the selected bank's cited pages and includes their size in its progress display. A previously downloaded bank stays cached, but is not called fully offline-ready until its new page images are verified; downloading again reuses existing bank assets. Page integrity, missing/corrupt page repair and offline zoom are covered by unit and Chromium/WebKit browser tests.
