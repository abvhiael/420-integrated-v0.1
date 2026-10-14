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

### R04.10 — Organization authority operational handoff

**Repository implementation, pending exact-SHA Level 1:** Consent-based organization membership, bounded noncustodial delegation, bilateral pending-obligation reconciliation, independently authorized treasury *permission policy*, role revocation and administrator rotation. The policy cannot sign wallet transactions, move funds, discharge actual debt or override canonical RightsRegistry.

**Pretestnet remaining:** Review actual organizational role/action/scope catalogues; wire an authenticated organization/treasury adapter to the canonical independently governed Treasury rather than relying on `OrganizationTreasuryPermissions.permitted` as evidence of money settlement; reconcile member identity/address proof; provide reviewed deploy/upgrade wiring and signer separation; register ABI, events, API/Indexer/RPC/Wallet integration where applicable; security review revocation, signers and obligation disputes.

**Live testnet:** Verify deployed canonical Treasury code/address authority and independent approver, execute authorized/over-limit/replay/revoked/expired attempts against real asset balances, index membership/delegation/treasury events, observe reorg/recovery/failover and multisig rotation, perform incident drills and close operational/security approvals. None of these are silently credited as PASS from source-only Level 1.

## R04 accumulated Level 2 — authority, competition and replacement acceptance

This adds operational gates without changing the R04.1–R04.14 sequence. The source-level review is `R04-LEVEL2-INTEGRATION-REVIEW.md`; the accumulated milestone is **NOT COMPLETE** while its integration findings remain open. Green retained CI alone cannot close those findings.

| Genuine deployment/testnet dependency | Canonical owner | Required independent evidence |
|---|---|---|
| R04.11 organization/cooperative authority | R07/R09 | Actual deployer handoff, member identities, executor binding, role revocation, finalized events and independently authorized Treasury/Identity consumers |
| R04.12–13 competition/Cup operation | R07/R09 | Deployed canonical harvest/finality and optional entitlement adapters, real player signatures, revocation/dispute/reorg observations, semifinal/final provenance and exact scoped cross-game consumer acceptance; funded prize acceptance only if separately specified |
| R04.14 emergency council | R07/R09 | Actual officer credentials and controller-address per-domain restrict/release grants; revoke bootstrap grants; operate real consumer ingress/recovery/veto/release under network faults and retain receipts |
| R04.14 replacement rehearsal | R07.5/R09 | Code hashes, independent review, timelock, drain/snapshot/migration/config publication, explicit old-grant revocation, replay preservation, service rebinding and rollback/recovery; acceptance provenance is not an executed replacement |
| Shared operational security | R07/R09 | Deployed signer/secret/TLS rotation, production-equivalent database backup/failover/permissions, monitoring and independent operator/security approval |

**Engineering work is not deferred merely because no live testnet exists:** canonical harvest/finality and entitlement adapter implementation, missing R04 mutator emergency enforcement, authenticated reward/account/settlement composition and actual local cross-component integration remain open under the existing R04/R05 owners. Review findings INT-R04-01 through INT-R04-04 retain these boundaries. No production readiness, R05 start or R04 merge is authorized by this register.


## R04 accumulated Level 2 engineering reconciliation — 2026-10-13

