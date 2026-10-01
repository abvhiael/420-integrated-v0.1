# CMP-1.5.3 — Policy-specific minimum collateral

Status: **IMPLEMENTED. LEVEL 1 + FIRST CMP-1.5 LEVEL 2 MILESTONE QUALIFICATION PENDING.**

## Canonical definition

The controlling roadmap defines CMP-1.5.3 exactly as:

> Policy-specific minimum collateral

This step establishes one canonical, versioned minimum-collateral policy authority for both worker and verifier collateral positions. It does not implement exits, slashing, rewards, dispute/stake integration, final WorkerRegistry source integration, escrow redistribution, hostile qualification, release-candidate work or phase closeout.

## Canonical implementation

`contracts/src/compute/ComputeStakeCollateralPolicy420.sol`

The policy contract is deliberately non-custodial. It does not hold $420, select a stake source, move Vault funds, authorize a slash or grant verifier/worker authority.

Each immutable policy revision can independently require:

- worker collateral;
- verifier collateral;
- both.

For each required role the revision records:

- minimum active collateral;
- minimum slashable collateral;
- whether an exiting position is rejected for new acceptance.

Required minima must be nonzero and slashable minimum cannot exceed active minimum. A disabled role must carry zero minima.

## Versioning and historical integrity

Policy identity is `stakePolicyId`.

Revisions are append-only. Each commitment binds:

- chain ID;
- policy contract;
- policy ID;
- worker requirement/minima/exit rule;
- verifier requirement/minima/exit rule;
- revision.

`acceptingNew` is intentionally stored outside the immutable revision. Governance may stop or resume new acceptance without rewriting historical policy terms or commitments.

A new revision supersedes the prior revision for new acceptance but does not modify the old revision.

## Worker/verifier independence

Worker and verifier thresholds are evaluated independently.

A worker passing its minimum does not imply that a verifier passes. A verifier passing does not imply that a worker passes.

Optional roles are explicit: if a role is not required by a revision, absence of a position for that role is not itself a policy failure.

## Canonical authority boundary

CMP-1.5.3 establishes `ComputeStakeCollateralPolicy420` as the canonical minimum-collateral policy authority for CMP-1.5.

The older `ComputeWorkerStake420` contract already contains a retained worker-admission policy surface from earlier Compute work. That surface remains compatibility scaffolding only and is not the canonical CMP-1.5 policy authority going forward.

Migration/reconciliation of worker admission/source wiring to the canonical CMP-1.5 policy is owned by:

**CMP-1.5.9 — WorkerRegistry stake-source integration**

That later integration step must not reinterpret or duplicate the immutable CMP-1.5.3 policy revisions.

## Position evaluation

Worker evaluation uses `IComputeStakeSource420.PositionRead`.

A required worker position passes only when:

- position identity/revision are nonzero;
- position is active;
- active collateral is at least the revision minimum;
- slashable collateral is at least the revision minimum;
- exiting is false when the revision requires non-exiting collateral.

Verifier evaluation uses `IComputeVerifierStakeSource420.PositionRead`.

A required verifier position additionally requires:

- nonzero current verifier authority;
- nonzero verifier revision.

The policy evaluator does not determine whether the source itself is canonical. Source binding remains an integration responsibility so this contract cannot turn an arbitrary external balance source into authoritative collateral.

## Tests

`contracts/test/ComputeStakeCollateralPolicy420.t.sol` covers:

- governance-only publication and acceptance gating;
- invalid requirement/minimum combinations;
- exact active/slashable boundary behavior;
- worker/verifier independence;
- optional-role semantics;
- active-state enforcement;
- exit-state enforcement;
- verifier authority/revision presence;
- append-only revisions;
- immutable historical commitments;
- acceptance toggling without historical rewrite.

Mechanical verifier:

`scripts/verify-cmp-1-5-3-policy-minimum-collateral.py`

Machine-readable step record:

`contracts/config/compute-market/cmp-1.5.3-policy-minimum-collateral.json`

## Qualification level and milestone

CMP-1.5.3 is the first sensible **Level 2 CMP-1.5 integration milestone** because the three foundational collateral slices now converge:

1. CMP-1.5.1 — worker collateral;
2. CMP-1.5.2 — verifier collateral;
3. CMP-1.5.3 — shared minimum-collateral policy.

Level 1 remains targeted to affected build/tests/verifier.

Level 2 remains app-scoped and is satisfied by the retained `Compute*.t.sol` suite plus the cross-role policy tests. No repository-wide Level 3 inventory is required here.

## Exit criteria

CMP-1.5.3 is COMPLETE only when:

- one canonical versioned minimum-collateral policy exists;
- worker and verifier requirements/minima are independent and exact;
- invalid minima fail closed;
- historical revisions and commitments are immutable;
- new-acceptance gating does not rewrite history;
- worker/verifier position evaluators enforce the exact revision;
- the policy contract remains non-custodial and source-neutral;
- Level 1 tests/verifier pass on one exact implementation SHA;
- the first CMP-1.5 Level 2 retained app suite passes on that same SHA;
- durable evidence records the qualified implementation SHA.

Next canonical step:

**CMP-1.5.4 — Exit queue / withdrawal delay**
