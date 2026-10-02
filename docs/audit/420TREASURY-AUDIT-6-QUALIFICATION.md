# 420Treasury TREASURY-AUDIT-6 qualification evidence

Status: **COMPLETE**  
Roadmap step: **TREASURY-AUDIT-6 — deployment, registry publication and release materialization**  
Qualification level: **Level 1 — per-roadmap-step fast qualification**  
Implementation SHA: `5e37fd3f470a6c2dfd6102042ca7386f4b1c2e87`  
Qualification base/main SHA: `27ae1873edcca8fb05dec9f4e70af9832b5dafe2`  
Audit branch: `audit/420treasury-complete-20261001`  
Pull request: **#474**  
CI workflow: **420Treasury audit qualification**  
Passing workflow run: **37040835840**  
Passing job: **110950258291**

## Canonical scope

TREASURY-AUDIT-6 materializes the repository-side release/deployment boundary for the modern Treasury contract family without inventing live network state.

The step requires:

- deterministic deployment order;
- exact constructor dependency bindings;
- release artifact/runtime identity retention;
- canonical ProtocolRegistry publication of the Treasury router/service;
- retained deployment identity and verification evidence;
- preservation of the frozen Genesis address namespace.

The modern Treasury router remains `REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS`. No new frozen Treasury predeploy was introduced.

## Address/deployment policy

The retained release materialization explicitly preserves:

- namespace authority: `contracts/config/genesis-address-namespace.json`;
- GovernanceTimelock frozen address: `0x0000000000000000000000000000000000000429`;
- ProtocolRegistry frozen address: `0x0000000000000000000000000000000000000434`;
- CapabilityRegistry420 candidate reservation: `0x0000000000000000000000000000000000000447`, status `CANDIDATE_NOT_DEPLOYED_NOT_FROZEN`;
- TreasuryRouter420 status: `REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS`;
- no adopted CREATE2 policy and therefore no invented deterministic production address;
- live deployed addresses, chain/genesis identity, transactions and receipts deferred to TREASURY-AUDIT-8.

## Deterministic deployment order

The canonical repository deployment sequence is:

1. deploy `TreasuryAuthorization420(CapabilityRegistry420)`;
2. deploy `TreasuryPolicyRegistry420(GovernanceTimelock)`;
3. deploy `TreasuryBudgetRegistry420(GovernanceTimelock, TreasuryPolicyRegistry420)`;
4. deploy `TreasuryDisbursementRegistry420(GovernanceTimelock, TreasuryAuthorization420, TreasuryPolicyRegistry420, TreasuryBudgetRegistry420)`;
5. execute one-time `TreasuryBudgetRegistry420.setController(TreasuryDisbursementRegistry420)`;
6. deploy `TreasuryRouter420(TreasuryBudgetRegistry420, TreasuryDisbursementRegistry420)`;
7. publish the canonical Treasury service through `ProtocolRegistry.publishRegisteredService`.

The canonical service ID preimage is:

`420/service/treasury/v1`

The canonical service implementation is the deployed `TreasuryRouter420`.

## Repository release materialization

Added:

- `contracts/config/treasury/treasury-audit-6-release-materialization.json`
- `contracts/test/TreasuryDeploymentBinding420.t.sol`
- `scripts/verify-treasury-audit-6-release.py`

Updated:

- `.github/workflows/treasury-audit.yml`

### Release manifest

The release manifest records:

- deployment order;
- exact constructor dependency graph;
- one-time controller post-initialization;
- ProtocolRegistry publication path;
- Registry service ID and implementation role;
- compiler/EVM/optimizer identity;
- artifact paths;
- address namespace policy;
- repository/live evidence separation;
- explicit ownership of live deployment evidence by TREASURY-AUDIT-8.

### Fail-closed release verifier

The retained verifier fails if:

- TreasuryRouter becomes a fixed Genesis predeploy;
- the namespace authority changes;
- GovernanceTimelock or ProtocolRegistry frozen addresses drift;
- CapabilityRegistry420 candidate identity/status drifts;
- constructor order or dependency bindings change;
- controller initialization changes;
- Registry publication no longer targets TreasuryRouter420;
- the Treasury service ID changes;
- live testnet addresses/transactions are fabricated into the repository-only evidence record.

## Local-EVM deployment and Registry binding qualification

`contracts/test/TreasuryDeploymentBinding420.t.sol` uses the actual:

- `CapabilityRegistry420`;
- `ProtocolRegistry`;
- `TreasuryAuthorization420`;
- `TreasuryPolicyRegistry420`;
- `TreasuryBudgetRegistry420`;
- `TreasuryDisbursementRegistry420`;
- `TreasuryRouter420`.