Repository app Level 2 is **COMPLETE** at implementation `93655ca49f0e305f99cd0c13f53f88479b20b316`, [run #38358551332](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38358551332), with 304 Foundry tests, 35 Node tests, actual PostgreSQL and actual local-chain authenticated runtime integration; build/size and canonical verifier PASS. See [exact-SHA certificate](qualification/R04-LEVEL2-EXACT-SHA.md) and [accumulated review](R04-LEVEL2-INTEGRATION-REVIEW.md).

This supersedes earlier OPEN/NOT COMPLETE engineering status only for the implemented INT-R04-01 through INT-R04-05 app milestone: canonical harvest/finality/entitlement/Cup adapters; R04 emergency consumer enforcement and safe refunds/exits; authenticated source/account/settlement composition; actual manufactured equipment/lifecycle/plant rights/Treasury/Identity/scoped cross-game integration; and exact-SHA qualification. These are implemented and locally qualified, rather than postponed because live credentials were absent. Old step-specific chronology remains intact.

**This register's live operational qualification remains OPEN.** All independently deployed address/code/grant, catalogue/signer/session/operator, funded Treasury/vault, finality/quorum/reorg/network, TLS/secret/backup/failover/monitoring and security approval rows above remain mandatory. R07.5 replacement/migration/rollback rehearsal is not performed by UpgradeCoordinator provenance. No production readiness or R04 merge is authorized.

Separate Level 3 must refresh/reconcile main and run its canonical complete exact-SHA gate. The complete R05 cloud-save/migration/provider/Indexer/SDK/client/abuse/privacy engineering scope retains its existing owners and is not certified here. R05.1 remains the next canonical phase step; scoped dependencies for this milestone do not renumber or automatically advance the phase.

## R04 repository Level 3 closeout — 2026-10-13

Accumulated R04.1–R04.14 repository phase qualification is **PASS / COMPLETE** at exact implementation `f7a3da6f96b62d018f69aa5e98d3819b5ad32706`, reconciled with current main `959288c8bd33b6da0325b6a5d060e00e7bcf0e48`. Canonical Solidity-owned four-shard inventory/mandatory coverage/fixture, Genesis address/manifests, global, Docs and retained app/runtime/security/client/configuration all pass. See [final exact-SHA certificate](qualification/R04-LEVEL3-EXACT-SHA-CERTIFICATION.md).

This closes repository phase qualification only. Every live deployed authority/credential/code/address/grant, consensus finality/reorg/quorum/network, funded Treasury/vault, infrastructure/operator/security approval and R07.5 migration/replacement/rollback requirement above remains OPEN. No full R05/R06/R07 qualification, R05 start, R04 merge or live release is claimed.


## R05.4 — live GameClaims and wallet migration acceptance (OPEN / TESTNET-GATED)

The following requirements remain with **canonical R05.4**, not reclassified as accomplished. Repository-local simulation and injected verifier fixtures are not independent deployed acceptance.

| ID | Live-testnet requirement | Required witnessed evidence |
|---|---|---|
| HC-R05.4-T01 | Independently confirm official chain, frozen deployment addresses, GameRegistry operator/permissions, GameClaims/HC bridge/migration bytecode and ABI. | Signed manifest, chain IDs, RPC provenance, contract code hashes, unauthorized issuance denial |
| HC-R05.4-T02 | Real conventional session, independently linked EOA and supported contract wallet, account GameIdentity profile and grower binding; operator issues exact reviewed commitments and bounded claim. Player wallet itself signs/broadcasts `consume` and `bindConsumedMigrationClaim`. | Player consent, issuer & wallet transaction hashes, signed receipts, wrong signer/expired/cancelled/duplicate/adversarial outcomes, no server player keys |
| HC-R05.4-T03 | Complete issue → consume → bind → DB application → markApplied → finalized receipt under actual chain/RPC and independently proven canonical finality. | Finalized block hashes, immutable application/outbox/receipt sequence, real reorg and RPC disagreement recovery, no duplicate save or receipt |
| HC-R05.4-T04 | External operator custody/HSM, RPC and identity credentials, rate limiting, live session revocation, TLS, key rotation, backups, observability and incident recovery. | Security/operator witness, deploy configuration, independent revocation and failover tests |
| HC-R05.4-T05 | Independent signoff for replay, chain/contract authority, privacy, backup integrity, retry/dead-letter and controlled live operations. | Signed testnet acceptance docket and traceable exact-deployment SHA |

**All T01–T05 remain UNRUN / OPEN.** R05.7 owns canonical-finality implementation and its independent acceptance. R05.5 owns durable save-provider integrity and backup/conflict policy. R05.4 local-contract/unit/integration tests must still run in GitHub before calling repository development complete. External deferral does not waive any local-testable requirement, R05.4 exact-SHA Level 1, or future Level 3 phase qualification.


## R05.5 — cloud-save provider and retention acceptance (OPEN / LIVE-TESTNET-GATED)

R05.5 repository-side saves must use authenticated account/game-scoped DB references, exact local schema/version, immutable encrypted provider objects, revision CAS, independent copies, consent and deletion tombstones. The following require real provisioned live environments and **remain NOT WITNESSED**:

| Gate | Real acceptance and owner |
|---|---|
| HC-R05.5-T01 | Official object-storage provider credentials, endpoint and bucket segregation, TLS/KMS encryption, audited least privilege, immutable-object semantics, secret/key rotation and regional residency/privacy review |
| HC-R05.5-T02 | Real mobile/desktop local-save schema upgrades and compatibility with previous clients; signed sessions, consent/revocation across devices, concurrency conflict/restore UX and independent accessibility review |
| HC-R05.5-T03 | Cross-region durable backup and restore, destructive provider outage, corruption/overwrite, high latency, concurrent instances, reconciliation after process crash and backup key rotation with real provider receipts |
| HC-R05.5-T04 | Independent retention schedule, account right-to-delete, legal hold/required audit metadata policy, deletion-worker failure/retry/dead-letter, orphan sweep and provider-side physical deletion witness without deleting shared blobs |
| HC-R05.5-T05 | Independent security/privacy/legal operator signoff, data-subject export/delete acceptance, monitoring, incident rollback and production-equivalent deployment gate |

All T01–T05 remain OPEN. No local encrypted provider fixture or PostgreSQL simulation can stand in for live cloud provider acceptance. Full R05 Level 3 qualification and all other roadmap exit criteria remain separate; testnet transfer changes only *where* external evidence is collected.
