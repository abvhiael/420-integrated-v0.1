# High Country — testnet and remaining acceptance work register

**State:** OPEN / not qualified. This register preserves canonical R04/R05/R07 step ownership. It is not permission to ship, nor an assertion that requirements have passed. Added after R04.5 targeted Level 1 PASS on implementation SHA `d4cbee54fcc2c7a98706cc88cb54e1b8ccb1025e`; see `qualification/R04.5-LEVEL1-EXACT-SHA.md`.

## I. Work requiring production-equivalent live testnet or external authority — deferred

| Dependency | Canonical owner | Live acceptance / evidence required |
|---|---|---|
| Live authenticated economy database and recovery | R05.1/R05.2 and R07 | Provision externally authorized namespaces and secret-managed TLS Postgres pool, verify least-privilege SELECT/UPDATE-only service role and migration isolation, serializable concurrent writes across deployed instances, crash/restart recovery, failover/retry and backups. The committed SQL fixture is not this test. |
| Production identity, principal and issuer credentials | R05.2 / R07 | Independently configured session authority, verified registered identities, role issuance/revocation, operator key rotation, privileged source-proof signer provenance and audit trail; prove guest saves and unauthenticated wallet strings cannot issue or spend BUDS. |
| Trusted reward catalogue activation | R04.5 / R05 / R07 | Approve versioned numeric prices/reward ceilings and signed evidence provider, run inflation, collusion, rate-limit, anti-bot, replay, expiry, role revocation and operational monitoring on deployed services; reject fabricated/offline claims. |
| Deployed cross-service economy observability | R05 / R07 | Real consumer/client/service, outbox/Indexer/API views and logs reconcile issued/reserved/burned state after failures; alert on accounting divergence. |
| Release safety and operations | R07 | Security acceptance, incident response, rollback, credential compromise recovery, migration dry run, audit logs, backup restoration and live deployment/config qualification. No production readiness before explicit signoff. |

## II. Repository-side and cross-feature prerequisites — NOT deferred merely for want of a testnet

These must be implemented and qualified at their *own canonical steps* before live release and are **not complete in R04.5**.

| Work | Retained owner / phase | Required pre-testnet deliverable |
|---|---|---|
| Authenticated service composition and authoritative account mapping | R05.1/R05.2 | Wire the existing `AuthenticatedEconomyService`, durable repository, reviewed catalogue, signed evidence verifier, security context, session-bound API and safe client contract. Test compromised/expired/revoked principals and prove caller-supplied owner IDs cannot authorize debits. |
| Reward numeric catalogue & inflation guard | R04.5 plus relevant R04.6/R04.7/R04.8 catalogues | Approve per-action reward values and issuance limits; validate real source proofs and monotonic uniqueness; failure to approve numbers prevents source activation. No guessed constants or minting from local preview. |
| Asset and BUDS atomic full-fill trade | R04.8 — Market | Implement atomic asset reservation/release and money settlement, exactly-one winner for concurrent buys, cancellation/expiry refunds, failures/retries, zero listing/trade fee, anti-self-trade and no free item/credit on half-success. Existing standalone BUDS transfer is not integrated trade. |
| Persistent account lifecycle and migrations | R05.1/R05.3 | Durable datastore schema, migration/outbox/reconciliation and real PostgreSQL integration tests under controlled local CI; don't postpone code/tests solely because production servers aren't running. |
| Economic app integration milestone | R04.5–R04.8 boundary | Exercise R04.5 ledger with authoritative R04.6/7 reward issuers and R04.8 asset market after those canonical steps are implemented. Conduct app-scoped Level 2, not redundant global inventories. |
| R04 phase closeout | End of R04 after R04.14 | Exact cumulative merge-candidate SHA, reconcile current main, canonical full Foundry once via Solidity Contracts, Genesis authority independently, 420 Integrated, Docs, retained app/client/service tests, static/security and deployment/config checks. |

## Guardrails

- The existence of this register **does not waive any canonical roadmap step or launch criterion**. When an item can be tested in a local integration harness, write and run those tests pre-testnet.
- Do not expose BUDS as native $420/bridged/withdrawable token; guest balances are noncanonical; neither wallet linkage nor premium status grants protected production or score multipliers.
- Level 1 at R04.5 qualified the repository ledger core only. The app remains unreleased; R04.5 milestone, R04 Level 3 and live/testnet items retain open acceptance.
- Preserve exact-SHA inheritance: this documentary register and corresponding evidence file are evidence-only changes and do not modify executable semantics.

## R04.8 canonical inventory custody / multi-domain settlement handoff (2026-10-12)

Repository engineering in PR #618 adds permissioned, replay-protected `ResourceLedger.transferReserved` and `InventoryRegistry.transferReservedFor`, plus a durable `CanonicalMarketSettlement` prepare/finalize/abort intent (BUDS funds are reserved before any blockchain handoff; payout requires independently verified finalized canonical transfer; abort requires irrevocable negative/cancellation proof; indeterminate execution remains frozen for operator reconciliation). Canonical escrow adapters now disable instant market purchase. Exact implementation SHA qualification is required for these new changes; prior R04.8 evidence is superseded for executable code.

