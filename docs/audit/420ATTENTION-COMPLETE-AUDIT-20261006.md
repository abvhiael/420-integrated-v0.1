# 420Attention / Cannaseur complete repository audit — 2026-10-06

## Scope and authority

Repository: `abvhiael/420-integrated-v0.1`

Baseline main SHA: `f674fbed767efc126da253c66800e38d030dc1dd`

This audit treats current repository evidence as authoritative: frozen Genesis application/configuration records, address namespace, contract map, architecture, source, tests, deployment/predeploy records, service IDs, documentation, CI, and committed qualification evidence.

## Canonical definition

420 Attention is a Genesis protocol-and-user application. 420 Cannaseur is its sponsor/advertising product surface. The canonical model is an opt-in, sponsor-funded engagement economy denominated in native 420.

Canonical state:
- participant consent and revisions;
- immutable campaign economics and policy commitments;
- bound verifier;
- proof commitments and single-use nullifiers;
- reward entitlement/reservation/payment;
- segregated sponsor campaign liabilities and refunds.

Explicitly non-canonical/private:
- campaign media payloads;
- raw browsing/viewing/behavioral telemetry;
- device identifiers;
- private audience dossiers and unrelated personal data.

Frozen authority/security rules are ATTN-INV-001 through ATTN-INV-014 in `contracts/config/420attention-genesis.json`.

## Repository state at audit start

- branch audited: `main`
- main baseline: `f674fbed767efc126da253c66800e38d030dc1dd`
- relevant pre-existing Attention audit PR: none found
- dedicated Attention audit workflow: missing at baseline
- dedicated Attention complete-audit/remediation record: missing at baseline

Audit remediation branch:
- `audit/420attention-complete-20261006`

## Canonical files/components

### Contracts

| Contract | Purpose | Status |
|---|---|---|
| `AttentionTreasury.sol` | sponsor funding, reservation, release, refund, liability segregation | COMPLETE |
| `CannaseurCampaignRegistry.sol` | immutable campaign definition and lifecycle | COMPLETE |
| `AttentionIds420.sol` | Attention component/action identifiers | COMPLETE after removal of orphaned campaign-delegation ID |
| `AttentionAuthorization420.sol` | capability lookup scoped to participant account | COMPLETE |
| `AttentionConsentRegistry420.sol` | global/campaign-specific consent state | COMPLETE |
| `AttentionProofRegistry420.sol` | verifier-bound proof commitment and replay prevention | COMPLETE |
| `AttentionRewardRegistry420.sol` | proof consumption, cap enforcement, reservation, claim | COMPLETE |
| `AttentionRouter420.sol` | read-only campaign/proof eligibility aggregation | COMPLETE |

### Frozen/registry addressing

- `AttentionTreasury`: fixed Genesis predeploy `0x0000000000000000000000000000000000000421`.
- `CannaseurCampaignRegistry`: fixed Genesis predeploy `0x000000000000000000000000000000000000043b`.
- `attention-router`: registry-resolved, no fixed Genesis address.
- Service IDs:
  - `420/service/attention/v1`
  - `420/service/cannaseur/v1`

### Application/service layer

| Component | Baseline state | Audit status |
|---|---|---|
| deployable Attention/Cannaseur frontend | not found | MISSING |
| dedicated Attention API/backend | not found | MISSING / not yet canonically specified |
| dedicated Attention indexer projection | not found | MISSING / deployment-dependent |
| static application documentation | present | COMPLETE repository-side |
| Wallet catalogue/service discovery | present | COMPLETE repository-side |
| testnet public-service readiness record | not found | MISSING |
| production deployment/DNS record | not found | MISSING |

Documentation pages are not treated as a substitute for a deployable user-facing application.

## Contract/security findings

### Verified safe/mitigated behavior

- proof submission requires current consent;
- campaign-specific consent overrides global consent once set;
- only the campaign-bound verifier may commit proofs;
- observation time must be within an active campaign window;
- nullifiers are single-use;
- each proof can accrue at most one reward;
- per-account campaign caps are cumulative;
- campaign funds are reserved before claim;
- release pays only the canonical participant;
- reward release and refund accounting update state before external value transfer;
- generic governance treasury transfer cannot spend campaign liabilities;
- unused sponsor funds cannot be refunded while reservations remain;
- campaign economics/policy commitments have no mutation path after creation;
- Attention delegation is account-scoped and does not itself grant Wallet keys, governance, Bridge, validator, or generic custody authority.

### Remediated inconsistency

`AttentionIds420.sol` defined `ACTION_MANAGE_CAMPAIGN`, but the frozen ATTN-INV-013 delegation model permits delegated Attention authority only for consent management and reward claiming, and no implementation consumed the campaign capability. The unused identifier was removed rather than broadening authority beyond the frozen model.

### Accepted design risks

- campaign verifier availability is a liveness dependency; replacement is not silently permitted;
- raw measurement/evidence remains off-chain and its quality is external to the on-chain commitment;
- sponsor campaign parameters are immutable once created, so mistakes require lifecycle closure/cancellation rather than mutation;
- canonical contracts do not provide a complete user experience without a deployable application/indexer/service surface.

### Unresolved vulnerabilities

No repository-visible Critical/High vulnerability is asserted by this audit before static-analysis CI completes. Final security qualification is conditional on the exact-head Slither gate and focused tests.

## Test audit

Baseline `AttentionGenesis420.t.sol` covered:
- activation funding requirement;
- consent requirement;
- nullifier replay;
- verifier authorization;
- single reward payment;
- default-deny delegated claim.

Added `AttentionAudit420.t.sol` coverage:
- campaign-specific consent override/revocation;
- delegated consent and absence of ambient claim authority;
- proof observation outside campaign window;
- cumulative reward cap across multiple proofs;
- reserved reward blocking sponsor refund;
- delegated claim paying only canonical participant;
- cancellation and unused sponsor-fund refund.

