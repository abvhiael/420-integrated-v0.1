# CMP-1.4.2 — Verifier classes and workload capabilities

Status: **IMPLEMENTATION COMPLETE; LEVEL 1 QUALIFICATION PENDING. NO LIVE DEPLOYMENT/PUBLICATION CLAIM.**

## Canonical definition

The detailed Compute Market roadmap defines CMP-1.4.2 exactly as:

> Support independently typed classes such as protocol verifier, independent verifier, job-owner verifier, oracle verifier, TEE verifier and committee verifier.

Parent CMP-1.4 purpose:

> Separate workers from verification authorities.

## Repository baseline and gap analysis

Baseline current `main`: `152364d9b69b6d5fe159685fb986c9139e0522cb`, which contains the qualified CMP-1.4.1 `ComputeVerifierRegistry420`.

CMP-1.4.0 froze six initial verifier classes and assigned class/workload ownership to CMP-1.4.2. CMP-1.4.1 deliberately implemented identity/lifecycle only and granted no class or workload capability. At CMP-1.4.2 intake, no canonical class/capability registry existed. The requirement was therefore missing rather than partially satisfied.

Canonical ComputeMarket workload classes are versioned `bytes32` identities. This step does not redefine AI-specific workload taxonomies or resource compute classes and does not create a wildcard verifier capability.

## Implementation

`contracts/src/compute/ComputeVerifierCapabilityRegistry420.sol` now provides exact verifier class and workload capability qualification.

The six initial typed classes are:

- `PROTOCOL_VERIFIER`
- `INDEPENDENT_VERIFIER`
- `JOB_OWNER_VERIFIER`
- `ORACLE_VERIFIER`
- `TEE_VERIFIER`
- `COMMITTEE_VERIFIER`

Each capability is keyed by the exact tuple:

`(verifierId, verifierClass, workloadClass)`

Capabilities are governance-qualified with a nonzero evidence commitment and independently revisioned. Revocation creates a new immutable capability revision rather than deleting historical qualification evidence.

`isCapable` additionally requires the exact current verifier authority and verifier revision to be ACTIVE in `ComputeVerifierRegistry420`. A historical class/workload qualification therefore cannot make a suspended or retired identity currently eligible.

There is no wildcard workload, class inheritance, class substitution or automatic broadening across workload identities.

## Authority separation

Capability qualification is intentionally not:

- job appointment or verifier selection;
- beneficial-owner independence;
- signed-verdict authorization;
- verification policy publication;
- result correctness proof;
- settlement or Vault authority;
- beneficiary selection;
- stake/slash authority;
- worker/provider/resource authority;
- governance, validator, bridge or arbitrary-wallet authority.

CMP-1.4.5 remains responsible for independent verifier selection. CMP-1.4.3 remains responsible for exact versioned verification policies. Later verdict/adapters must consume these capability facts without treating them as correctness by themselves.

## Security and invariant disposition

This step preserves:

- CMP-INV-005 — qualification does not imply unrelated authority;
- CMP-INV-016 — capability does not prove correctness;
- CMP-INV-017 — workload/policy semantics remain explicit and later policy-bound;
- CMP-INV-020 — suspension/revocation does not rewrite historical evidence;
- CMP-INV-023 — reputation/Trust remains separate;
- CMP-INV-025 — governance cannot fabricate a verification outcome through class qualification;
- CMP-INV-026 — immutable capability history is reconstructable;
- CMP-INV-027 — no hidden privilege for replaceable services;
- CMP-INV-030 — no AI dependency for non-AI workload classes.

No fixed Genesis predeploy, live deployment, ProtocolRegistry publication, Vault grant or settlement grant is introduced.

## Level 1 qualification requirements

Required step-specific qualification:

1. compile affected Compute contracts;
2. run retained `Compute*.t.sol` suite including `ComputeVerifierCapabilityRegistry420.t.sol`;
3. cover independent class typing, exact workload matching, revocation/history, unauthorized mutation, suspended identity, stale identity revision and retired identity failure paths;
4. run the CMP-1.4.2 mechanical verifier;
5. pass the dedicated Compute Market Qualification and focused Solidity Contracts workflows on the exact implementation SHA.

## Level 2 milestone

Level 2 is **not required yet**. The documented app-specific milestone remains after CMP-1.4.3, when verifier identity/lifecycle, independently typed classes/workload capabilities and exact versioned verification policy can be integrated and revalidated together.

## Exit criteria

CMP-1.4.2 is COMPLETE only when:

- all six initial verifier classes are distinct and recognized;
- exact workload capability bindings are implemented;
- class/workload tuples qualify and revoke independently with immutable history;
- current eligibility requires an ACTIVE exact-current verifier identity;
- unknown/zero/unauthorized/retired mutation paths fail closed;
- capability qualification grants no unrelated authority;
- exact-head Level 1 qualification is green;
- durable evidence records the implementation SHA and results.

## Completion

**NOT YET COMPLETE.** Implementation and evidence artifacts are present; exact-head Level 1 CI qualification remains pending.
