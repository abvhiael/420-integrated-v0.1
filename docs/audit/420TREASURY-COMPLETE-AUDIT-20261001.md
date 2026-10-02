# 420Treasury complete repository-grounded audit — 2026-10-01

## Audit basis

Repository: `abvhiael/420-integrated-v0.1`  
Authoritative baseline: `main` at `27ae1873edcca8fb05dec9f4e70af9832b5dafe2`  
Audit branch: `audit/420treasury-complete-20261001`

Repository state, frozen Genesis records, architecture, contracts, tests, address authority and committed qualification evidence are treated as authoritative.

## Canonical application definition

420Treasury is a **covered Genesis protocol** providing governed budget and disbursement control. It is not a standalone public Genesis user application and it is not an independent custody system.

Canonical authority split:

- 420Civic / GovernanceTimelock: creates budgets, schedules disbursements, cancels scheduled disbursements, updates asset policy and binds actions to Civic commitments.
- 420Treasury: budget accounting, disbursement identity/state, policy caps and exact-disbursement capability authorization.
- 420Vault: custody/release authority for Treasury assets through `VAULT_TREASURY`.
- CapabilityRegistry: scoped execution authorization.
- Indexer/Explorer/Analytics: derived, non-authoritative read surfaces.

The modern Treasury contract suite is:
- `TreasuryIds420.sol`
- `TreasuryAuthorization420.sol`
- `TreasuryPolicyRegistry420.sol`
- `TreasuryBudgetRegistry420.sol`
- `TreasuryDisbursementRegistry420.sol`
- `TreasuryRouter420.sol`

`TreasuryRouter420` is registry-resolved and intentionally has no fixed Genesis address.

## Canonical sources reviewed

- `contracts/config/420treasury-genesis.json`
- `contracts/config/genesis-dapp-contract-map.json`
- `contracts/config/genesis-canonical-addresses.json`
- `contracts/config/genesis-address-namespace.json`
- `config/genesis-applications.json`
- `docs/420-VAULT-V1-MODEL.md`
- `docs/architecture/protocols/stake-governance-treasury-grants.md`
- `docs/architecture/genesis-architecture.md`
- `docs/audit/genesis-contract-documentation-inventory.json`
- `contracts/src/treasury/**`
- `contracts/test/TreasuryGenesis420.t.sol`
- `contracts/src/grants/GrantMilestoneRegistry420.sol`
- `420-indexer/src/abi-manifest.ts`
- `420-indexer/sql/004-genesis-materialized-views.sql`
- `analytics/metrics/economic.go`
- original Treasury PR #25 and related Governance integration evidence

## Repository state at audit start

| Field | Value |
|---|---|
| Repository | `abvhiael/420-integrated-v0.1` |
| Baseline branch | `main` |
| Baseline SHA | `27ae1873edcca8fb05dec9f4e70af9832b5dafe2` |
| Audit branch | `audit/420treasury-complete-20261001` |
| Original Treasury PR | #25 |
| Compiler | Solidity 0.8.24 |
| EVM target | Cancun |
| Build system | Foundry |
| Frozen Treasury router address | none; registry-resolved |
| New frozen predeploy required | false |

## Architecture discovered

Treasury stores no asset balances and performs no token/native transfer. A budget binds one Vault identity, budget category, asset, ceiling, validity window, Civic action commitment and metadata commitment. Scheduling creates a canonical replay-safe disbursement identity and reserves budget capacity. Execution is capability-scoped to the exact disbursement and amount. Cancellation releases reserved capacity.

The Treasury registry records a nonzero `vaultReleaseHash` as the audit link to the Vault release path. On the audited implementation, Treasury does not itself verify that commitment against 420Vault.

## File/component inventory

