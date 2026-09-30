# CMP-1.4.3 — Verification policy registry

Status: **IMPLEMENTATION COMPLETE; LEVEL 1 + LEVEL 2 QUALIFICATION PENDING. NO LIVE DEPLOYMENT/PUBLICATION CLAIM.**

## Canonical definition

> Bind jobs to exact versioned verification policies before execution.

## Repository baseline and gap analysis

Baseline current `main`: `6715d9fd3747953f298e79527fb9e86588db8d35`.

`ComputePolicyRegistry420` already provided append-only versioned `KIND_VERIFICATION` publication and immutable commitments. That satisfied publication semantics but not the roadmap requirement by itself: `ComputeJobRegistry420.assignWorker()` could previously enter `RUNNING` without proving that the accepted job had frozen an exact verification-policy revision/commitment.

CMP-1.4.3 therefore required an executable job-policy binding edge before execution.

## Implementation

`ComputePolicyRegistry420.isCurrentAcceptable` now checks exact current policy ID, revision, kind and commitment without conflating generic economic bounds with verification-policy identity.

`ComputeJobRegistry420` now supports a one-time deployment binding to the canonical Compute policy registry and stores on each job:

- `verificationPolicyId`
- `verificationPolicyRevision`
- `verificationPolicyCommitment`

For a CMP-1.4.3-qualified configuration:

1. the JobRegistry is bound once to the canonical `ComputePolicyRegistry420`;
2. after match acceptance and while the job is exactly `ACCEPTED`, the job owner binds an exact current accepting `KIND_VERIFICATION` policy revision/commitment;
3. binding increments the job revision;
4. `assignWorker` refuses to enter `RUNNING` until the exact policy tuple is frozen;
5. later policy publication or suspension does not rewrite the stored historical job policy.

Historical JobRegistry fixtures that never bind a policy registry remain source-compatible for retained legacy tests, but such unbound registries are explicitly **not CMP-1.4.3-qualified for new execution**.

## Authority separation

Policy publication/binding is not verifier identity, class/capability qualification, job appointment, independence, signed verdict, correctness, Vault custody, settlement, beneficiary selection, stake/slash, worker authority, governance substitution, validator, bridge or wallet authority.

## Security and invariant disposition

Preserved invariants include CMP-INV-005, 014, 016, 017, 020, 025, 026, 027 and 030. Exact policy binding is replay-safe through job revisioning; stale revisions fail closed. Historical accepted semantics remain reconstructable and non-AI workloads require no 420AI dependency.

No fixed Genesis predeploy, live deployment, ProtocolRegistry publication, Vault grant or settlement grant is introduced.

## Level 1 qualification

Required:

1. affected Compute contracts compile;
2. exact policy admission and pre-execution binding tests pass;
3. wrong commitment, suspended policy, unauthorized binder, stale revision and duplicate-binding paths fail closed;
4. mechanical CMP-1.4.3 verifier passes;
5. focused Solidity and Compute Market workflows pass on the exact implementation SHA.

## Level 2 milestone

CMP-1.4.3 closes the first verifier integration milestone: identity/lifecycle (1.4.1), classes/workload capabilities (1.4.2), and exact versioned verification policy (1.4.3).

Because the shared JobRegistry pre-execution guard changed, Level 2 requires the retained full Compute Market Solidity suite on the same exact implementation head. It does **not** require repository-wide Integrated/Geth/fault/soak/Genesis inventories unless independently triggered by changed authority/configuration surfaces.

## Exit criteria

CMP-1.4.3 is COMPLETE only when every criterion in the machine-readable evidence record is satisfied and exact-head Level 1 + Level 2 app-specific qualification is green.

## Completion

**NOT YET COMPLETE.** Implementation and evidence artifacts are present; exact-head Level 1 and Level 2 qualification remain pending.