**Pre-testnet acceptance still required:** provision and authenticate a real chain-reader/escrow receipt authority and market operator mapping; generate deterministic receipt and transfer operation IDs; bind transfer authorization to escrow consent and ownership; persist cross-ledger intents across worker crashes and multi-instance concurrency; prove that chain transfer cannot occur after a certified cancellation and that stale/reorged receipts cannot release BUDS. Local mock-only tests are not equivalent to live end-to-end integration. Implement API/outbox worker, bounded retry/repair procedures, schema hardening and a production-like local Postgres database exercise before declaring repo integration complete.

**Live-testnet deferred acceptance:** actual chain-lock and reserved-transfer transactions through deployed R04.1, finalized receipts and chain reorgs; deployed signer/revocation/role and chain authority; real operational observer/Indexer reconciliation; cross-process PostgreSQL serializable contention/failover with production-equivalent permissions and secret/TLS wiring; complete external security and release signoff. None are waived or reported as PASS.

### Revised R04.8 testnet gate after canonical escrow implementation

Current R04.8 PR #618 additionally contains `CanonicalMarketEscrow` owner-authorized listings, explicit distinct market transfer opt-in on `InventoryRegistry`, replay-proof `ResourceLedger.transferReserved`, `CanonicalMarketSettlement` serializable BUDS reservation and finality-gated completion/refunds, `CanonicalEscrowReader` of actual escrow contract state/logs, canonical receipt binding, and a local Postgres 16 integration CI job. The original missing *method* for reserved custody transfer has been implemented. **This is not yet proof that the deployed system performs safe end-to-end settlement.** The latest implementation SHA must pass all updated R04.8 Level 1 and economic Level 2 jobs before new exact-SHA evidence is certified.

**Pre-testnet engineering not to waive:** combine the reader, authenticated principal/address resolver, approved scoped operator and chain transaction writer in an auditable service worker; persist submission/outbox/idempotency and recover from crash before/after chain submission; integrate RPC/Indexer and client interfaces in R05; approve actual reward/fee limits and evidence source catalogues; validate local PostgreSQL 16 roles, serializable contention and failure/retry tests; reconcile contract event/ABI and worker inputs without accepting guest/client claims. This work remains OPEN until independently qualified and must not be reported as testnet-gated merely because production credentials are unavailable.

**Live-testnet-gated:** use approved deployed contract/chain addresses and market operator credentials; test finalized chain transfers, stale/reorged receipts and immutable cancellations under network fault; measure deployed PostgreSQL contention, failover, backup/restore and TLS/secret rotation; run multi-instance authenticated service, real player onboarding, client/reconciliation/indexer, alerts, security/governance/release approval. These checks remain DEFERRED / NOT PASSED until actual live execution. Native $420 settlement remains a separately scoped ecosystem-market authority design, not enabled by internal BUDS custody.

## R04.9 lease/license/rights — retained production and testnet obligations

Pre-testnet engineering required: bind R04.9 parcel ownership/occupancy to canonical R02 LandRegistry owner/occupant/occupancyRef rather than trusting an independent shadow owner record; validate plant count and non-eviction against PlantRegistry.activePlantsByParcel from verified canonical state, with app-correct authority and no tenant self-reporting; explicitly map rights scope to land use/lease/license actions and reconcile authorized capacity before new plant admission; specify dispute handling, transfer handoff, immutable usage obligations and the payment/fee ledger instead of treating recorded fee metadata as collected rent. Current R04.9 rights contracts are repository-side draft mechanics and must not be activated as canonical land authority until those links are implemented and qualified. Independent immutable plantAuthority is a fail-closed boundary, not yet evidence of real PlantRegistry wiring.

Live-testnet-only: qualified deployed LandRegistry/PlantRegistry/R04.9 address bindings, Genesis ownership and occupancy permissions, actual chain time and emergency behavior, finalized transfer/revocation observations, end-to-end active-plant migration/cancellation, independent arbitration/Pay integration as applicable, real client/API/Indexer reconciliation, operator credentials and security signoff. These requirements must be tested before production activation but are not claimed passing by targeted CI.

### R04.9 canonical integration follow-up — implementation versus acceptance

Repository implementations now include a typed canonical land/plant gateway, distinct scoped authority bindings in `LandRegistry` and `PlantRegistry`, occupied parcel cultivation admission checks against a *usable* R04.9 lease, active-plant-protected land occupancy clearance, canonical owner/tenant/occupancyRef verification, and post-termination lease reconciliation. Mock LandRegistry and PlantRegistry fixtures alone are insufficient; the R04.9 fast workflow also executes actual R02/R03 registry integration tests, subject to exact-SHA PASS.

**Remaining pre-testnet release checks:** retain lease/license numeric catalogue and fee approval, production service/API/SDK/Indexer mapping, explicit rights and license ownership/transfer reconciliation (including statutory versus game scopes), reviewed Genesis capability grant manifests for `PLANT_BIND_RIGHTS` and `LAND_BIND_PLANTS`, security review of one-time bindings and recovery permissions, and installation/upgrade scripts proving the intended binding order. Declaring these complete without review is prohibited.

**Testnet-only operational acceptance:** configured deployed LandRegistry, PlantRegistry and R04.9 contracts; independently verified and finalized authorization grants, reverse address links and real-asset occupancy identities; deployed admission/revocation/harvest/expiry/ownership-change scenario testing; chain reorg and Indexer/API observation; backups/restore, signer rotation, emergency authority, fee service accounting and final release signoff.
