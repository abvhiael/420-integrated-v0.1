# 420Launchpad repository audit

Baseline: `main@f529533ebe62b63ad3f30f685f0c1c44f69ec06b`
Audit branch: `audit/420launchpad-remediation`

## Canonical definition

The repository contains two related but non-equivalent Launchpad definitions:

1. **Launchpad protocol contract family** — `420/service/launchpad/v1`, implemented by the project, sale, allocation, authorization and router contracts. Its frozen V1 boundary is non-custodial: it does not mint, execute payment, custody proceeds, execute refunds, or control DEX liquidity. Payment, delivery and refund actions are represented by commitments.
2. **420Launchpad Crowdfunding consumer-service target** — `420/service/launchpad-crowdfunding/v1`, a later Genesis-facing update targeting reward, donation, community-project and product-preorder crowdfunding with dependencies on 420 Identity, 420 Pay, 420 Arbitration, 420Reputation and 420 Notifications, while securities/equity remain disabled.

These layers must not be conflated. The V1 protocol family can be repository-complete for its narrow commitment-registry boundary while the Genesis-facing crowdfunding application remains incomplete.

## Repository state

- Repository: `abvhiael/420-integrated-v0.1`
- Audit baseline main: `f529533ebe62b63ad3f30f685f0c1c44f69ec06b`
- Original implementation PR: #27, merged 2026-09-01
- Original implementation head: `70b961af7c8090cb11bf23b8c6c2aa0823342dda`
- Original merge commit: `6ab35457aa9e43b6aafc0dd0c02249525d298839`
- Old branch `feature/420launchpad-genesis-v1`: 0 ahead / 8167 behind current main at audit start
- Current audit work therefore uses a fresh branch from current main.

## Architecture discovered

### Protocol contracts

- `LaunchpadIds420.sol` — component and contribution/claim/refund action IDs.
- `LaunchpadAuthorization420.sol` — CapabilityRegistry-backed default-deny authorization scoped by sale.
- `LaunchpadProjectRegistry420.sol` — governance-created immutable project identity/issuance commitments.
- `LaunchpadSaleRegistry420.sol` — governance-created immutable sale economics plus lifecycle and aggregate raised accounting.
- `LaunchpadAllocationRegistry420.sol` — participant contribution, claim and refund commitment accounting plus one-shot governance binding to the crowdfunding integration boundary.
- `LaunchpadCrowdfundingIntegration420.sol` — canonical Pay/Identity/Arbitration verification, replay/idempotency controls and derived Reputation/Notifications publication for approved Genesis crowdfunding modes.
- `LaunchpadRouter420.sol` — read-only remaining-capacity queries.

### Authority model

Governance creates projects and sales, activates/finalizes/cancels sales, and binds the single allocation-registry controller. Participant contribution, claim and refund calls additionally require CapabilityRegistry authorization. No Launchpad contract directly transfers sale payment assets, mints sale assets, transfers token allocations, or moves refunds.

### Address model

Launchpad requires no new frozen predeploy. The canonical Launchpad router is registry-resolved rather than a frozen Genesis predeploy. Repository address-reconciliation records also contain a later candidate assignment, so deployment/address publication remains a release-stage activity and must be verified from the canonical deployment package, not inferred from source existence.

## File inventory

