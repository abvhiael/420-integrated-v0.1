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


## R05.6 — deployed HC/Gaming event-stream acceptance (OPEN / TESTNET-GATED)

Repository-side R05.6 owns exact emitted Solidity topic decoding, direct pinned RPC read semantics, durable PostgreSQL block headers and cursors, transactionally deduplicated events, bounded verified ancestor rollback, finality-gated projections and scoped authenticated query APIs. These do **not** themselves prove official-testnet chain finality or a deployment configuration. The following independent external acceptance remains OPEN:

| Gate | Acceptance requirement | Evidence |
|---|---|---|
| HC-R05.6-T01 | Production-equivalent official chain, frozen Genesis addresses/bytecode hashes for GameClaims420, HighCountryGamingBridge420 and HighCountryMigration420; real finalized and historical RPC providers | Signed deployment manifest, codehash and provider-identity proofs, deploy transactions |
| HC-R05.6-T02 | End-to-end actual deployed ISSUE / CONSUME / BIND / MARK-APPLIED and dependent entitlement events; indexer catch-up, contract replacement, handler limits and schema/topic checks against official chain | Actual signed wallet and operator tx/receipt/log hashes, contract ABIs, matched SQL cursor and projection records |
| HC-R05.6-T03 | Independently witnessed short/deep reorg, empty-block rollback, stale/forked RPC, discrepant nodes, finalized conflict alarm, bounded failover/retry and restart under real chain traffic | Immutable incident trace, canonical chain header witnesses, safe rollback/quarantine, no wrong-account or duplicate user event |
| HC-R05.6-T04 | Live identity revocation, multiple instances/least-privilege Postgres, rotation of RPC/operator credentials, account privacy and finality-gated consumer acceptance; audit/monitoring/signoff | Independent security and privacy approval, account/client contract conformance, operator release gate |

**Status:** all T01–T04 NOT WITNESSED/NOT RUN. These are additive to R05.7's independently canonical high-risk state verification and R05.8's production SDK transport ownership. Never treat a PostgreSQL fixture, disposable Anvil, or an injected verifier returning `true` as these independent public-testnet acceptances.


## R05.7 — canonical high-risk read/finality acceptance (OPEN / TESTNET-GATED)

R05.7 repository-side evidence verifies high-risk claim, consumed/bound migration, ownership, entitlement, attestation, submitted migration receipt and configured reward reads by EVM ABI calls pinned to a single `finalized` header; independently witnessed second-RPC chain/hash finality and deployed runtime bytecode hashes; verified receipt block/log and exact immutable source mapping. Never accept a caller, SDK or indexer `finalized:true` value as finality proof.

| Gate | Real acceptance / external owner |
|---|---|
| HC-R05.7-T01 | Official deployed chain IDs, frozen Genesis contract addresses/codehashes, validated production manifest and two truly independent finalized-capable RPC operators with keys, rotations and safe deployment/start heights |
| HC-R05.7-T02 | Real GameClaims consumed/wallet/grower binding, GameIdentity profile ownership, GameEntitlements issue/revoke/expiry and CrossGame attestation issue/revoke/expiry, witnessed against real wallet and contract-wallet sessions and exact canonical blocks |
| HC-R05.7-T03 | Actual HighCountryMigration420 markApplied transaction and MigrationApplied log/receipt witness under production operator identity, chain forks, RPC disagreement, finalized-head lag, missing history, reorg across receipt, and outbox replay/partial failure |
| HC-R05.7-T04 | Real reward/progression/harvest finality adapters tied to the separately approved canonical module ABI and payout/ledger policy; no unapproved selector, indexer projection or missing manifest may approve an economic action |
| HC-R05.7-T05 | Independent security, operating and audit review of dual-RPC independence, failover/alerts, timeouts/DoS budgets, predeploy replacement/upgrade codehash changes and consent/identity-revocation integration |

**All gates OPEN / NOT RUN in the official testnet.** A local mock, disposable Anvil or an injectable callback returning true is not a real second-RPC witness. Level 1 may qualify the implementation and fail-closed adversarial tests without falsely certifying these live acceptance conditions. R05.8 owns deployed transports/network detection and R05.9 owns operational abuse/monitoring.


## R05.8 — Gaming SDK deployed transport acceptance (OPEN / TESTNET-GATED)

R05.8 repository implementation provides seven-contract configured manifest validation, same-chain wallet/provider checks, immutable exact-EVM selector bindings and blockHash-pinned runtime bytecode checks, bounded idempotent RPC read retries, and authenticated event-feed transport without client-provided account authority. These do not by themselves qualify an official deployment.

| Gate | Official acceptance |
|---|---|
| HC-R05.8-T01 | Freeze approved official Genesis deployment addresses and runtime codehashes, seven-ABI manifest versioning and signed configuration provenance, official chain ID and distinct HTTPS primary/witness RPC operators |
| HC-R05.8-T02 | Exercise deployed Wallet (including externally managed contract wallet), actual connected network changes/disconnects, selected game profile, code replacement, stale/forked RPC and consumer network recovery |
| HC-R05.8-T03 | Production-equivalent authenticated SDK HTTP transport, revoked/expired session, cross-account privacy, mobile/desktop handling, preflight/CORS, pagination and bounded outage/rate-limit responses |
| HC-R05.8-T04 | End-to-end generated ABI parity at production deployed bytecode and upgrade manifests; actual GameClaims/Gaming Identity/Entitlements/CrossGame/HighCountry client consumption and signed operator approvals |
| HC-R05.8-T05 | Operational failure-budget, retry/backoff, circuit-breaker/metrics, network failover and security/privacy/device testing at deployment scale; R05.9 remains abuse/observability owner |

