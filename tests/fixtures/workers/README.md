# Historical public service workers

Unmodified public worker snapshots for native PWA lifecycle tests. They contain no
user records or credentials. Keep these stable rather than deriving old behavior
from the latest code or requiring unpublished Git objects.

- `v5-sw.js`: `17a2b0086895ec729d3187304f9691a91c67fc15:public/sw.js`,
  the published v5 weather worker matching the historical v5 schema fixture.
- `pre-navy-v2-sw.js`: `4e93e03446b15d866155e7a16da8927a32163df5:public/sw.js`,
  main immediately before Navy V2.

`node scripts/verify-workspace-upgrade.cjs` tests v5 → current. Set
`AVILOG_UPGRADE_FROM=pre-navy-v2` for main → Navy V2. Both retain native IDB,
pending operations, account study progress and downloaded bank/source images
across a real controlling service-worker upgrade and offline reopen. The test
uses current app assets with the historical worker, not a full historical UI.