Still requiring live/testnet coverage:
- exact predeploy/storage initialization;
- ProtocolRegistry publication/discovery;
- live Wallet capability delegation;
- native 420 economics on production-equivalent chain;
- indexer/reorg/rebuild behavior;
- frontend transaction/recovery behavior;
- Notifications/Explorer projections;
- monitoring and operator recovery.

## Documentation audit

Verified repository-side:
- `docs/apps/attention/index.md`
- `getting-started.md`
- `user-guide.md`
- `concepts.md`
- `architecture.md`
- `permissions.md`
- `fees.md`
- `security.md`
- `troubleshooting.md`
- `faq.md`
- shared normative architecture in `docs/architecture/protocols/messenger-notifications-attention.md`

Added:
- this complete audit;
- `420ATTENTION-AUDIT-REMEDIATION-ROADMAP.md`;
- deterministic audit verifier;
- exact-head CI qualification workflow.

Still missing:
- dedicated deployment/operator runbook for Attention;
- deployed endpoint/domain configuration;
- live readiness/smoke-test record;
- frontend-specific environment/configuration reference.

## Requirement matrix

| Requirement | Canonical source | Current implementation | Tests | Documentation | Status | Required remediation |
|---|---|---|---|---|---|---|
| opt-in consent | Genesis invariants / architecture | Consent registry | Genesis + audit tests | complete | COMPLETE | none repository-side |
| private/raw telemetry exclusion | Genesis / architecture | commitment-only contract model | static verifier | complete | COMPLETE | verify service/indexer at testnet |
| immutable campaign economics | Genesis / campaign registry | no mutation path | indirect | complete | COMPLETE | optional explicit mutation-negative test |
| bound verifier | Genesis / proof registry | enforced | direct | complete | COMPLETE | none repository-side |
| replay-resistant proof | Genesis / proof registry | nullifier consumed | direct | complete | COMPLETE | none |
| active-window proof | Genesis / campaign registry | enforced | direct | complete | COMPLETE | none |
| one proof / one reward | Genesis / reward registry | proofConsumed | direct baseline | complete | COMPLETE | none |
| per-account cap | Genesis / reward registry | cumulative enforcement | direct added | complete | COMPLETE | none |
| sponsor liability segregation | Genesis / treasury | totalCampaignLiability | focused CI/static verification | complete | COMPLETE | live economic qualification |
| reserve before claim | Genesis / reward+treasury | enforced | direct/flow tests | complete | COMPLETE | live economic qualification |
| canonical recipient / single release | Genesis / reward+treasury | enforced | direct | complete | COMPLETE | none repository-side |
| safe refund | Genesis / treasury | closure + zero reservations | direct added | complete | COMPLETE | live economic qualification |
| narrow delegation | Genesis / authorization | consent + claim only after remediation | direct added | complete | COMPLETE | live Wallet integration |
| no key/arbitrary tx authority | Genesis / architecture | no such contract surface | static review | complete | COMPLETE | frontend/service verification |
| frozen addresses | namespace/predeploy | 0x0421 / 0x043b | deterministic verifier | architecture/config | COMPLETE | deploy/testnet verify |
| canonical service IDs | ServiceIds420 | Attention + Cannaseur IDs | registry tests/shared verifier | partial | COMPLETE | live Registry publication |
| user-facing application | Genesis classification / app docs | no deployable Attention frontend found | none | docs only | MISSING | ATTENTION-AUDIT-6 |
| API/indexer projection | app/user workflows | no dedicated implementation found | none | architecture boundary only | MISSING | ATTENTION-AUDIT-7 |
| testnet deployment | deployment/predeploy authority | no live evidence found | none | config exists | BLOCKED | ATTENTION-AUDIT-8 |
| Genesis deployment qualification | Genesis decision | repository contracts/config exist | repository CI only | partial | BLOCKED | complete testnet + app + operator evidence |
| production readiness | release requirements | not deployed/qualified | no live E2E | incomplete | BLOCKED | ATTENTION-AUDIT-6..9 |

## Readiness determination

Repository-side after remediation:

- CODE COMPLETE: **NO** — canonical contracts are present, but the intended user-facing application and required service projection are absent.
- BUILD COMPLETE: **CONDITIONAL** — exact-head CI must pass.
- CONTRACT COMPLETE: **YES** — canonical eight-contract family is present and internally reconciled.
- TEST COMPLETE: **NO** — repository contract coverage is materially improved, but live integration/E2E/testnet coverage is absent.
- DOCUMENTATION COMPLETE: **NO** — app/security/user docs exist; deployment/operator/live configuration documentation remains.
- INTEGRATION COMPLETE: **NO** — registry/address configuration exists, but live Wallet/Registry/Indexer/Notifications/Explorer integration is not qualified.
- SECURITY QUALIFIED: **CONDITIONAL/NO** — repository review found no unresolved Critical/High issue, but exact-head Slither/CI and live integration evidence are required.
- TESTNET READY: **NO** — no deployable frontend/service readiness evidence and no production-equivalent deployment record.
- GENESIS READY: **NO** — blocked by application/service/testnet/deployment qualification.
- PRODUCTION READY: **NO** — not deployed or operationally qualified.

## Final determination

420Attention / Cannaseur is **contract-foundation complete but not application-complete and not Genesis-ready**.

The repository has a coherent canonical protocol contract family and strong privacy/authority boundaries. The audit repaired one stale authority identifier and adds focused security tests, deterministic verification, exact-head CI, and durable remediation bookkeeping. The remaining work is explicit in `420ATTENTION-AUDIT-REMEDIATION-ROADMAP.md` and begins with ATTENTION-AUDIT-6.