**All T01–T05 OPEN / NOT RUN on official testnet.** Mock responses and local SDK tests are repository Level 1 evidence only. No browser wallet private key is stored or sent through the service.


## R05.9 — production abuse protection and security operations (OPEN / TESTNET-GATED)

Repository-side R05.9 adds shared DB-atomic per-account/game/action HMAC-based rate buckets, least-privilege SQL ownership/RLS, authenticated player event rate checks, canonical and policy commitment anti-cheat gates, privacy-safe observability event categories and fail-closed server-only secret retrieval. No new wallet-wide transaction history API or raw save on-chain is authorized.

| Gate | Production-equivalent acceptance |
|---|---|
| HC-R05.9-T01 | Live multi-instance quota and throttling under real gateway/proxy load, trusted upstream client identity, rate clock/window boundary contention, protection against distributed subject switching and availability attacks |
| HC-R05.9-T02 | Independent integrity/anti-cheat validation of actual game action submissions/replays and finality with real registered profiles, authoritative gameplay state and economy-ledger services |
| HC-R05.9-T03 | Real observability/alert routing, rate-limit and RPC/reorg dashboard, privacy and data-minimization audit, operator incident response and retention/erasure procedures |
| HC-R05.9-T04 | Production secret manager/KMS integration, HMAC key rotation and cross-instance consistency, least-privilege runtime and operator roles, zero plaintext credentials in logs |
| HC-R05.9-T05 | Live security review, threat modeling, adversarial concurrent sessions, denial-of-service/anti-bot abuse, HTTP boundaries and release approval |

**All R05.9 official-testnet/operational gates remain OPEN.** Local PostgreSQL and mock policy-verifier tests cannot substitute for independent live production acceptance; these do not block isolated R05.9 repository Level 1 qualification.


## R06.1 — real browser shell external acceptance (OPEN / TESTNET-GATED)

Repository R06.1 delivers a real static web app package, accessible routed game shell, explicit offline/connected runtime, actual JSON-RPC chain detection and honest unavailable/wrong-chain states. The build/server never fill unresolved deployment addresses with placeholders. R06.1 **does not** claim playable cultivation; that belongs to R06.2 and later steps.

- **HC-R06.1-T01 OPEN:** Approved and independently reviewed deployed address/chain/gameId manifest and actual HTTPS RPC/API deployment with verified provenance; deployment template currently contains unresolved/null claims.
- **HC-R06.1-T02 OPEN:** Actual deployed browser cross-origin, CSP, HTTPS, accessibility/device, performance and offline/outage tests with qualified API and independent RPC operators.
- **HC-R06.1-T03 OPEN:** Release deployment and operator/config rotation approval. No client secret, wallet key, raw save, or chain-wide wallet activity in public configuration.

These external checks are not represented as local repository Level 1 results.


## R06.3 — optional registered account, cloud-save and recovery: external acceptance register

**Repository implementation:** `b49b1904c53c17792518569f0f81f9f92b21e1bd`; branch `audit/highcountry-r06-1-browser-shell-20261014`, draft PR #654. Targeted R06.3 browser client [run #38661245070](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38661245070) and authenticated cloud service [run #38661244932](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38661244932) are **SUCCESS** on that SHA; retained R05.3 Level 2 [run #38661245115](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38661245115) is **SUCCESS**. These results establish repository checks, **not actual deployed issuer/provider/browser acceptance**.

| Gate | Status / owner | Independent live evidence required |
|---|---|---|
| HC-R06.3-T01 — verified external identity issuer and signup | OPEN — R05.2 / R07 operator and identity service | Approved identity issuer, verifiable issuer-to-datastore registration/onboarding, issuer-owned credential creation, expiry/epoch/revocation/recovery, compromised and wrong-game subject denial, trusted `highCountryAuth.getToken` handoff with no browser-stored long-term credential |
| HC-R06.3-T02 — actual deployed service and cloud infrastructure | OPEN — R05.1/R05.5 / R07 | HTTPS frontend/API with origin/CORS/CSP review; least-privilege TLS PostgreSQL, provisioned encrypted immutable object storage, secret management, consent-policy/ruleset provenance and scoped credentials; recorded deployment manifest and operator approval |
| HC-R06.3-T03 — real guest-to-account and cloud-save lifecycle | OPEN — R06.3 / R05.5 | Actual browser sign-in and optional profile registration; explicit approved CLOUD_SAVE consent; local preview upload/read on separate devices; revision CAS conflict across concurrent accounts/devices, session revocation, failed writes/provider corruption, data isolation; never elevate editable local saves into canonical assets, scores or currency |
| HC-R06.3-T04 — recovery and privacy/retention acceptance | OPEN — R06.3 / R05.5 / R07 | Independently observed old-revision restore creating new head, interrupted provider writes/retries/outages, backup recovery, delete/export and consent revocation/retention procedures with object/provider receipts; no unnoticed overwrite of device save |
| HC-R06.3-T05 — browser, device and independent security review | OPEN — R06.7/R06.8 / R07 | Real desktop/mobile browser accessibility (keyboard, focus, status errors, form labels), authenticated CORS/preflight, rate-limit/privacy/CSRF and session handling, multi-instance abuse, operator/security/privacy signoff and rollback drill |

**Do not relabel live T01–T05 as passed because local CI is green.** Identity issuer provisioning and credential issuance are external/operational dependencies; the app's profile registration does not create a fresh issuer account. Real multi-device/browser/service/db/provider exercises require a deployment with authorized secrets. R06.3 completion at the *repository implementation* level may be assessed against its original exit criteria and exact-SHA tests independently of these operational gates; unresolved repository-testable browser/service behavior is not automatically excused by this list. Canonical R06.4–R06.8 numbering and R07 acceptance remain unchanged.