The suite proves:

- exact constructor graph;
- exact policy/budget/disbursement/router identity bindings;
- one-time Budget controller binding;
- real CapabilityRegistry component registration for the Treasury capability domain;
- active ProtocolRegistry component registration for the exact TreasuryRouter;
- ProtocolRegistry runtime code hash equals the deployed router EXTCODEHASH;
- canonical service publication resolves to the exact TreasuryRouter;
- nonzero registration-profile manifest/interface/dependency commitments;
- a separately deployed wrong router is visibly not the registered canonical router.

Result: **4 passed, 0 failed, 0 skipped**.

## Retained artifact identities

The exact-head workflow retained compiled artifact SHA-256 and compiler runtime-template SHA-256 values:

| Contract | Artifact SHA-256 | Compiler runtime-template SHA-256 |
| --- | --- | --- |
| TreasuryAuthorization420 | `de82741aaac0bdb45dfff3c05d3624c54f1789013afc8005bc0731b6c5a8e8c9` | `ad45f4ec656a6c9cbf855878b108a4fff6013fe9ad8d4dc5e9215363cecfad3f` |
| TreasuryPolicyRegistry420 | `4cd7f61838284e7714dd2388f40d52743e939c33358033ef12d6497ffb23568f` | `27f0713de45de0f3eab8992c70b4d6f18f00309840d9a070c89df3f6e32b3f41` |
| TreasuryBudgetRegistry420 | `8b6b1017ff1c95aa42169e886f81aec7ee51f9ca921cf23830f48db57267c4fa` | `0dce52ef285fe1f61c2a8b5c7881f325b8a311552d327af6c65f2c4ce07c7980` |
| TreasuryDisbursementRegistry420 | `c5706b6d87d7e5912acba974eff69c1f3829f9e8c6947a9e73b5cc1c5d23d59f` | `1443bfb162f42e13d48417890a40a7e52053ba97b74d8fa8d3aab284113a483d` |
| TreasuryRouter420 | `ae7cce99b64be56d1dbb8aa21510358b550ed9c11de1a89f6f9379d482fe18d0` | `dc321758ae43ea42adad834cb07edfd03f82f39128d8c1d2ed38b4974a9f9b99` |

## Retained local deployed runtime identities

The exact-head local-EVM qualification emitted:

| Contract | Local deployed runtime code hash |
| --- | --- |
| TreasuryAuthorization420 | `0x94933bf15d546843fa67fde91c00e9c2eafc816175d5445a51ff2ac59a338dee` |
| TreasuryPolicyRegistry420 | `0x3fe59fa89b3e44980c32184f760167b462c2e0d7d0710001d79fbbccb8497669` |
| TreasuryBudgetRegistry420 | `0xc19ae6709a9efd1ebaf1834ff7ace8d19937dacabdf3013a1ceba2b9ae6e9cd6` |
| TreasuryDisbursementRegistry420 | `0xa7133cd2dbec7bf5baeb236a3664601e59f54ad754862650784a9d6a956fc409` |
| TreasuryRouter420 | `0x810893b96c63c17076f7464db42fd9dc04fc4ebe2c33bf1ecfddfeee169d8759` |

These are repository-local qualification identities, not claims about public-testnet deployment.

## Retained Registry/release commitments

The local-EVM qualification retained:

- dependency root: `0x3b6e21a320b6f698b613dd8b1f5155b44679155d97653de5513ae4143215473e`;
- manifest commitment: `0xff748a2f88cfc791d779b0b09d83b29ff1afcfa34ea5e0ef951945b9fdbe1049`;
- interface commitment: `0x76d091c84c5fbde139282ab158a39c1bdebc987aa5da29942dd082ed3dab681f`;
- TreasuryRouter component runtime code hash: `0x810893b96c63c17076f7464db42fd9dc04fc4ebe2c33bf1ecfddfeee169d8759`.

The local qualification addresses emitted by Foundry are intentionally treated as local-EVM evidence only and are not promoted to canonical network addresses.

## Exact-head Level 1 qualification

Workflow run `37040835840`, job `110950258291`, exact implementation SHA `5e37fd3f470a6c2dfd6102042ca7386f4b1c2e87`:

