# GROW-V2-04 — Qualified Level-1 closeout

**Step:** GROW-V2-04 — Facility, room and zone management.  
**Result:** **COMPLETE — Level 1** (no claim of cumulative Level 2, complete Level 3 or deployment qualification).

## Exact-SHA identity
- **Qualified substantive implementation SHA:** `f80edd1c6bd7592e2009d353b850f6f091c3f2e0`.
- **Main/base SHA during validation:** `ffc6a4028676907c266714b5c1ae8ba3af9a7137`; 43 ahead / 0 behind; PR #582 remains draft.
- **Audit branch:** `audit/420grow-v2-01-product-decision-20261008`.
- **Evidence-only commits following this checkpoint:** update only documentation, roadmap and PR commentary, without changing executable source, tests, workflow, dependencies, migration schema, configuration or material scope. They inherit this exact qualified implementation SHA.

## Delivered
- Go facility hierarchy service and separate SQL-backed repository: `grow/facility/service.go`, `grow/facility/postgres.go`, `grow/facility/service_test.go`.
- Create, read, list and revision-checked rename for facility, room and zone. No destructive deletion/reparenting until a separately qualified retention/audit lifecycle exists.
- Verified principal/membership/tenant preflight before private storage reads; V2-02 role action policy and facility/zone-scope denial; cross-tenant/mismatched parent denial; valid naming/revision checks and conflict handling.
- PostgreSQL `grow/storage/migrations/0002_rooms.up.sql` adds tenant-owned rooms with FORCE RLS and composite tenant/facility/room foreign keys. Zones link to verified rooms, preserving legacy zones pending approved migration.
- Multi-migration deterministic checksum/replay/drift logic in `scripts/grow-v2-migrate.py`, with actual PostgreSQL RLS and wrong-parent tests in `grow/facility/qualify.sql`; existing V2-03 persistent tenant schema retained.
- App-only CI in `.github/workflows/420grow-v2-fast.yml` ensures exact head checkout, Go unit/race/vet/format, PostgreSQL 16 schema/replay/RLS tests, V2-01/02 policy verifiers.
- `docs/audit/420GROW-V2-04-FACILITY-ROOM-ZONE.md` defines trust model, hierarchy and limits, `docs/audit/420GROW-V2-04-LEVEL-1-CANDIDATE.md` preserves candidate acceptance.

## Actual qualification evidence
1. **[420Grow V2 Fast #37865044110](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37865044110)** — SHA `f80edd1c6bd7592e2009d353b850f6f091c3f2e0`, job `113609659718`, **SUCCESS**. Required V2-01/02, V2-03 PostgreSQL migrations/replay/RLS, V2-04 security Go test/race/vet/format and SQL FK/tenant boundary checks all pass.
2. **[Retained 420Grow Fast #37865044115](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37865044115)** — same SHA, job `113609659505`, **SUCCESS**. Existing Go/Location/GEN-SVC-2/web, security/static, race, deployment preflight/definition verifiers pass. No missing/skipped required jobs counted as green.
3. **Diagnosed defects corrected:** initial migration-runner ledger probe parsed human-formatted PostgreSQL output; fixed via `psql -At` tuple-only. Early V2-04 candidates failed formatting-only check after Go unit/race success; one-time formatter job #37864809815 successfully applied `gofmt`, and its temporary workflow source was removed before qualified final candidate. Added early principal/tenant membership preflight to block unauthorized storage lookups. All changes requalified at the above candidate.
4. **Unrelated repository checks:** `governance-deployment-audit.yml` has reported failure and broad workflows can skip/queue under global triggers. None are represented as passing V2-04 tests or rerun ceremonially for this app-scoped step.

## Phase boundaries and remaining limitations
- **Level 1 GROW-V2-04:** all documented acceptance requirements satisfied with actual app-specific exact-SHA evidence.
- **Level 2:** cumulative V2-02–05 milestone retained at **GROW-V2-05**; not triggered by this ordinary step.
- **Level 3:** once at V2-15 after reconciliation to then-current main; Solidity Foundry owner and Genesis Address Authority independently qualify distinct inventories without duplication. Earlier original GROW-10 / Foundry PR #567 deferrals remain unresolved.
- **External live/testnet V2-16:** no private HTTP sessions/MFA, deployed database, manual operator acceptance, facility live operation, equipment control, Wallet/Genesis admission or production go-live has been qualified. Service and SQLStore currently require trusted adapter wiring by future steps.

**Next canonical step:** **GROW-V2-05 — Plant lifecycle, genetics and cloning records**.
