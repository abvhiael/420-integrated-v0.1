# R04 Level 2 — accumulated High Country integration milestone

**Scope and baseline.** Canonical R04.1–R04.14 have step-specific Level 1 records. The milestone is a retained **High Country app-scoped** qualification across inventory, resource conservation, equipment/manufacturing, BUDS/settlement, progression, missions, markets, rights/leases, organizations/cooperatives, canonical competition and Cup, and explicit upgrade/emergency controls. This review does not certify operational deployments.

**Exact-SHA requirement.** The dedicated `.github/workflows/highcountry-r04-level2.yml` checks out the PR implementation SHA and runs a High Country-only compilation/bytecode check, all `test/highcountry/**/*.t.sol` retained app tests, and canonical High Country verifier. A successful general Solidity workflow with skipped Foundry jobs is not evidence. Level 2 acceptance is pending until this run is fully green.

**Integration seam findings:**
1. R04.11 cooperative roles and R04.14 reviewer/release roles are intentionally distinct; neither authorizes automatic treasury payments or arbitrary implementation calls.
2. R04.12 competition accepts external independently qualified finalized FLOWER harvest and entitlement adapters. R04.13 Cup consumes competition results and emits scoped prestige only. Cross-game clients and canonical finality remain external acceptance, not evidence from local mocks.
3. R04.14 SecurityCouncilController writes through existing EmergencyState; the controller principal **must** possess exact per-domain restriction and release capabilities. No deployment manifest or operator grant chain has yet been accepted; a unit fake is insufficient proof of live integration. Record as a live/testnet dependency.
4. R04.14 UpgradeCoordinator records codehash-pinned acceptance only. No authority to silently migrate or rebind immutable deployments. Drain, published migration/config manifest, old grant revocation, replay integrity and operational rollback/recovery require a separate R07 deployment rehearsal. Never claim this Level 2 test executed an actual replacement.
5. Incident recovery must preserve previously qualified refund/exit semantics in R02.8 and accrued accounting for earlier R04 engines. Retained app tests are necessary, but actual emergency-chain grant and user sessions on production-equivalent network are still unqualified.
6. Protected competitive score is FLOWER quality only; optional wallet entitlements confer entry, not stat/score advantage. Mock test sources are not canonical production evidence.

**Milestone exit:** exact-SHA retained High Country app suite PASS and verifier PASS; reconcile any uncovered integration defects before marking repository-side Level 2 qualified. All missing live operator/grant/consumer, signed-wallet, finality, deployment and migration evidence must be separately identified as deferred testnet/R07 dependencies. Phase-level full Solidity, independent Genesis address authority, 420 Integrated and global Docs run only once at Level 3 after reconciliation to main.

**Next canonical roadmap:** R05.1 — datastore schemas/migrations and repositories for accounts, game profiles, cloud-save references, consent and migration records.
