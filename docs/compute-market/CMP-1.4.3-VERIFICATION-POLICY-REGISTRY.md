# CMP-1.4.3 — Verification policy registry

Status: **COMPLETE. LEVEL 1 + LEVEL 2 EXACT-HEAD QUALIFICATION GREEN. NO LIVE DEPLOYMENT/PUBLICATION CLAIM.**

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

**COMPLETE.** Exact implementation head `081d2ddab30747ca3a0ba0e6cf90d8b26432d554` passed the required Level 1 and documented Level 2 app-specific integration qualification.

Required results on the exact implementation SHA:

- Compute Market Qualification #11 — run `36787265122` — **success**. This is the Level 2 retained Compute Market integration suite and includes the CMP-1.4.0–1.4.3 mechanical verifiers.
- Solidity Contracts #3442 — run `36787265123` — **success** using the Compute-only focused path; monolithic repository Foundry shards were skipped.

Additional triggered retained checks on the same implementation SHA:

- Genesis Address Authority #267 — run `36787265102` — success
- 420Docs Qualification #3525 — run `36787265097` — success
- 420Indexer #1067 — run `36787265323` — success
- 420Registry REG-AUDIT-4 #102 — run `36787265214` — success

The immediately preceding implementation head `0b08e9d54cf0dc7f7f5060cc5c8f08d5d04028b2` failed Compute Market Qualification #10 only in the new test fixture: Foundry's one-shot `vm.prank(GOV)` was consumed by the external `KIND_VERIFICATION()` getter before `publish()`. Production authorization correctly rejected the resulting non-governance call. Commit `081d2ddab30747ca3a0ba0e6cf90d8b26432d554` fixes the fixture by resolving the kind before applying the prank; no production authorization or test requirement was weakened.

Level 2 milestone status: **SATISFIED** for CMP-1.4.1 identity/lifecycle + CMP-1.4.2 classes/capabilities + CMP-1.4.3 policy binding.

Level 3 remains intentionally deferred to complete Compute Market phase closeout.

This completion update is evidence-only and references the already-qualified implementation SHA above; it changes no executable code, tests, workflows, dependencies, configuration, interfaces, deployment state, or substantive requirement.