| Component | Status | Notes |
|---|---|---|
| Launchpad protocol + crowdfunding Solidity sources | COMPLETE for repository integration scope | Base protocol plus `ILaunchpadCrowdfundingIntegration420.sol` and `LaunchpadCrowdfundingIntegration420.sol` are present under `contracts/src/launchpad/`. |
| focused Solidity tests | PARTIAL | `LaunchpadGenesis420.t.sol` covers four core paths only. Audit tests added on this branch. |
| Genesis config | COMPLETE for V1 boundary | Ten invariants and non-custodial boundary declared. |
| dApp contract map | COMPLETE | Base contracts plus `LaunchpadCrowdfundingIntegration420.sol` listed. |
| canonical service ID | COMPLETE | `420/service/launchpad/v1` exists in `ServiceIds420.sol`. |
| application docs | PARTIAL | User/developer docs exist, but they describe the narrow V1 protocol and do not fully reconcile the newer crowdfunding target. |
| deployment package/scripts | MISSING | No Launchpad-specific deterministic deployment/materialization package was identified. |
| retained ABI/runtime qualification | MISSING | No Launchpad-specific exact-head artifact/runtime evidence was identified. |
| user-facing Launchpad web application | MISSING | No real Launchpad route/site implementation was identified. Wallet catalogue exposure is discovery, not a Launchpad UI. |
| Launchpad backend/API/indexer | MISSING for crowdfunding target | No Launchpad-specific service implementation was identified. |
| 420Pay integration | COMPLETE for repository scope | Crowdfunding contributions require canonical settled PaymentRegistry records; refund recording requires canonical Pay refund state. |
| Arbitration integration | COMPLETE for repository scope | Canonical case origin and finalized ruling/remedy evidence are linked without transferring Arbitration authority. |
| Reputation integration | MISSING | No creator/project delivery-history publication or query integration. |
| Notifications integration | COMPLETE event boundary for repository scope | Canonical sale lifecycle plus deterministic contribution/refund/delivery/dispute/ruling source events are available to Notifications. |
| Identity integration | COMPLETE for repository scope | Active participant-controlled Identity profile plus valid sale-policy credential is enforced alongside CapabilityRegistry authorization. |

## Smart-contract audit

### Verified-safe or intentionally bounded behavior

- project and sale identifiers are domain-separated canonical hashes;
- project and sale creation are governance-only;
- sale economics are immutable after creation;
- contribution state is controller-gated in the sale registry;
- participant contributions are bounded by per-wallet and aggregate hard caps;
- contribution/claim/refund actions fail closed through CapabilityRegistry;
- claims require successful finalization and claim start;
- failed/cancelled sales permit refund commitments while successful sales do not;
- V1 has no arbitrary external calls, delegatecall, token approvals, token custody, native-value custody, or reentrancy-sensitive transfer path;
- the controller may be set only once and cannot be zero.

### V1 hardening semantics frozen by LAUNCHPAD-AUDIT-2

The V1 contract family remains a non-custodial commitment registry. Audit-2 freezes the following semantics rather than silently expanding V1 authority:

- payment, delivery and refund commitments are nonzero opaque audit references; V1 does not enforce global commitment uniqueness. Canonical settlement binding, replay/idempotency across services and 420Pay evidence validation belong to LAUNCHPAD-AUDIT-3;
- participant allocation is calculated as `floor(tokenAllocation * participantContribution / raised)`. Aggregate claims therefore never exceed the configured allocation, but integer division may leave unassigned accounting dust. V1 neither custodies nor sweeps that residual;
- `Project.active` is an immutable registration marker in V1, not a mutable pause/deactivation control. Sale lifecycle authority remains the explicit `LaunchpadSaleRegistry420.State` machine.

The focused Audit-2 suite directly covers canonical/replay-safe identities, immutable economics, cap boundaries, soft-cap finalization, refund/claim terminal behavior, default-deny authorization, nonzero commitment requirements, contribution time boundaries, duplicate-operation behavior, cancellation, and fuzzed allocation/cap conservation. Static verification retains the no-custody/no-mint/no-payment-execution/no-Swap-authority boundary.

### Crowdfunding integration completed by LAUNCHPAD-AUDIT-3

Audit-3 reconciles the later Genesis-facing crowdfunding definition with the intentionally narrow V1 protocol without turning Launchpad into a payment, custody, identity, Arbitration, Reputation or notification authority.

