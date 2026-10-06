# CMP-4.5 — Reproducible execution environments

Status: **IMPLEMENTED — LEVEL 1 EXACT-HEAD QUALIFICATION PENDING.**

CMP-4.5 makes the scientific execution environment behind CMP-4.1 `executableContainerCommitment` canonical and revisioned without creating a second worker runtime. CMP-0.4 remains signed-manifest authority; CMP-3 remains execution/sandbox authority.

## Canonical responsibility

`ComputeExecutionEnvironmentRegistry420` owns project-scoped execution-environment identity and append-only revisions. Each revision binds the immutable executable/container artifact, runtime profile, dependency lock, command specification, target platform, sandbox profile, reproducibility policy, exact CMP-4.2 project revision, predecessor commitment and active state.

It does not launch workloads, retrieve artifacts, grant dataset access, choose workers/verifiers, prove correctness, hold funds, settle jobs, slash stake or override accepted job policy.

## Identity and commitment

`environmentId = keccak256(abi.encode(ENVIRONMENT_DOMAIN, block.chainid, address(registry), projectId, controller, nonce))`

with `ENVIRONMENT_DOMAIN = keccak256("420/COMPUTE/EXECUTION_ENVIRONMENT/V1")`.

All semantic commitments are nonzero. Mutable image tags, floating dependency ranges, host-local paths, ambient state, timestamps, secrets, credentials and transport URLs are not canonical environment identity.

## CMP-0.4 / CMP-3 correspondence

CMP-0.4 already freezes runtime profile/version, exact executable digest, canonical command spec, resource/security policy and exact bytes before launch. CMP-4.5 does not replace it. The worker still retrieves and verifies exact content-addressed bytes, rejects mutable images, enforces the CMP-3 sandbox/resource/malicious-workload controls, and verifies assignment/job policy.

A valid environment commitment is reconstructable configuration identity only; it does not prove that execution occurred or that results are correct.

## CMP-4.1 integration

For scientific work:

`executableContainerCommitment == exact current environment revision commitment`.

Before admitting new work:

`isCurrentReproducible(environmentId, revision, executableContainerCommitment)`

must succeed. The environment must be active, revision-exact, commitment-exact and still bound to the current CMP-4.2 project revision accepting new work. Historical units retain their frozen commitment.

## Mutation and lifecycle

Only the current project owner/controller may register or mutate. Mutations require the exact current revision; history is append-only and predecessor-linked. Any artifact/runtime/dependency/command/platform/sandbox/reproducibility change creates a new revision. Project drift requires explicit refresh. Deactivation is always allowed; reactivation requires the bound project revision to remain current and accepting. No-op revisions/activation fail.

## Reproducibility boundary

Reproducible means the accepted environment can be reconstructed from immutable/versioned committed semantics. It does not promise bit-for-bit identical scientific outputs across hardware, drivers, floating-point implementations or nondeterministic algorithms. The reproducibility policy commits the accepted determinism/tolerance model where relevant. Result correctness remains CMP-1.4/CMP-4.6.

Secrets/private environment values stay outside canonical state and use independently authorized secure channels.

## Security / negative cases

Fail closed on zero environment commitments, stale/invalid projects, outsider mutation, stale revisions, cross-environment replay, project pause/retirement, environment deactivation, no-op mutation, and any attempt to treat environment identity as job authorization, execution evidence, correctness evidence, dataset access or payment authority.

## Qualification boundary

CMP-4.5 is Level 1. Required: affected Compute build, dedicated environment tests, retained CMP-4.1–4.4 verifier compatibility, CMP-4.5 verifier, and exact-head Compute Market Qualification. No worker code changes, so Worker Fast is not a new CMP-4.5 owner. Level 2 remains deferred; Level 3 remains CMP-4.10.

## Intentionally deferred

CMP-4.6 result provenance; CMP-4.7 scientific metadata/lineage; CMP-4.8 publication/retention; CMP-4.9 dashboard; CMP-4.10 Level 3 closeout; CMP-7 SDK/API/indexer; CMP-8 UI; CMP-9.13 live scientific demonstration.

## Next canonical step

**CMP-4.6 — Result provenance**
