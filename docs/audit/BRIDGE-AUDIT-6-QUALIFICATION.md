# BRIDGE-AUDIT-6 — Deployment, initialization and Registry publication qualification

**Status:** COMPLETE  
**Qualification level:** Level 1 step-specific  
**Qualified implementation SHA:** `6cb672b3035ff707f879971f1c1a648057091cd1`  
**Qualification evidence SHA:** `7a50712a27f1ff847e75157580f8dbd331f47fa3`  
**Audit branch / PR:** `audit/420bridge-complete-20261001` / PR #463  
**Qualification-only branch / PR:** `qualification/bridge-a6-20261002` / PR #476 — DO NOT MERGE  
**Current-main reconciliation parent used for A6:** `27ae1873edcca8fb05dec9f4e70af9832b5dafe2`

## Qualified outcome

BRIDGE-AUDIT-6 closes the repository-side deployment, initialization and ProtocolRegistry publication specification for the complete Bridge stack without claiming live-chain deployment evidence.

The qualified implementation establishes:

- one canonical deployment authority in `contracts/config/bridge/deployment-v1.json`;
- an explicit ordered deployment/init sequence for the frozen gateway and all registry-resolved Bridge components;
- frozen constructor identity for GenesisResident Bridge components: GovernanceTimelock, ProtocolRegistry and global `genesisConfigHash`;
- `VerifiedGateway420@0x0000000000000000000000000000000000000438` remains the only fixed Bridge Genesis predeploy;
- the frozen gateway may materialize with `verifier = address(0)` as an explicit fail-closed disabled Genesis state;
- gateway deposit/withdraw proof execution reverts until governance installs a nonzero code-bearing verifier;
- all other core Bridge contracts are deployment-output / ProtocolRegistry-resolved components rather than assumed fixed addresses;
- the historical `0x043c` BridgeAssetRegistry claim and `0x0443` GatewayRouter claim remain retired and forbidden as deployment authority;
- historical candidate/reservation addresses remain non-authoritative unless separately approved by a future atomic namespace decision;
- ProtocolRegistry component IDs, version/lifecycle rules and runtime-code-hash publication checks are explicit;
- chain identities, assets, routes, adapters, verifier configuration, risk limits, router trust and accounting-health initialization order is reproducible;
- local 420 chain identity remains inactive until the public testnet chain/genesis fingerprint is frozen;
- post-deployment governance/timelock ownership and emergency/system-safety boundaries remain authoritative;
- deployment smoke, rollback and recovery operations are documented in `docs/apps/bridge/deployment-operations.md`;
- the canonical Genesis app map retains current-main content while adding `BridgeChainRegistry420` to the Bridge inventory.

## Canonical deployment/publication authority

Primary repository authority:

- `contracts/config/bridge/deployment-v1.json`
- `contracts/config/genesis-config-commitment.json`
- `contracts/config/predeploy/storage-init.json`
- `contracts/config/genesis-canonical-addresses.json`
- `contracts/config/genesis-dapp-contract-map.json`
- `contracts/config/bridge/chain-identities-v1.json`
- `contracts/config/bridge/verification-policy.json`
- `contracts/config/bridge/risk-limits.json`
- `docs/apps/bridge/deployment-operations.md`

The manifest distinguishes fixed predeploy authority from registry-resolved deployment outputs and explicitly defers live addresses, receipts and publication transactions to BRIDGE-AUDIT-9.

## Exact-head Level 1 evidence

The implementation SHA `6cb672b3035ff707f879971f1c1a648057091cd1` was qualified through an evidence-only neutral trigger commit at `7a50712a27f1ff847e75157580f8dbd331f47fa3`. The trigger file changes no executable code, tests, workflow policy, dependency, protocol interface, deployment configuration or substantive requirement.