- approved modes are reward, donation, community project and product preorder only; securities/equity has no runtime campaign mode;
- canonical 420Pay settled state is required before a contribution is recorded, with exact participant/merchant/asset/amount/receipt binding;
- failed/cancelled refund records require canonical Pay refunded state across every payment backing the participant's contribution;
- participant Identity profile/controller/activity and a currently valid credential matching the sale eligibility policy are required in addition to CapabilityRegistry authorization;
- disputes bind to canonical Arbitration case origin and finalized ruling evidence, but remedies remain instructions/evidence for the owning authorities rather than direct Launchpad execution;
- crowdfunding contribution and reward-delivery evidence is emitted for domain-scoped 420Reputation consumption;
- deterministic lifecycle/integration events are emitted for 420Notifications, which remains a non-authoritative presentation service;
- cross-service references are replay/idempotency protected.

The shared Arbitration change is a read-only `caseOrigin` view exposing already-stored case provenance for integration verification. It grants no new mutation or ruling authority.

### Risks / limitations

1. **Base V1 versus crowdfunding binding.** When the optional crowdfunding integration is unbound, base V1 commitments remain opaque as frozen by Audit-2. Once governance binds `LaunchpadCrowdfundingIntegration420`, contribution evidence must be a canonical settled 420Pay payment ID, refund evidence must be prepared from canonical Pay refund state, and delivery evidence becomes globally replay-protected.
2. **Cross-service replay semantics.** Audit-3 adds global one-use payment IDs, refund batches and delivery commitments plus deterministic Reputation/Notifications publication keys. Base V1 alone still does not provide those cross-service guarantees.
3. **Eligibility policy binding.** Crowdfunding mode now enforces both CapabilityRegistry authorization and `Identity420.hasValidCredential(profileId, sale.eligibilityPolicyHash)` for an active participant-controlled profile; base V1 alone remains capability-only.
4. **Allocation rounding dust.** Pro-rata integer division can leave undistributed token-allocation dust. V1 defines no residual sweep/accounting rule.
5. **No delivery/refund execution.** Claims and refunds are records, not transfers.
6. **Governance cancellation power.** Governance may cancel a scheduled or active sale. This is explicit centralized protocol authority and must be treated as an accepted design risk unless the canonical architecture changes.
7. **Project active flag has no lifecycle.** Projects are created active and no deactivate/reactivate path exists. It therefore does not currently serve as a meaningful mutable safety control.

## Security classification

- **verified safe behavior:** access-control boundaries, cap arithmetic in Solidity 0.8.x, terminal-state checks, no-custody/no-external-transfer architecture.
- **mitigated risk:** participant action authorization delegated to CapabilityRegistry.
- **accepted design risk:** governance lifecycle authority and commitment-only non-custodial evidence model.
- **unresolved vulnerability / release risk:** none identified that permits direct theft from Launchpad itself because Launchpad holds no funds; however, presenting commitment-only state as actual payment/refund/delivery would be a serious application-layer integrity failure.
- **unresolved integration risk:** crowdfunding settlement, dispute, reputation and notification dependencies are not implemented.

## Documentation audit

Existing docs are useful for the narrow protocol but do not constitute a complete operator/deployment manual. Missing or incomplete items include exact deployment order, constructor values per environment, Registry publication procedure, retained ABI/runtime hashes, smoke-test procedure, rollback/recovery procedure, production configuration, and the newer crowdfunding application integrations.

## Requirement matrix

