# GRANTS-AUDIT-5 qualification evidence

## Step

**GRANTS-AUDIT-5 — Registry, address and deployment model**

## Qualification level

**Level 1 — per-roadmap-step fast qualification**

This step materializes the repository-side Grants release/deployment boundary without inventing live network state. The canonical Grants service remains registry-resolved, has no fixed Genesis implementation address, and is published through the frozen ProtocolRegistry authority.

## Implementation SHA

`19c8a7875525b0e363c3a537d5de8e03a8182386`

## Reconciliation base

`main` at `14d46231aa4350b2e84dee52f0f664bdd2e785f4`

Audit branch: `feature/420grants-audit-remediation-v2`  
PR: #484 — `audit(grants): harden lifecycle and establish 420Grants audit track`

At qualification time PR #484 was open and mergeable and the audit branch remained 0 commits behind `main`.

## Canonical scope

GRANTS-AUDIT-5 requires the repository to preserve the canonical no-fixed-address Grants model and materialize an executable, verifiable deployment/publication package for the release candidate.

Repository-side requirements:

- preserve `GrantRouter420` as `REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS`;
- preserve frozen GovernanceTimelock and ProtocolRegistry authority;
- retain deterministic Grants deployment order and constructor bindings;
- retain the one-time `GrantProgramRegistry420.bindAwardRegistry(GrantAwardRegistry420)` post-initialization;
- bind `GrantMilestoneRegistry420` to the canonical Treasury disbursement dependency;
- produce reproducible Grants compiled-artifact/runtime identity evidence;
- define canonical ProtocolRegistry publication for `420/service/grants/v1`;
- prove local-EVM Registry publication resolves the exact deployed `GrantRouter420`;
- preserve the explicit repository/live boundary so testnet deployment evidence is not fabricated.

Production-equivalent deployed addresses, runtime verification, transactions and receipts remain owned by GRANTS-AUDIT-9.

## Implementation completed

### Machine-readable release materialization

Added:

`contracts/config/grants/grants-audit-5-release-materialization.json`

The manifest records:

- namespace authority;
- no-fixed-address Grants Router policy;
- frozen GovernanceTimelock address `0x0000000000000000000000000000000000000429`;
- frozen ProtocolRegistry address `0x0000000000000000000000000000000000000434`;
- CapabilityRegistry420 candidate reservation `0x0000000000000000000000000000000000000447` with `CANDIDATE_NOT_DEPLOYED_NOT_FROZEN`;
- Treasury disbursement dependency as registry-resolved/testnet-gated rather than an invented fixed address;
- deterministic Grants deployment sequence;
- exact constructor dependencies;
- one-time Award Registry binding;
- canonical Grants service ID and Router implementation role;
- compiler/EVM/optimizer identity;
- expected Foundry artifact paths;
- repository/local-EVM evidence ownership;
- explicit empty/null live testnet evidence fields owned by GRANTS-AUDIT-9.

`contracts/config/420grants-genesis.json` now points directly to that release materialization.

### Deterministic deployment sequence

The canonical repository release sequence is:

1. `GrantAuthorization420(CapabilityRegistry420)`;
2. `GrantProgramRegistry420(GovernanceTimelock)`;
3. `GrantApplicationRegistry420(GrantAuthorization420, GrantProgramRegistry420)`;
4. `GrantAwardRegistry420(GovernanceTimelock, GrantProgramRegistry420, GrantApplicationRegistry420)`;
5. one-time `GrantProgramRegistry420.bindAwardRegistry(GrantAwardRegistry420)`;
6. `GrantMilestoneRegistry420(GovernanceTimelock, GrantAuthorization420, GrantProgramRegistry420, GrantAwardRegistry420, TreasuryDisbursementRegistry420)`;
7. `GrantRouter420(GrantProgramRegistry420, GrantAwardRegistry420, GrantMilestoneRegistry420)`;
8. `ProtocolRegistry.publishRegisteredService` for `420/service/grants/v1` to the exact deployed `GrantRouter420`.

No CREATE2 policy or fixed Grants implementation address is invented.

### Local-EVM deployment/Registry qualification

Added:

`contracts/test/GrantsDeploymentBinding420.t.sol`

The suite uses the real:

- `CapabilityRegistry420`;
- `ProtocolRegistry`;
- `TreasuryAuthorization420`;
- `TreasuryPolicyRegistry420`;
- `TreasuryBudgetRegistry420`;
- `TreasuryDisbursementRegistry420`;
- all six deployable Grants contracts.

It proves:

- exact Grants constructor graph;
- exact real Treasury disbursement dependency;
- exact GovernanceTimelock bindings in the local test authority model;
- one-time Award Registry binding;
- Router dependency graph;
- ProtocolRegistry component registration under `GrantIds420.COMPONENT_GRANTS`;
- canonical service publication to `420/service/grants/v1`;
- ProtocolRegistry service code hash equals deployed Router EXTCODEHASH;
- nonzero manifest/interface/dependency commitments;
- active service resolution returns the exact deployed Router;
- a separately deployed wrong Router is visibly not the registered canonical service.

Result on exact implementation SHA: **3 passed, 0 failed, 0 skipped**.

### Fail-closed AUDIT-5 release verifier

Added:

`scripts/verify-grants-audit-5-release.py`

The verifier rejects:

- schema/step drift;
- repository readiness regressions;
- fabricated live qualification;
- Grants Router fixed-predeploy drift;
- invented CREATE2 policy;
- GovernanceTimelock or ProtocolRegistry frozen-address drift;
- CapabilityRegistry candidate identity/status drift;
- fabricated fixed Treasury disbursement address;
- canonical Grants service-ID drift;
- noncanonical Registry publication API;
- deployment-order or constructor-binding drift;
- missing one-time Award Registry binding;
- wrong Router implementation publication;
- artifact-path inventory drift;
- missing Grants Genesis release-materialization pointer;
- fabricated live chain/address/transaction/runtime/constructor evidence.

### App-specific CI update

`.github/workflows/grants-audit.yml` now directly qualifies the AUDIT-5 release package by:

- triggering on Grants release configuration, release verifier and deployment-binding test changes;
- running the AUDIT-5 fail-closed release verifier;
- formatting the deployment-binding test;
- building the Grants contract family;
- retaining exact compiled artifact SHA-256 and compiler runtime-template SHA-256 identities;
- running the real deployment + Registry binding suite;
- retaining existing Grants lifecycle/adversarial qualification;
- retaining hardening-profile tests and targeted Slither security qualification.

## Canonical address and Registry conclusions

### Grants Router address model

**SATISFIED**

`contracts/config/genesis-address-namespace.json` contains exactly one:

- id: `grants-router`;
- contract: `GrantRouter420.sol`;
- status: `REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS`.

No `GrantRouter420` fixed Genesis assignment exists.

### ProtocolRegistry authority

**SATISFIED**

Canonical ProtocolRegistry remains the frozen predeploy:

`0x0000000000000000000000000000000000000434`

Canonical publication API:

`publishRegisteredService`

Canonical Grants service ID preimage:

`420/service/grants/v1`

Canonical implementation role:

`GrantRouter420`

### CapabilityRegistry dependency

**SATISFIED without fabricating deployment**

The namespace currently records CapabilityRegistry420 candidate address:

`0x0000000000000000000000000000000000000447`

with status:

`CANDIDATE_NOT_DEPLOYED_NOT_FROZEN`

The release materialization preserves that status rather than promoting it to live deployment evidence.

### Treasury dependency

**SATISFIED at repository boundary**

The Grants release manifest identifies canonical Treasury service dependency `420/service/treasury/v1` but deliberately contains no fabricated fixed `TreasuryDisbursementRegistry420` address.

The local deployment-binding suite uses the real TreasuryDisbursementRegistry420 contract and proves the Milestone registry binds exactly to it.

Live same-network Treasury dependency resolution is GRANTS-AUDIT-9 evidence.

## Retained compiled artifact identities

Exact-head workflow run #42 retained:

| Contract | Artifact SHA-256 | Compiler runtime-template SHA-256 |
| --- | --- | --- |
| GrantAuthorization420 | `bfce2e036b02ee586948c4b779688a18b2cbfb76a6f9fa4b2502fa23894e4f16` | `2b7050257eef0288e4df75d3a0c2472906c4d4c5d656c69ea172be7a0ecdc744` |
| GrantProgramRegistry420 | `9071c726e777cf4d7a31b0cfc6c3e19edf817867593a04449de371a7373a82a2` | `533f277906b18b1f99bf2f48dff0ef976fe41a65bb9e521a8024b7f787169ab1` |
| GrantApplicationRegistry420 | `10e8c687c828244a48d414654a7f7e1a0a0c3639b5686671f5f01f9a1966919f` | `4f3017f58a60a7231c88bb1853d2bd58482ce922ac6c98fb32deb222ae6cf616` |
| GrantAwardRegistry420 | `51723c323954d29761176d482cbce1cc8bce6dc2fd4d93fde218e98eb0af4776` | `5903e191c0bc7ce843001982297752436a1a45aa03ee83c2724b5dd3e5a5056d` |
| GrantMilestoneRegistry420 | `b3e257018c9e16f14790fde29d2d77109b89beffcef5babb1248301367ca9bd2` | `b5f972449d40080b4bf1142311adb1cc7c32fdcb5d2177dacf02b1f51c347eca` |
| GrantRouter420 | `35fa08cf19b5d6e2a5a96b0259b614633be54231ea7674332e0fb31b69e9e12a` | `2c6ef2a72a5801799d37ddf17888618f4f006decc734bfa6886b972bf02d6b92` |

These are exact repository release-candidate identities from the qualified build and are not public-testnet deployment claims.

## Retained local deployed runtime identities

Exact-head local-EVM qualification emitted:

| Contract | Local deployed runtime code hash |
| --- | --- |
| GrantAuthorization420 | `0xa5ae2db87cf4d425991459764b952a05e705c85d1a021a779e68f3d3485b3ae9` |
| GrantProgramRegistry420 | `0x67f9928d14ec0c5a0cd7b1506cc86cd7f93ecb2e93ea425f7020169c1161c4e8` |
| GrantApplicationRegistry420 | `0xb260390ba223fa72b56b9b07f63d07f82d9b946b437a08cf9eeda0fdc2f9244d` |
| GrantAwardRegistry420 | `0xf05f40fb75964a049e8d9b3d00e846d1ccb590bacdfab401d70b342492275104` |
| GrantMilestoneRegistry420 | `0x1a03274218fb5b8b56aab7981cc38aec4f8274bc9986c159a2987586190c3a01` |
| GrantRouter420 | `0x5ae92e08d6acf8990687538074653c571c05fad62a0cfee93d21522942461726` |

These are local-EVM runtime identities only.

## Retained Registry/release commitments

Exact-head qualification emitted:

- dependency root: `0xc33a8dab9ae3c98ac6d3a946f1f49d9b28d8208946eeb789897b7e4a08c8eaf8`;
- manifest commitment: `0x0fabd814b3ab08e58554fcd81797b53fe6732e17d06afe26ea3d90c1cd2f7a0f`;
- interface commitment: `0x7b5533d468874483db17a5b209db7849c3858b3537fa26d86b70e98cf6d216bd`;
- registered GrantRouter420 local runtime code hash: `0x5ae92e08d6acf8990687538074653c571c05fad62a0cfee93d21522942461726`.

## CI diagnosis history

An earlier AUDIT-5 implementation run failed only at Forge formatting for the newly added deployment-binding test. The release verifier itself had already passed. The formatter diff was applied without changing assertions or protocol semantics.

A later exact-head run passed, after which the manifest's repository-readiness field was recognized as stale. Because that field is configuration, it was changed from `false` to `true`, the verifier was strengthened to require it, and the new exact head was requalified rather than reusing stale evidence.

This final evidence therefore applies to the actual repository-ready configuration.

## Final Level 1 exact-head qualification

Exact implementation SHA:

`19c8a7875525b0e363c3a537d5de8e03a8182386`

### 420Grants Audit Qualification

Run: **37069334943** / #42  
Result: **PASS**

#### grants-contract-core — job 111045205831

- exact qualification head checkout — PASS;
- exact SHA verification — PASS;
- retained Grants audit model verifier — PASS;
- GRANTS-AUDIT-5 release materialization verifier — PASS;
- Grants + deployment-test formatting — PASS;
- Grants contract-family build — PASS;
- compiled artifact identity retention — PASS;
- Grants deployment and Registry binding qualification — PASS, 3/3;
- retained Grants lifecycle/adversarial regressions — PASS.

#### grants-security — job 111045206014

- exact qualification head checkout — PASS;
- exact SHA verification — PASS;
- dangerous Grants primitive scan — PASS;
- Grants hardening-profile retained suite — PASS;
- targeted Grants Slither high-severity gate — PASS.