- exact-head checkout verification: **PASS**
- Foundry setup: **PASS**
- Node setup: **PASS**
- Go setup: **PASS**
- Treasury Solidity formatting: **PASS**
- Treasury + affected Grants build: **PASS**
- modern Treasury descriptor vs compiled ABI: **PASS**
- TREASURY-AUDIT-6 release materialization verifier: **PASS**
- compiled artifact identity retention: **PASS**
- Treasury deployment + Registry binding suite: **PASS — 4/4**
- Treasury lifecycle regression suite: **PASS — 9/9**
- Treasury security/property suite: **PASS — 5/5**
- affected Grants release-evidence suite: **PASS — 4/4**
- affected 420Indexer integration build: **PASS**
- Treasury Indexer descriptor/read/reorg/API qualification: **PASS**
- affected Analytics Treasury boundary qualification: **PASS**
- canonical authority/config verifier: **PASS**
- Vault release evidence consumer inventory: **PASS**
- targeted Treasury Slither high-severity gate: **PASS — 0 high-severity findings**
- Treasury forbidden-primitive scan: **PASS**

## Requirement-by-requirement exit verification

### Deterministic deployment order and constructor bindings

**SATISFIED.**

The order and constructor graph are retained in machine-readable release configuration and proven by local-EVM deployment against the actual contracts.

### Retain deployment artifact/runtime hashes

**SATISFIED for repository release materialization.**

Exact compiled artifact identities, runtime-template identities, local deployed EXTCODEHASH identities and Registry code-hash binding are retained in the passing exact-head workflow/evidence.

Live-network runtime hashes remain owned by TREASURY-AUDIT-8.

### Publish canonical router/service through ProtocolRegistry

**SATISFIED for repository/local-EVM qualification.**

The actual ProtocolRegistry publishes `420/service/treasury/v1` to the exact deployed TreasuryRouter, records its runtime identity and registration profile, and resolves the service active.

Live-chain publication transaction evidence remains TREASURY-AUDIT-8.

### Retain deployed addresses, chain/genesis identity and verification evidence

**SATISFIED at the repository/local-EVM boundary; live evidence intentionally deferred.**

The exact-head qualification retains local deployment addresses and runtime identities as proof that the deployment graph is executable.

No live chain/genesis identity, public-testnet address or deployment/Registry transaction is fabricated. Those fields remain explicitly null/empty and are canonical TREASURY-AUDIT-8 requirements.

## Security/invariant result

No new Treasury custody or ambient authorization path was introduced.

The deployment materialization preserves:

- GovernanceTimelock control for Policy/Budget/Disbursement governance paths;
- exact CapabilityRegistry dependency for execution authorization;
- one-time Budget controller binding;
- exact Router→Budget/Disbursement dependencies;
- Registry publication as discovery only, not as Treasury execution authority;
- no new frozen Treasury predeploy;
- no invented CREATE2 policy;
- fail-closed separation between repository qualification and live deployment evidence.

Targeted Slither reports **zero high-severity Treasury findings** and the forbidden-primitive scan passes.

## Level 2 status

A separate Level 2 milestone was not required.

The material shared integration introduced by this step — actual ProtocolRegistry publication plus real CapabilityRegistry dependency binding — was exercised directly in the Level 1 local-EVM deployment suite together with all retained Treasury regressions.

## Intentionally deferred

Not blockers for TREASURY-AUDIT-6:

- public-testnet chain ID/network/genesis identity — TREASURY-AUDIT-8;
- actual public-testnet Treasury contract addresses — TREASURY-AUDIT-8;
- public-testnet deployment transactions/receipts/blocks — TREASURY-AUDIT-8;
- live ProtocolRegistry publication transaction evidence — TREASURY-AUDIT-8;
- live runtime code-hash verification against deployed addresses — TREASURY-AUDIT-8;
- live constructor/dependency binding verification — TREASURY-AUDIT-8;
- operator/runbook and incident/recovery documentation closeout — TREASURY-AUDIT-7;
- external security review and final Genesis/production closeout — TREASURY-AUDIT-9;
- repository-wide Level 3 closeout.

## Limitations

The repository has no adopted CREATE2/deployment-factory policy for registry-resolved Treasury services. AUDIT-6 therefore does not invent deterministic production addresses.

The retained deployment addresses from Foundry are local-EVM test identities only.

Repository materialization and local-EVM ProtocolRegistry publication do not establish public-testnet deployment.

## Blockers

**None for TREASURY-AUDIT-6.**

Live network evidence remains future work under the explicit TREASURY-AUDIT-8 testnet step rather than an AUDIT-6 blocker.

## Completion determination

Every repository-side TREASURY-AUDIT-6 requirement has been implemented and directly qualified against exact implementation SHA `5e37fd3f470a6c2dfd6102042ca7386f4b1c2e87`.

**TREASURY-AUDIT-6 is COMPLETE.**

Next canonical roadmap step: **TREASURY-AUDIT-7 — documentation/operator closeout**.
