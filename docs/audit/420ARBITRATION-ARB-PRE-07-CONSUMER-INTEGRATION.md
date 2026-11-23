# ARB-PRE-07 — Arbitration consumer integration and authority boundary

Repository-side integration inventory, 2026-11-23. Baseline: `main@eaa4484ac9106a215a0c9943d95519e7bd6ba398` (merged ARB-PRE-06). This is **not** a claim of live-testnet deployment. Arbitration coordinates cases and publishes ruling commitments; it cannot directly move funds, change asset ownership, override a consumer's transition authorization, or undo final chain history.

## Implemented consumers versus conditional integrations

| Consumer | Current source-level classification | Authorized behavior / fail-closed boundary |
| --- | --- | --- |
| **420Market / Commerce** | **Implemented, opt-in case consumer; no remedy executor** | `commerce/src/arbitration.mjs` verifies pinned ProtocolRegistry service/version/manifest/dependency/code hashes, chain-finalized snapshot, distinct Router/Policy/Case/Ruling graph. `commerce/src/service.mjs` prepares a seller-authorized Market dispute, validates domain `420/arbitration/domain/market/v1`, origin `420/component/market/v1`, exact order ID, claimant, respondent, claim and requested-remedy commitments. After linking, each new evidence/appeal action revalidates the current canonical Market order/dispute and *both* case parties. Its dispute view distinguishes ruled vs finalized vs remedy not executed. Actual refunds stay with Pay RefundManager, not Arbitration or Commerce. |
| **420Launchpad crowdfunding** | **Implemented on-chain case link and finalized-outcome evidence publisher; no remedy executor** | `LaunchpadCrowdfundingIntegration420.sol` binds immutable Case/Ruling registries, claimant, project controller respondent, `CROWDFUNDING_DOMAIN`, Launchpad component and sale ID. Publication checks *again* at consumption time that the current case has the same claimant/respondent, domain/component/sale and FINALIZED state, obtains the current appeal round's ruling, requires nonzero ruling/remedy commitment and records a one-shot case outcome. It emits `DisputeOutcomePublished` and notification; cannot refund Pay, cancel a sale, rewrite allocations, or transfer assets. `launchpad/service/core/planner.mjs` prepares Wallet intents; `consumer.mjs` separately verifies observed case origins. |
| **420Pay** | **Indirect financial origin, not an Arbitration remedy adapter** | `PaymentRegistry420`/`RefundManager420` hold exclusive payment/refund and funded-delivery rules. Commerce and Launchpad may read their finalized receipts, but an Arbitration result never calls the refund manager by itself. No new automatic refund route is authorized. |
| **420Rights** | **Potential domain/origin, no qualified direct consumer transition** | Existing Rights ownership/claim registries retain independent canonical authority. Do not create a ruling-to-rights overwrite or ownership transfer from a dispute UI. |
| **420Grants** | **Potential dispute consumer; no active Arbitration remedy transition identified** | Grants governance, allocation and release approvals remain with Grants/treasury-authorized mechanisms; no fabricated Arbitration executor. |
| **420Resource Protocol / 420Storage** | **Evidence-access integration only; not a remedy consumer** | `execution/storage/arbitration_evidence_access.go` checks case-bound private access; it never accepts a ruling as resource settlement or custody authority. Private gateway activation remains separately testnet-gated. |
| **420ComputeMarket** | **Planned architecture; no qualified Arbitration settlement consumer** | `docs/compute-market/CMP-0.1-SOURCE-AND-INTEGRATION-AUDIT.md` distinguishes planned dispute/settlement components from implemented AI/Resource primitives. Work/escrow/worker asset transitions remain exclusively in their approved protocol. |
| **DOOBr** | **Conditional route reference only; transactions disabled** | `doobr/canonical_routing.py` accepts issuer-checked Arbitration routing references, **not** rulings, asset/escrow transitions or a deployable Arbitration service. `docs/audits/doobr/DOOBR-AUDIT-5-INTEGRATION-BOUNDARIES.md` and Travel compatibility prohibit enabling delivery/payment transactions. |
| **420Hz** | **Architecture-level dispute allowlist; no adopted live domain/remedy executor** | `hz/config/gca-moderation-dispute-v1.json` lists allowable *future application dispositions*, not authority over Rights, Awards or payments; no direct mutation path is enabled by Arbitration. |
| **Other Genesis application mentions** | **Documentation/reference or future optional integration** | Town, BnB, LIFTd, classified listings, media and other catalog references are not evidence of deployed Arbitration case consumers. Retain each product's separate eligibility, custody, permission and state boundaries; do not instantiate a handler based on catalog membership. |

No evidence found in the inspected current source of a general Arbitration remedy executor for Pay, Rights, Grants, Resource, ComputeMarket, DOOBr or 420Hz. This is a **source classification**, not a claim that unrelated branches or future networks cannot contain other implementations.

## Live authorization invariants

1. **Authority discovery:** An operator-approved, chain-specific ProtocolRegistry publication with matching version, active status, runtime code hashes and immutable binding must be verified before a service consumer uses Arbitration; unverified snapshots and projected Indexer results are never authority.
2. **Identity and origin:** Every case action matches the stored original case and canonical origin object, the registered domain, and the claimant/respondent. A stored case ID alone grants nothing.
3. **Ruling finality:** An appeal/ruled round is not a finalized ruling. The current round's actual RulingRegistry record and required nonzero commitments must match. Publication is not settlement.
4. **Replay and accounting:** Launchpad publishes at most once per case. Commerce sends *only* explicit Wallet intents and records no Arbitration-triggered refund; original Pay/Market replay and conservation controls remain in place. A reverted Solidity transaction cannot partially write the outcome or notification.
5. **Interruptions and reorganizations:** Frontend/backend pending transactions are not final, and their references must be revalidated against the origin chain after finality or a reorganization. The shared Indexer may reconstruct history, but a projection cannot authorize origin-protocol transitions.
6. **Disabled means disabled:** Do not activate a future consumer, private gateway, escrow/ruling adapter or refund path simply because a name appears in a dependency catalog.

## Regression evidence and task-specific checks

- `contracts/test/LaunchpadCrowdfundingIntegration420.t.sol` — wrong sale, wrong domain, wrong component, wrong claimant/respondent, nonfinal state, stale appealed round, zero remedy commitment, correct finalized current round, replay, and no sale-state mutation.
- `contracts/test/LaunchpadEcosystem420.t.sol` — real local Arbitration case/ruling finalization and Launchpad notification evidence, independent canonical Pay/Identity settlement constraints.
- `commerce/test/com6b-dispute.test.mjs` — exact Market case binding, unauthorized caller, forged respondent/case, now rechecks *both* parties and canonical Market DISPUTED status for subsequent actions.
- `commerce/test/arbitration-adapter.test.mjs` and `commerce/web/test/arbitration.test.mjs` — approved Registry binding, Wallet target authorization, and fail-closed stale/forged identities.
- Retained Pay and Launchpad replay/accounting tests are preserved, not weakened; no new financial remedy execution is introduced.

## External prerequisites, not local permissions

No public testnet release identity, deployed provider endpoint or testnet reorg evidence is asserted here. Validate same-release Registry publication and complete real case–ruling–consumer flows, post-consumption reorg and finality semantics, and origin-protocol custody/accounting receipts under **ARBITRATION-AUDIT-5**. Do not treat this repository-side hardening as authorization to deploy a new consumer or promote a disabled feature.
