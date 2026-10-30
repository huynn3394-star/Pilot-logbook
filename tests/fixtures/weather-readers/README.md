# Historical workspace validators

These snapshots make upgrade tests independent of Git history, shallow checkouts
and source archives. Validation logic is unchanged; only import paths were adapted
to the same shared domain/parser helpers used by the former harness.

- `v4-schema.js`: `public/workspace/schema.js` at
  `7474166f25ec530f943d2a2215e8bf197831afeb`, before weather preferences.
- `v5-schema.js`: `public/workspace/schema.js` at
  `17a2b0086895ec729d3187304f9691a91c67fc15`, before weather groups.

Do not update these validators when extending the current schema. Tests must keep
checking that an older reader rejects unsupported records without acknowledging
pending edits, and that upgrading preserves the pending edits and cloud fields.