| Component | Status | Audit note |
|---|---|---|
| Treasury IDs/constants | COMPLETE | canonical component/action/budget IDs present |
| Capability authorization adapter | COMPLETE | exact disbursement scope |
| Asset policy registry | COMPLETE | governance-controlled single/epoch caps |
| Budget registry | COMPLETE | Civic-bound, bounded validity, reserve/settle/release accounting |
| Disbursement registry | PARTIAL at baseline / hardened on branch | baseline execution did not re-check budget/policy state |
| Router/read facade | PARTIAL at baseline / hardened on branch | baseline could report a different executable result from the write path after policy drift |
| Focused Foundry tests | PARTIAL at baseline / expanded on branch | baseline had four narrow tests |
| Dedicated public frontend | NOT APPLICABLE | canonical documentation classifies Treasury as covered protocol, not public Genesis app |
| Dedicated backend | NOT APPLICABLE | authoritative state is on-chain; derived services may project it |
| Indexer generic Treasury view | PARTIAL | generic Treasury event view exists, modern registry-resolved Treasury descriptors are not yet release-materialized |
| Analytics Treasury metrics | PARTIAL | derived budget/disbursement model exists; live deployment binding remains |
| Deployment materialization | PARTIAL | router is registry-resolved; exact deployment order/artifacts/hashes/publication evidence are not retained as a Treasury closeout package |
| App-specific CI | MISSING at baseline / added on branch | exact-head Foundry + Genesis/Governance boundary gate added |
| Treasury-specific complete audit/roadmap | MISSING at baseline / added on branch | this report + remediation roadmap |

## Contract/security findings

### Remediated on the audit branch

1. **Budget-expiry bypass in execution.** Baseline `markExecuted` did not check whether the parent budget was still effective. A scheduled payment could therefore be recorded executed after budget validity ended if the disbursement's own time window still permitted it.
2. **Policy-revocation bypass in execution.** Baseline execution read epoch parameters but did not require the current asset policy to remain allowed or the amount to remain under the current single-disbursement cap.
3. **Scheduling outside parent-budget validity.** Baseline scheduling allowed a disbursement time window to outlive the budget, creating commitments that could survive the authorized budget window.
4. **Router/write-path disagreement.** The router checked budget effectiveness, while the write path did not; policy revocation was not reflected by the router. The branch aligns the read and write guards.
5. **Coverage gaps.** Tests now exercise policy revocation, epoch caps, parent-budget-window escape, zero release commitment, cancellation accounting/terminal state, replay, exact scoped authorization and temporal boundaries.

### Verified/mitigated behavior

- no Treasury contract transfers or custodies assets;
- GovernanceTimelock/Civic controls budget creation, scheduling, cancellation and policy;
- execution capability scope is derived from the exact disbursement ID;
- disbursement identity commits budget, recipient, amount, timing, Civic action and purpose;
- schedule replay is rejected;
- budget commitment accounting is bounded by ceiling;
- single-disbursement and epoch policy caps are enforced;
- execution requires a nonzero Vault release commitment;
- cancellation releases unexecuted commitment and is terminal;
- controller binding is one-time.

### Accepted/design risk requiring explicit closure

The authorized executor supplies `vaultReleaseHash`. Treasury validates only that it is nonzero; it does not prove the referenced Vault release occurred. This matches the current architecture wording of an "audit link" but is weaker than the original PR phrase "atomic reserve/settle/release accounting." This conflict must be explicitly resolved before final security/Genesis qualification.

## Requirement matrix