### Solidity Contracts

Run: **37069334633** / #4303  
Workflow conclusion: **SUCCESS** on the same SHA.

Under active PR classification, expensive repository-wide Foundry inventory was not required for this ordinary app-scoped step. This is not represented as the Level-3 full Solidity inventory.

### Other workflow classification

- Genesis Address Authority #1083 — expected **SKIP** under current path/classification rules; no canonical address-authority file changed.
- 420Registry REG-AUDIT-4 #918 — expected **SKIP**; Registry production code was not changed.
- 420Indexer #1902 — expected **SKIP**; Indexer code was not changed.
- Treasury qualification #176 — expected **SKIP**; Treasury production/audit code was not changed.

Their behavior is not substituted for passing Grants evidence.

## Requirement-by-requirement exit verification

### Preserve Registry-resolved/no-fixed-address authority

**SATISFIED.**

GrantRouter420 remains registry-resolved with no frozen Genesis implementation address. The release verifier fails if this changes.

### Document deployment order and one-time Award Registry binding

**SATISFIED.**

The complete deterministic deployment graph is machine-readable and directly exercised using real contracts. Rebinding the Award Registry is rejected.

### Preserve dApp-map and service discovery inventory

**SATISFIED.**

The seven-file Grants suite remains the canonical `420 Grants` dApp-map inventory and `420/service/grants/v1` remains a canonical Genesis service ID.

### Reproducible compiled artifact/runtime-hash release manifest

**SATISFIED for repository release materialization.**

The machine-readable release package identifies the exact artifacts, compiler profile and runtime evidence policy. Exact artifact SHA-256, compiler runtime-template SHA-256 and local deployed EXTCODEHASH values are retained above from the final exact-head workflow.

### Concrete Registry publication descriptor bound to release artifacts

**SATISFIED for repository/local-EVM qualification.**

The materialization specifies the canonical service ID, Router implementation, component ID, publication API and release commitments. The real ProtocolRegistry publishes and resolves the exact deployed GrantRouter420 in local-EVM qualification and records its runtime code hash plus nonzero manifest/interface/dependency commitments.

### Production-equivalent deployment receipts/runtime verification

**INTENTIONALLY TESTNET-GATED; NOT AN AUDIT-5 BLOCKER.**

No live chain identity, deployed Grants addresses, deployment transactions, Registry transaction, live runtime hashes or constructor-binding receipts are fabricated.

These remain explicit GRANTS-AUDIT-9 requirements.

## Level 2 status

**No separate Level 2 run required.**

This step introduced a material deployment/publication package, but the relevant cross-component behavior was directly exercised in Level 1 using the actual ProtocolRegistry, CapabilityRegistry420, Treasury disbursement contract and full Grants deployment graph while retaining the full Grants lifecycle/security suites.

The next meaningful broader app integration milestone remains after client/indexer integration in GRANTS-AUDIT-6 converges.

## Intentionally deferred

- client/indexer/user-flow integration — GRANTS-AUDIT-6;
- documentation, threat model and operator guidance — GRANTS-AUDIT-7;
- complete exact-final-head Level 3 application-phase qualification — GRANTS-AUDIT-8;
- live chain/genesis identity — GRANTS-AUDIT-9;
- live deployed Grants addresses and runtime hashes — GRANTS-AUDIT-9;
- live constructor/immutable binding verification — GRANTS-AUDIT-9;
- live ProtocolRegistry publication transaction and active-resolution evidence — GRANTS-AUDIT-9;
- live CapabilityRegistry delegation and complete program-to-PAID Treasury/Vault flow — GRANTS-AUDIT-9;
- restart/reorg/RPC-disagreement behavior — GRANTS-AUDIT-9;
- Genesis/production closeout — GRANTS-AUDIT-10.

## Limitations

The repository has no adopted CREATE2 policy for registry-resolved Grants services, so no deterministic production Grants implementation address is invented.

The local-EVM deployment addresses and runtime hashes prove reproducible deployment behavior only; they are not public-testnet identities.

## Blockers

**None for GRANTS-AUDIT-5 repository completion.**

The remaining live deployment requirement is explicitly owned by GRANTS-AUDIT-9.

## Completion state

**COMPLETE**

Next canonical roadmap step: **GRANTS-AUDIT-6 — client/indexer/user-flow integration**.
