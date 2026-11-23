# AviLog Notes v1.0

Approved design: “Thảo luận tính năng Notes”, conversation `6af5684c-14e0-83ec-9d74-00acd5139def`. This release adds a separate personal notebook, not a migration of existing flight `note` fields or ATPL state.

## User features

- My Notes in shared desktop/mobile navigation. Create/edit unlinked notes; search title, body, tags and document name; pinned first then most recently changed.
- One personal folder, multiple tags and independent pinned status. Source grouping remains independent of folders and folder names.
- Rich text represented as an allowlisted block/run AST: bold, italic, bullets, numbered lists, checklists, links, undo/redo. Pasted text cannot import executable HTML. Done closes after local durability; no mandatory Save.
- Desktop side panel and mobile bottom sheet/full-screen expansion. Quick `+ Note` and `Notes(n)` controls, text selection → Add Note, mild selection highlights. Counts deduplicate IDs and exclude Trash. Original source text and immutable bank payloads are untouched.
- ATPL question links open a read-only source preview without replacing the active quiz session. Existing AviLog sections and weather product details accept linked notes without extra weather fetches.
- A local PDF source reader supports manuals such as FCOM/FCTM/SOP/MEL. Files stay on the device; only note/source metadata syncs. Render one page at a time. SHA-256 identifies the file version. Text-layer selections retain page/quote/rectangles when available. Otherwise use explicit page/section fallback. A changed file only raises a notification; personal text and original anchors are never silently rewritten.
- Soft-delete into 30-day Trash, restore title/content/folder/tags/pin/source, expire locally and on Firestore TTL. Durable content-free heads prevent an old offline device from resurrecting expired content.
- Export one note, current folder/filter, or all notes using the browser print/Save PDF workflow. Structured JSON backup/restore includes folders, rich content, links and conflict versions. Restore is additive; differing IDs retain versions instead of overwriting. A local recovery snapshot is created before restore/Trash operations and can be downloaded independently.

## Persistence and security

`avilog-notes-v1` IndexedDB stores records, immutable in-flight operations, recovery metadata and local source documents. Keys include the selected UID; Guest is a separate scope. No new writer opens or changes workspace/ATPL storage. The editor remains outside the root renderer. Keystrokes stage a UID-scoped emergency draft before IDB; draft recovery is additive. Logout retains pending data on the original UID and locks the previous editor.

Firestore paths are `users/{uid}/notesV1Heads`, `notesV1Records` and `notesV1Commits`. Only that authenticated Google UID can read or write. Payloads are bounded; record/head/receipt updates are atomic and revision checked. Receipts make lost acknowledgements idempotent. A later local edit survives an earlier acknowledgement. Independent fields merge; competing edits retain mine/theirs for explicit choice or merge. Unresolved versions are durable locally and included in JSON backup; the chosen/merged note syncs. Source/folder metadata conflicts can also be explicitly selected.

The UI distinguishes local durability, pending/offline, sync failure, reauthentication, conflicts and authoritative Cloud verification. An initial cached Firestore snapshot cannot establish Synced; the first server snapshot reads all heads. Account-wide Synced additionally requires Notes to be verified with no pending/conflicted records.

## Deployment order

1. Run unit, browser, Notes rules and real SDK/Auth emulator cross-device tests.
2. Deploy additive `firebase/firestore.rules`; preserve the existing workspace and bank rules exactly.
3. Enable TTL on collection group `notesV1Records`, field `expiresAt`, offset zero (`firebase/firestore.indexes.json`). Do not enable TTL on workspace, bank or content-free head collections. Backend TTL deletion is asynchronous; the app enforces the 30-day restoration deadline immediately. [Firestore TTL documentation](https://firebase.google.com/docs/firestore/ttl).
4. Rebuild the deterministic Firebase bundle, run required CI, merge, then verify the Railway service and public assets. The new service-worker version precaches the complete Notes graph and retains downloaded banks. PDF.js source-reader runtime caches after first successful use.

## Validation commands

```
npm run build:atpl-account
npm test
npm run test:notes-browser
npm run test:notes-rules
npm run test:notes-sync
```

Browser artifacts: `test-results/notes-v1/` (desktop/mobile screenshots, source PDF, print PDF and reports). Firebase tests use only `demo-atpl-sync` and synthetic users. Checks include fault-injected Notes-only IndexedDB failure (no unhandled Promise, no false Saved/Synced and no impact on other screens), native IDB durability, concurrent tabs, old acknowledgements, conflicts, additive restore, UID isolation, trash expiry, no stale resurrection, actual two-device SDK sync, offline edits/logout, and unchanged workspace/quiz content.

## Boundaries

- Source PDFs are not note attachments and are not uploaded. A new device needs the matching source file (and a previously opened source-reader runtime for offline viewing). Notes remain readable without it.
- No image/voice attachments, sharing or AI features in v1.0.
- PDF export uses the system print dialog; no server conversion service.
- Unresolved conflict variants and automatic recovery snapshots live on the detecting device until exported/resolved. Do not clear browser storage before exporting pending data. Cloud stores the chosen/merged current record.
- Emulator verification does not establish real Google OAuth, physical iPhone/iPad behavior or the eventual timing of TTL deletion. Playwright WebKit's protocol-offline reload can fail internally; offline editing and persistence are tested there, with true network-disabled reload tested in Chromium.
- No fabricated source location: when exact text/version is unavailable, display the correct section/question/page and tell the user to compare manually.