| Requirement | Canonical source | Current implementation | Tests | Documentation | Status | Required remediation |
|---|---|---|---|---|---|---|
| no parallel custody | Treasury manifest / Vault model | no value-transfer primitive in Treasury | source/scan | yes | COMPLETE | retain |
| Civic-bound budgets | Treasury manifest / architecture | enforced | focused tests | yes | COMPLETE | retain |
| bounded budget validity | architecture | enforced at create; branch also binds scheduled windows | added | yes | COMPLETE on branch | exact-head qualify |
| canonical replay-safe disbursement ID | manifest | enforced | replay test | yes | COMPLETE | retain |
| committed/executed <= ceiling | manifest | enforced by reserve/settle | direct tests limited | yes | PARTIAL | invariant/fuzz expansion |
| single-disbursement cap | manifest | enforced schedule + branch execution re-check | tests | yes | COMPLETE on branch | exact-head qualify |
| epoch cap | manifest | enforced | branch test | yes | COMPLETE on branch | boundary fuzz |
| exact-disbursement capability | manifest | enforced | tests | yes | COMPLETE | retain |
| notBefore/expiry | manifest | enforced | tests | yes | COMPLETE | retain |
| cancellation releases commitment | manifest | enforced | branch test | yes | COMPLETE on branch | exact-head qualify |
| nonzero Vault release commitment | manifest | enforced | branch test | yes | COMPLETE | retain |
| cryptographic/atomic Vault release proof | TREASURY-AUDIT-4 adopted commitment-only model | intentionally not performed by Treasury | commitment-only model + Grants consumer qualification | yes | NOT APPLICABLE | live qualification correlates commitment to actual Vault evidence |
| registry-resolved router identity | address authority | declared | config verification indirect | partial | PARTIAL | deployment/publication evidence |
| Indexer modern Treasury descriptors | derived-service architecture | generic protocol view only | no focused modern suite found | partial | PARTIAL | TREASURY-AUDIT-5 |
| Analytics projection | Analytics implementation | present | Analytics tests | yes | PARTIAL | bind to qualified live Indexer |
| standalone Treasury UI | documentation classification | not required | n/a | classification exists | NOT APPLICABLE | none |
| reproducible app-specific qualification | release policy | branch workflow added | pending CI | roadmap/report | PARTIAL | exact-head green evidence |
| production-equivalent testnet | release policy | not deployed | none live | roadmap | BLOCKED | TREASURY-AUDIT-8 |
| external security review | release policy | not found | n/a | roadmap | BLOCKED | TREASURY-AUDIT-9 |

## Documentation audit

Architecture documentation correctly describes Treasury's authority split and core flow, but there is no dedicated operator/deployment package for Treasury. The current architecture page is sufficient to understand the conceptual model, not sufficient by itself to deploy, operate, recover and independently qualify the protocol.

Still required:
- exact deployment order and constructor-binding reference;
- ProtocolRegistry publication procedure;
- event/error integration reference;
- operator/recovery guide;
- retained testnet/production qualification evidence.

## Genesis/deployment determination

420Treasury is **not a fixed-predeploy protocol**. The canonical address namespace explicitly marks `TreasuryRouter420` as registry-resolved. Therefore absence from `system-addresses.json` is correct and must not be "fixed" by assigning a frozen address.

The release still requires deterministic deployment artifacts, constructor bindings, registry publication, runtime hashes and live verification evidence for the registry-resolved deployment.

## Readiness state

- CODE COMPLETE: **NO** — core Treasury lifecycle, property/security and release-evidence semantics are qualified through TREASURY-AUDIT-4; modern integration/deployment materialization remains.
- BUILD COMPLETE: **NO** — exact-head Treasury CI is green through TREASURY-AUDIT-4, but no final Treasury deployment artifact package is retained.
- CONTRACT COMPLETE: **NO** — repository contract behavior through TREASURY-AUDIT-4 is qualified, but deployment-bound and final external-review closeout remain.
- TEST COMPLETE: **NO** — lifecycle, fuzz/property, static/security and Grants consumer qualification are retained; live deployment/integration tests remain.
- DOCUMENTATION COMPLETE: **NO** — deployment/operator/recovery/evidence references remain.
- INTEGRATION COMPLETE: **NO** — modern Treasury Indexer/deployment publication evidence remains.
- SECURITY QUALIFIED: **NO** — exact-head Treasury static/security qualification is green through TREASURY-AUDIT-4; external review remains.
- TESTNET READY: **NO** — deployment/publication/evidence materialization is incomplete.
- GENESIS READY: **NO** — live testnet, security and final release evidence remain.
- PRODUCTION READY: **NO** — Genesis/security/operational closeout remains.

## Final determination

The baseline implementation was **not genuinely complete** despite having a coherent contract family and green historical integration evidence. The audit identified real fail-closed lifecycle gaps and an ambiguous Treasury/Vault release-evidence boundary. The lifecycle gaps were remediated in TREASURY-AUDIT-2/3, and TREASURY-AUDIT-4 has now formally adopted and qualified the commitment-only Vault release evidence model without creating a second custody authority.

Remaining repository and live-release work is preserved in `docs/audit/420TREASURY-AUDIT-REMEDIATION-ROADMAP.md`; no later step may be treated as complete merely because the retained Level 1 suites are green.
