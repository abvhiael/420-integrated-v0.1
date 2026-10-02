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
- `LaunchpadAllocationRegistry420.sol` — participant contribution, claim and refund commitment accounting.
- `LaunchpadRouter420.sol` — read-only remaining-capacity queries.

### Authority model

Governance creates projects and sales, activates/finalizes/cancels sales, and binds the single allocation-registry controller. Participant contribution, claim and refund calls additionally require CapabilityRegistry authorization. No Launchpad contract directly transfers sale payment assets, mints sale assets, transfers token allocations, or moves refunds.

### Address model

Launchpad requires no new frozen predeploy. The canonical Launchpad router is registry-resolved rather than a frozen Genesis predeploy. Repository address-reconciliation records also contain a later candidate assignment, so deployment/address publication remains a release-stage activity and must be verified from the canonical deployment package, not inferred from source existence.

## File inventory

| Component | Status | Notes |
|---|---|---|
| six Launchpad Solidity source files | COMPLETE | Present under `contracts/src/launchpad/`. |
| focused Solidity tests | PARTIAL | `LaunchpadGenesis420.t.sol` covers four core paths only. Audit tests added on this branch. |
| Genesis config | COMPLETE for V1 boundary | Ten invariants and non-custodial boundary declared. |
| dApp contract map | COMPLETE | All six contracts listed. |
| canonical service ID | COMPLETE | `420/service/launchpad/v1` exists in `ServiceIds420.sol`. |
| application docs | PARTIAL | User/developer docs exist, but they describe the narrow V1 protocol and do not fully reconcile the newer crowdfunding target. |
| deployment package/scripts | MISSING | No Launchpad-specific deterministic deployment/materialization package was identified. |
| retained ABI/runtime qualification | MISSING | No Launchpad-specific exact-head artifact/runtime evidence was identified. |
| user-facing Launchpad web application | MISSING | No real Launchpad route/site implementation was identified. Wallet catalogue exposure is discovery, not a Launchpad UI. |
| Launchpad backend/API/indexer | MISSING for crowdfunding target | No Launchpad-specific service implementation was identified. |
| 420Pay integration | MISSING | V1 records opaque payment commitments only. |
| Arbitration integration | MISSING | No dispute linkage in V1 contracts/application layer. |
| Reputation integration | MISSING | No creator/project delivery-history publication or query integration. |
| Notifications integration | MISSING | No campaign lifecycle notification path. |
| Identity integration | PARTIAL | Capability authorization can enforce policy externally, but the crowdfunding service dependency is not implemented as an application workflow. |

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

### Risks / limitations

1. **Commitment-only settlement.** A nonzero payment/delivery/refund commitment is evidence supplied by the caller; V1 does not cryptographically bind that commitment to a canonical 420Pay settlement record or token transfer.
2. **No commitment uniqueness registry.** The contracts do not prevent the same nonzero commitment hash from being referenced more than once. The canonical V1 invariants require nonzero audit commitments but do not define uniqueness, so changing this in-place would be an architectural decision rather than an audit-only repair.
3. **Eligibility policy hash is declarative.** The sale stores `eligibilityPolicyHash`, but enforcement occurs through CapabilityRegistry authorization; the contract does not prove the CapabilityRegistry decision corresponds to that exact hash.
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
| Identity crowdfunding integration | consumer-services registry | capability only | none end-to-end | missing | PARTIAL | LAUNCHPAD-AUDIT-3/5 |
| 420Pay contract-backed settlement | consumer-services registry | commitment only | none | missing | MISSING | LAUNCHPAD-AUDIT-3 |
| Arbitration integration | consumer-services registry | none | none | missing | MISSING | LAUNCHPAD-AUDIT-3 |
| Reputation integration | consumer-services/GEN-SVC docs | none | none | partial mention | MISSING | LAUNCHPAD-AUDIT-3 |
| Notifications integration | consumer-services registry | none | none | missing | MISSING | LAUNCHPAD-AUDIT-3 |
| securities/equity disabled | consumer-services feature flags | config flag false | GEN-SVC validator | yes | COMPLETE | retain fail-closed |
| production-equivalent testnet qualification | release requirement | not deployed | none | none | BLOCKED | LAUNCHPAD-AUDIT-6 |

## Readiness state at audit baseline

- CODE COMPLETE: **NO** — crowdfunding application/integration layer is absent.
- BUILD COMPLETE: **NO** — protocol sources are buildable by repository CI, but this audit still requires exact-head CI qualification and no user-facing app build exists.
- CONTRACT COMPLETE: **YES for narrow V1 protocol / NO for crowdfunding settlement target**.
- TEST COMPLETE: **NO** — only four original focused tests existed; no end-to-end dependency tests or live deployment tests.
- DOCUMENTATION COMPLETE: **NO** — deployment/operations and crowdfunding integration docs are incomplete.
- INTEGRATION COMPLETE: **NO** — Pay/Arbitration/Reputation/Notifications application integrations are absent.
- SECURITY QUALIFIED: **NO** — repository review exists, but no complete exact-head Launchpad hardening package or independent external review.
- TESTNET READY: **NO** — deterministic deployment/evidence and integrated service workflow are missing.
- GENESIS READY: **NO** — Genesis-facing crowdfunding target is incomplete.
- PRODUCTION READY: **NO** — testnet, deployment, operations, monitoring and user-facing service are incomplete.

## Final determination

420Launchpad is **not complete** as a Genesis-facing crowdfunding application. The original V1 contract family is a coherent, intentionally narrow non-custodial commitment-registry protocol, but the repository's later Genesis-facing crowdfunding definition added real product and integration requirements that are not implemented by those contracts. Exact-head CI added by this audit must qualify the current protocol baseline, after which remediation should proceed in the dependency order recorded in `420LAUNCHPAD-AUDIT-ROADMAP.md`.
