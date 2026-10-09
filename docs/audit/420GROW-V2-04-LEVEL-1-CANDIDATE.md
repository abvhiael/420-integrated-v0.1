# GROW-V2-04 — Level 1 qualification candidate and validation ledger

**Status: PENDING exact-SHA Level 1 PASS.** This file records the final committed implementation after Go formatting and removal of the one-time formatting maintenance workflow.

## Directly applicable acceptance
- Policy-protected CRUD-like creation, read/list, revision-checked rename for facility, room, and zone (destructive deletion intentionally withheld pending retention and audit lifecycle).
- Verified parent chain: tenant -> facility -> room -> zone; deny missing, wrong and cross-tenant parent.
- PostgreSQL `0002_rooms.up.sql` migration, composite tenant/room foreign keys, FORCE RLS, tested using a separate nonowner runtime database role.
- Schema migrator supports V2-03 and V2-04 checksummed forward-only migrations and detects drift/replay.
- Go unit, race and vet, formatting, security denial (including unauthenticated/read without storage access), PostgreSQL migration replay/FK/RLS, original Grow regressions.
- Evidence must use exact full Git commit and actual run/job conclusions; no pending, cancelled or skipped check counted as success.

**Deferred:** fully integrated private HTTP authentication/session/MFA, live database and client deployments, device control; cumulative Level 2 at V2-05, canonical Level 3 at V2-15, testnet V2-16. Prior GROW-01–10 and frozen Genesis ownership unchanged.

**Next canonical step only after qualified:** GROW-V2-05 — Plant lifecycle, genetics and cloning records.
