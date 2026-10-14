# BNB-4.7 — M4-A Level 2 Integration Qualification

**Disposition: REPOSITORY LEVEL 2 PASS — external production/testnet acceptance still gated.**

## Canonical scope, history and frozen exact source

- Canonical owner: [BNB-PHASE4-ROADMAP.md](BNB-PHASE4-ROADMAP.md), **BNB-4.7 — M4-A integration milestone**. On a single accumulated implementation SHA, qualify BNB-4.2–BNB-4.6 retained app suites, cross-provider failure/privacy/economic matrices, producer-consumer contracts and exact-SHA evidence.
- Repository: `abvhiael/420-integrated-v0.1`; audit branch `audit/bnb-phase4-bnb-4-1-baseline-20261013`; **draft, open and unmerged** [PR #631](https://github.com/abvhiael/420-integrated-v0.1/pull/631).
- **Exact Level 2 qualified executable SHA: `cd799f314ba68fbb290228dded2035018b190723`.** The commit that adds this document is evidence-only, not a change to the qualified implementation.
- Original Phase 4 base `81c21541acdc1b900b9a15c6f6b75ff2d7c2b5d9`. Latest verified current `main` `959288c8bd33b6da0325b6a5d060e00e7bcf0e48` at review. This milestone does not reconcile accumulated Phase 4 with `main`; that is canonical BNB-4.12 Level 3 work.
- Direct prerequisite: [BNB-4.6 Level 1 certificate](BNB-4.6-BOOKING-ECONOMIC-LEVEL1.md) at `21dd9667b2efc0449d4902421dc82d52fdb71c35`. BNB-4.2–4.5 qualified work and tests are retained on this branch.

## Producer-consumer and cross-provider Level 2 matrix

| Producer / canonical authority | BNB consumer / retained contract | Boundary, negative and recovery protection | Evidence |
| --- | --- | --- | --- |
| BNB inventory/holds/calendar | BNB-4.3 versioned availability projections | Current property mutation lock; source revision and stale-version read rejection; half-open/DST, concurrent holds and expiry; projection **never** accepts a booking | Retained `test_bnb43_projection.py`, `test_postgres_adversarial.py`, new `test_bnb47_m4a_integration.py` |
| Property/Location/Compliance signed eligibility | BNB-4.4 Search and Travel local consumer checkpoints | Ineligible source tombstone, private-address minimization, per-consumer revision monotonicity, stale/forged publication rejection, retraction of revoked source. Independent operational consumption remains testnet gated | `test_bnb44_discovery_sync.py`, `test_bnb47_m4a_integration.py` |
| Booking request and independent Identity role | BNB-4.5 guest/host message thread and device cursor | Authenticated request scope, revoked/deleted-account denial, closed-thread boundary, cross-tenant IDOR, content redaction and no outside notifier | `test_bnb45_delivery.py`, retained API adversarial tests |
| Same-transaction BNB lifecycle | BNB-4.2 durable outbox and local adapter | Fenced competing claims, replay/idempotency, backoff/dead-letter, redacted payload, allowlisted `bnb.pay.case_reconciled` marker and no unapproved external delivery | `test_bnb42_outbox.py`, `test_bnb47_m4a_integration.py` |
| Canonical 420Pay invoice/finality, Wallet consent | BNB-4.6 booking saga, provider economic mirror | Invoice and original payer domain checks, signed source finality, late/replayed/reorg receipts, status/hold lock, stale-finality recovery; no BNB custody, fake finality or new inventory admission | `test_bnb46_saga.py`, `test_bnb46_database.py`, `test_postgres_adversarial.py`, `test_bnb47_m4a_integration.py` |
| Canonical 420Pay case/disbursement evidence | BNB-4.6 independent case revisions, refund and payout projection | Cross-payment/case replay denied, original-payer refund, Pay-issued decision only, terminal/refund receipt, split conservation, disputed/reorg payout freeze, reserved vs finalized liability | `test_postgres_adversarial.py`, `test_bnb46_saga.py`, `test_bnb47_m4a_integration.py` |

**M4-A implementation addition:** `services/420bnb/tests/test_bnb47_m4a_integration.py` tests real PostgreSQL shared inventory/property state alongside discovery synchronization, immutable redacted outbox events, tenant-scoped reservation saga and Pay accounting matrix, including revocation/recovery paths. The existing retained BNB tests and interfaces are not weakened or replaced. No ABI/address/Genesis contracts were changed for this milestone.

## Exact-SHA retained application qualification

- **Required full 420BnB Runtime Slice [run 38482372580](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38482372580), job `115588005585`, terminal SUCCESS** at exact `cd799f314ba68fbb290228dded2035018b190723`.
- Logs confirm **8 migration/operations PASS + 271 full app/API/security/integration PASS = 279 tests passed, 0 failed**. Version-26 migrator, PostgreSQL transactional/adversarial tests, production-ready schema and role checks, TLS fixture, backup/restore, non-root immutable container, deployment/topology checks, frontend and accessibility smoke were retained and completed successfully.
- **Nine retained 420BnB workflows terminal SUCCESS on the exact same SHA**:
  - BNB 1.1 Source Reconciliation `38482372535`
  - BNB 1.2 Product Contract `38482372672`
  - BNB 1.3 Domain/M1 `38482372724`
  - BNB 1.4 Authority Boundaries `38482372659`
  - BNB 1.5 Financial/M2 `38482372617`
  - BNB 1.6 Backend Architecture `38482372658`
  - BNB 1.7 Guest/Host `38482372570`
  - BNB 1.8 Security/Privacy `38482372676`
  - BNB 1.9 Deployment Operations `38482372758`
- 420Docs `38482372532` was **SKIPPED** under app-only qualification and is not counted green. Unrelated Governance `38482368333` and 420Hz `38482367245` workflow runs failed; they are not substituted as required M4-A evidence. Separate Oracle `38482372652` was IN PROGRESS at inspection, not included in BNB 9/9.
- No required BNB application check was substituted with a skipped/cancelled/older run. The exact implementation SHA remains fixed across the full retained app matrix.

## Deferrals, milestone completion, next exact roadmap step

- This is **repository-bound app Level 2** only. Independent live 420Pay/Wallet/Identity, Search/Travel/Compliance, real calendars, device notifications, staffed dispute/casework, independent accessibility, jurisdiction/legal/privacy approval, real source finality and production recovery are still individually gated in [BNB-TESTNET-WORK-ROADMAP.md](BNB-TESTNET-WORK-ROADMAP.md). Preserve all 17 named external requirements and `travel.bnb_booking=false`, `booking_enabled=false`, `financial_execution=false`.
- Full repository Foundry/Genesis address authority/Integrated/global Docs/Geth and final current-main merge-candidate reconciliation are intentionally **deferred to BNB-4.12 Level 3**, without duplicate Foundry qualification.
- **BNB-4.7 M4-A: Level 2 COMPLETE.** PR #631 **must remain draft/open/unmerged**. No external testnet gates are marked accepted and no live authorization is issued.
- **Next canonical roadmap step: BNB-4.8 — Independent host operations and dispute casework.**