| Workflow | Run | Job | Result |
| --- | ---: | ---: | --- |
| 420Bridge Fast Qualification | #41 / `36972928467` | `bridge-fast` / `110730601071` | PASS |
| 420Docs Qualification | #4276 / `36972928487` | `qualify` / `110730590792` | PASS |
| Genesis Address Authority | #844 / `36972928535` | `cross-manifest-authority` / `110730540301` | PASS |
| Solidity Contracts | #4063 / `36972928527` | `pr-shards (0)` / `110731065104` | PASS |
| Solidity Contracts | #4063 / `36972928527` | `pr-shards (1)` / `110731065091` | PASS |
| Solidity Contracts | #4063 / `36972928527` | `pr-shards (2)` / `110731065005` | PASS |
| Solidity Contracts | #4063 / `36972928527` | `pr-shards (3)` / `110731065066` | PASS |

Bridge Fast #41 passed:

- exact qualification-head checkout/verification;
- Bridge hardening verifier;
- BRIDGE-AUDIT-6 deployment verifier;
- Bridge contract suite;
- affected Exchange Bridge qualification tests;
- Pay/Swap/Bridge cross-suite integration.

Solidity #4063 executed all four real PR shards successfully. The monolithic `foundry` and `compute-fast` jobs were skipped by workflow design and are not counted as substitutes for real shard evidence.

Docs #4276 passed the complete deterministic documentation qualification pipeline after the Bridge deployment runbook and existing Swap operations/testnet pages were made reachable from canonical navigation/entry pages.

Genesis Address Authority #844 passed exact-head cross-manifest validation, including canonical frozen ownership, namespace/collision checks, predeploy parity and retired-claim rejection.

## Solidity and deployment-binding coverage

A6 adds/qualifies:

- `BridgeDeploymentBinding420.t.sol`, proving the real `ProtocolRegistry.registerComponent` publication graph for the gateway and registry-resolved Bridge components;
- Registry rejection of no-code implementation addresses;
- `VerifiedGateway420` Genesis deployment with zero verifier;
- proof-path failure while the verifier is disabled;
- governance activation rejection for non-code verifier addresses;
- successful activation only with a code-bearing verifier contract;
- static manifest checks that bind frozen addresses, Genesis commitment, constructor metadata, component-ID preimages, retired claims, chain activation policy and runbook requirements.

## Reconciliation history

The long-lived Bridge audit branch had diverged substantially from current `main`. Before final A6 qualification, the audit work was reconciled onto current main with merge commit:

`8593cede91462a51eaf7fa62317abece31556069`

A subsequent overlap review identified that `contracts/config/genesis-dapp-contract-map.json` had significant newer main-branch work. The file was semantically reconciled to preserve current-main content while retaining the Bridge-only `BridgeChainRegistry420` inventory addition.

Final implementation head after reconciliation and documentation-navigation fixes:

`6cb672b3035ff707f879971f1c1a648057091cd1`

The neutral qualification trigger commit `7a50712a27f1ff847e75157580f8dbd331f47fa3` exists only to obtain non-suppressed exact-head CI and is not an independently mergeable implementation revision.

## Non-blocking unrelated CI observation

A neutral-head 420Indexer workflow reported an Explorer inventory-drift assertion involving `stake.go`. Core Indexer tests and retained Indexer verifiers passed. That failure is outside BRIDGE-AUDIT-6 scope and is not used as A6 qualification evidence.

## Qualification scope and live boundary

This is a **Level 1** repository-side qualification.

A6 does **not** claim:

- actual public-testnet Bridge deployment addresses;
- deployment receipts or transactions;
- live ProtocolRegistry publication transactions;
- production adapter/verifier deployment evidence;
- live external-chain proofs;
- live smoke/reorg/recovery transaction evidence.

Those are production-equivalent testnet requirements reserved for **BRIDGE-AUDIT-9**.

Level 2 remains planned after BRIDGE-AUDIT-8.  
Level 3 remains BRIDGE-AUDIT-10.

## Exit decision

**BRIDGE-AUDIT-6 COMPLETE.**

Next canonical step: **BRIDGE-AUDIT-7 — Security, adapter and invariant completion.**
