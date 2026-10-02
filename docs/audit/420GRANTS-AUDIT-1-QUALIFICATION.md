# GRANTS-AUDIT-1 qualification evidence

## Step

**GRANTS-AUDIT-1 — canonical definition, inventory and authority graph**

## Qualification level

**Level 1 — per-roadmap-step fast qualification**

This step is definition/inventory reconciliation. Repository-wide Level 2/Level 3 qualification is intentionally deferred because the canonical step does not itself require broad shared-system execution.

## Implementation SHA

`02244b26b699557c8c42600c635b38b276249183`

## Reconciliation base

`main` at `14d46231aa4350b2e84dee52f0f664bdd2e785f4`

Audit branch: `feature/420grants-audit-remediation-v2`  
PR: #484 — `audit(grants): harden lifecycle and establish 420Grants audit track`

At qualification time the branch was 27 commits ahead of and 0 commits behind `main`, with PR #484 open and mergeable.

## Canonical definition established

420Grants is a **Genesis implementation protocol** providing governed grant program, application, award and milestone workflow state. It is **not** a separate frozen public standalone Genesis application.

Canonical authority graph:

- **420 Civic / GovernanceTimelock** — governance decisions and privileged Grants mutations.
- **420 Treasury** — governed budget/disbursement accounting, execution policy and payment-state authority.
- **420Vault** — custody and asset release.
- **CapabilityRegistry420** — narrowly scoped delegated application and milestone-submission authority.
- **420Grants** — grant workflow/entitlement state plus exact binding of approved milestones to Treasury disbursements.
- **Wallet / Indexer / Explorer / Search and other clients** — replaceable, non-authoritative presentation, discovery, projection and transaction surfaces.

420Grants cannot become Treasury custody, bypass Civic/Treasury policy, invent payment evidence, or claw back already released assets without a separate authorized Treasury/Civic action.

## Canonical contract inventory

The canonical seven-file suite is:

1. `GrantIds420.sol`
2. `GrantAuthorization420.sol`
3. `GrantProgramRegistry420.sol`
4. `GrantApplicationRegistry420.sol`
5. `GrantAwardRegistry420.sol`
6. `GrantMilestoneRegistry420.sol`
7. `GrantRouter420.sol`

The same inventory is represented in `contracts/config/420grants-genesis.json` and the `420 Grants` row of `contracts/config/genesis-dapp-contract-map.json`.

Historical implementation authority is PR #26, **feat(grants): add Genesis 420Grants lifecycle**.

## Address / Registry model

`GrantRouter420.sol` is represented exactly once as `grants-router` in the canonical Genesis namespace and remains:

`REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS`

No fixed Grants predeploy is created or implied.

Canonical discovery anchor remains `ProtocolRegistry`; the Grants service identifier is `keccak256("420/service/grants/v1")`.

## Surface classification

| Surface | Classification for 420Grants | GRANTS-AUDIT-1 conclusion |
| --- | --- | --- |
| Grants Solidity suite | REQUIRED / canonical | inventoried and reconciled |
| Grants Genesis config / dApp map / Registry namespace | REQUIRED / canonical metadata | inventoried and reconciled |
| Wallet catalogue / service discovery | SHARED REQUIRED discovery surface | Wallet inventory recognizes 420 Grants; no dedicated Grants workflow is inferred |
| 420Indexer lifecycle projection | SHARED REQUIRED integration surface | classified here; functional implementation/qualification belongs to GRANTS-AUDIT-6 |
| Explorer / Search | SHARED OPTIONAL consumer surfaces for this step | non-authoritative; no Grants-specific authority created |
| standalone Grants frontend/site | NOT APPLICABLE under current canonical Genesis definition | must not be invented as an acceptance requirement |
| dedicated Grants backend/API | NOT APPLICABLE as canonical authority | canonical state remains contract-based; shared services may project it |
| fixed Grants Genesis address | NOT APPLICABLE | Registry resolution is canonical |

## Repository evidence reconciled

- `docs/architecture/protocols/stake-governance-treasury-grants.md` defines the Civic → Grants → Treasury → Vault authority separation.
- `contracts/config/420grants-genesis.json` classifies Grants as `GENESIS_IMPLEMENTATION_PROTOCOL` and `publicStandaloneApplication: false`.
- `contracts/config/genesis-address-namespace.json` contains the single Registry-resolved `grants-router` entry.
- `contracts/config/genesis-canonical-addresses.json` carries `grants-router` only in the Registry-resolved inventory.
- `contracts/config/genesis-dapp-contract-map.json` contains the seven-file 420 Grants contract inventory.
- `contracts/config/420wallet-genesis.json` recognizes `420 Grants`.
- `contracts/src/libraries/ServiceIds420.sol` defines `GRANTS = keccak256("420/service/grants/v1")`.
- historical PR #26 records the original Grants lifecycle purpose and non-custodial architecture boundary.

## Level 1 qualification evidence

Exact-head workflow: **420Grants Audit Qualification**  
Run: **37055267365**  
Result: **PASS**

### grants-contract-core — job 110998596847

- exact qualification head checkout — PASS
- exact SHA verification — PASS
- Grants audit model verifier — PASS
- Grants Solidity formatting — PASS
- Grants family build — PASS
- Grants lifecycle/adversarial regression suite — PASS

### grants-security — job 110998596514

- exact qualification head checkout — PASS
- exact SHA verification — PASS
- forbidden primitive scan — PASS
- hardening-profile Grants test suite — PASS
- targeted Slither high-severity gate — PASS

Affected shared Solidity workflow: **Solidity Contracts**, run **37055267238** — **PASS** on the same implementation SHA.

Skipped unrelated workflows are not counted as passing evidence and are not required by this Level 1 definition/inventory step.

## Requirements satisfied

- exact canonical Grants purpose located and reconciled;
- original implementation PR identified;
- canonical seven-file contract suite reconciled;
- Civic / Treasury / Vault / CapabilityRegistry authority graph recorded;
- frontend/backend/indexer/client surfaces explicitly classified;
- Registry/address model reconciled with no fixed Grants predeploy;
- Wallet/service discovery presence confirmed;
- canonical architecture/config/dApp-map consistency verified;
- exact-head app-specific Level 1 qualification passed;
- no missing, cancelled or stale required GRANTS-AUDIT-1 check remains.

## Milestone status

No Level 2 milestone is triggered by this step alone. The next meaningful broader Grants integration milestone occurs after the deployment/Registry and client/indexer work converge.

## Intentionally deferred

- broader app integration qualification — deferred to the appropriate Level 2 milestone;
- complete repository Level 3 closeout — deferred to GRANTS-AUDIT-8;
- production-equivalent live deployment evidence — GRANTS-AUDIT-9;
- Genesis/production closeout — GRANTS-AUDIT-10.

## Blockers

**None for GRANTS-AUDIT-1.**

## Completion state

**COMPLETE**

Next canonical roadmap step: **GRANTS-AUDIT-2 — contract consistency and lifecycle remediation**.
