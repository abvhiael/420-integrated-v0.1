# CMP-1.3.7 — WorkerRegistry deployment and ProtocolRegistry publication qualification

Status: **REPOSITORY IMPLEMENTATION COMPLETE; LIVE QUALIFICATION BLOCKED BY NETWORK/CMP-1.5 DEPENDENCY.**

CMP-1.3.7 is the deployment/publication gate explicitly deferred by CMP-1.3.6. It does not invent a deployment when no canonical public testnet exists.

## Repository-controlled implementation

This step adds:

- `ComputeWorkerCanonicalWiring420` — immutable chain-specific audit record for the canonical WorkerRegistry job/admission graph;
- `ComputeWorkerCanonicalWiring420.t.sol` — exact-graph/code-hash/governance/unbound-adapter adversarial tests;
- `cmp-1.3.7-worker-deployment-evidence.json` — fail-closed live evidence manifest;
- `verify-cmp-1-3-7-deployment.py` — repository-readiness and live-evidence verifier.

The wiring verifier checks:

- exact runtime code hashes for jobs, worker-evidence, worker registry, attestation, Trust adapter, and stake adapter;
- exact chain ID;
- exact governance timelock shared by the policy-bearing worker components;
- `ComputeJobRegistry420.workerEvidence` points to the snapshot adapter;
- job match evidence equals the snapshot adapter's accepted-match source;
- snapshot adapter is one-time bound to the same job registry;
- accepted-match runtime reports the same job registry;
- snapshot adapter points to the same worker registry, attestation, Trust, stake, authorization and match surfaces;
- attestation, Trust and stake adapters all point to the same canonical worker registry;
- worker registry exposes nonzero canonical provider/node/resource parents.

The verifier is read-only. It deploys nothing, publishes nothing, grants no capability, moves no funds and cannot make an unqualified deployment authoritative.

## ProtocolRegistry publication rule

WorkerRegistry components remain registry-resolved application/service contracts. CMP-1.3.7 allocates no new frozen Genesis predeploy address.

A live publication is valid only after:

1. each contract is deployed on the canonical network;
2. deployment transaction and block are independently recorded;
3. runtime `extcodehash` is recorded and matches qualified artifacts;
4. `ComputeWorkerCanonicalWiring420.assertWiring()` succeeds on that network;
5. the wiring `graphHash()` is recorded;
6. required service IDs are governance-approved when they are extension IDs;
7. the authorized publisher uses `ProtocolRegistry.publishRegisteredService`;
8. registration metadata commits component type, manifest, dependency root and interface hash;
9. registry resolution returns the deployed implementation and active version;
10. publication transaction evidence is recorded.

Registry publication is discovery/version authority only. It does not grant worker, verifier, custody, settlement, staking or slashing authority.

## Live blockers

The repository's canonical deployment authority already records that the public testnet is not live. CMP-1.2.9 therefore remains live-blocked, and CMP-1.3.7 inherits that factual network blocker.

Additionally, CMP-1.3.5 deliberately requires a qualified CMP-1.5 compute-collateral source for any stake-required production admission. The current evidence manifest therefore records:

- `public_testnet_live = false`;
- `cmp_1_5_compute_stake_live_source = false`;
- all live deployment addresses/transactions/blocks/code hashes as null;
- ProtocolRegistry publication as incomplete.

Those fields must not be populated with local fixture values.

## Verification

Repository-controlled readiness:

`python3 scripts/verify-cmp-1-3-7-deployment.py --repository-ready`

This must exit zero in CI/review.

Live qualification:

`python3 scripts/verify-cmp-1-3-7-deployment.py`

Default mode intentionally exits nonzero until real deployment evidence, CMP-1.5 live stake source qualification, and canonical ProtocolRegistry publication are present.

## Qualification tests

The dedicated Foundry test proves:

1. an exact graph with exact runtime code hashes and governance passes;
2. an incorrect worker runtime code hash fails closed;
3. a wrong governance authority fails closed;
4. an unbound worker-snapshot evidence adapter fails closed.

These tests prove the verifier behavior only. They are not substitutes for live deployment evidence.

## Invariant mapping

CMP-1.3.7 strengthens:

- CMP-INV-002/003/004 — deployed worker ancestry is pinned to one canonical graph;
- CMP-INV-005 — publication/wiring verification grants no unrelated authority;
- CMP-INV-019 — job worker evidence cannot silently point at a second worker graph;
- CMP-INV-021/022 — stake integration remains bound to the qualified compute-stake adapter/source path;
- CMP-INV-023 — Trust remains a separately bound evidence source;
- CMP-INV-026 — deployment graph and worker execution identity are reconstructable;
- CMP-INV-028/029 — code or dependency replacement changes the graph/hash and fails the pinned wiring;
- CMP-INV-030 — deployment graph is provider-neutral and general-purpose.

## Completion semantics

CMP-1.3.7 has two distinct qualification layers:

**Repository package qualification** requires exact-head Solidity, Integrated and Docs gates plus successful repository-ready verification.

**Live deployment qualification** requires real canonical-chain evidence and the default verifier to exit zero.

Until the network and CMP-1.5 live dependency exist, CMP-1.3.7 must remain **LIVE BLOCKED**, even if all repository exact-head gates are green. No synthetic evidence may be used to mark the live portion COMPLETE.