| Requirement | Canonical source | Current implementation | Tests | Documentation | Status | Required remediation |
|---|---|---|---|---|---|---|
| canonical project registration | V1 config/architecture | project registry | focused + audit | yes | COMPLETE | none |
| immutable sale economics | V1 config | sale registry | focused + audit | yes | COMPLETE | none |
| hard/per-wallet caps | V1 config | sale + allocation registries | focused + audit | yes | COMPLETE | none |
| success/failure lifecycle | V1 config | sale registry | focused + audit | yes | COMPLETE | none |
| capability default deny | V1 config | authorization adapter | focused + audit | yes | COMPLETE | none |
| non-custodial boundary | V1 config/PR #27 | no transfer/custody code | static audit | yes | COMPLETE | preserve boundary |
| auditable payment/delivery/refund commitments | V1 config | nonzero hashes only | focused + audit | yes | COMPLETE | do not describe as executed settlement |
| canonical service identity | ServiceIds420 | launchpad/v1 | static verifier | partial | COMPLETE | none |
| deterministic deployment package | release requirement | none found | none | none | MISSING | LAUNCHPAD-AUDIT-4 |
| exact-head retained runtime/ABI evidence | release requirement | none found | none | none | MISSING | LAUNCHPAD-AUDIT-4 |
| user-facing Launchpad application | app/protocol distinction + crowdfunding target | no real Launchpad UI found | none | manuals only | MISSING | LAUNCHPAD-AUDIT-5 |
| Identity crowdfunding integration | consumer-services registry | active controlled profile + sale-policy credential + CapabilityRegistry | Audit-3 integration suite | architecture/security docs | COMPLETE repository scope | deployment/UI remain Audit-4/5/6 |
| 420Pay contract-backed settlement | consumer-services registry | settled PaymentRegistry binding + canonical refund-state linkage | Audit-3 integration suite | architecture/security docs | COMPLETE repository scope | deployment evidence Audit-4/6 |
| Arbitration integration | consumer-services registry | canonical case-origin + finalized ruling/remedy evidence | Audit-3 integration + real registry test | architecture/security docs | COMPLETE repository scope | live dispute path Audit-6 |
| Reputation integration | consumer-services/GEN-SVC docs | replay-protected CROWDFUNDING contribution/reward-delivery evidence events | Audit-3 + Reputation retained tests | architecture/security docs | COMPLETE event boundary | live consumer/indexer verification Audit-6 |
| Notifications integration | consumer-services registry | deterministic lifecycle/integration source events | Audit-3 + Notifications retained replay/provenance tests | architecture/security docs | COMPLETE event boundary | live delivery Audit-6 |
| securities/equity disabled | consumer-services feature flags | config flag false | GEN-SVC validator | yes | COMPLETE | retain fail-closed |
| production-equivalent testnet qualification | release requirement | not deployed | none | none | BLOCKED | LAUNCHPAD-AUDIT-6 |

## Readiness state at audit baseline

- CODE COMPLETE: **NO** — crowdfunding application/integration layer is absent.
- BUILD COMPLETE: **NO** — protocol sources are buildable by repository CI, but this audit still requires exact-head CI qualification and no user-facing app build exists.
- CONTRACT COMPLETE: **YES for narrow V1 protocol / NO for crowdfunding settlement target**.
- TEST COMPLETE: **NO** — only four original focused tests existed; no end-to-end dependency tests or live deployment tests.
- DOCUMENTATION COMPLETE: **NO** — deployment/operations and crowdfunding integration docs are incomplete.
- INTEGRATION COMPLETE: **PARTIAL** — repository-side Pay/Identity/Arbitration bindings and Reputation/Notifications event boundaries are implemented by Audit-3; deterministic deployment, real UI/service wiring and live delivery remain Audit-4/5/6.
- SECURITY QUALIFIED: **NO** — repository review exists, but no complete exact-head Launchpad hardening package or independent external review.
- TESTNET READY: **NO** — deterministic deployment/evidence and integrated service workflow are missing.
- GENESIS READY: **NO** — Genesis-facing crowdfunding target is incomplete.
- PRODUCTION READY: **NO** — testnet, deployment, operations, monitoring and user-facing service are incomplete.

## Final determination

420Launchpad is **not complete** as a Genesis-facing crowdfunding application. The original V1 contract family is a coherent, intentionally narrow non-custodial commitment-registry protocol, but the repository's later Genesis-facing crowdfunding definition added real product and integration requirements that are not implemented by those contracts. Exact-head CI added by this audit must qualify the current protocol baseline, after which remediation should proceed in the dependency order recorded in `420LAUNCHPAD-AUDIT-ROADMAP.md`.
