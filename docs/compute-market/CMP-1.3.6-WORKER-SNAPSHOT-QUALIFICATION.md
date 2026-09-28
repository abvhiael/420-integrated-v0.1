# CMP-1.3.6 — accepted-job worker execution snapshot integration

Status: **IMPLEMENTATION COMPLETE; exact-head repository qualification required before COMPLETE.**

CMP-1.3.6 closes the historical-identity gap between the accepted ComputeMarket resource/match path and the canonical worker registry.

The pre-existing `ComputeJobMatchedWorkerEvidence420` binds an accepted resource and operator, but it does not freeze a canonical worker ID, exact worker revision, execution-key commitment, capability commitment, or worker policy references. CMP-1.3.6 adds a stricter drop-in job worker-evidence adapter for qualified WorkerRegistry deployments without rewriting earlier CMP-1.1/CMP-1.2 evidence contracts.

## Scope

This step adds `ComputeJobWorkerSnapshotEvidence420`.

At worker assignment it requires:

- the job is already in canonical `ACCEPTED` state;
- the exact worker revision is currently eligible;
- the worker operator is the caller;
- the worker's exact canonical resource is the resource authorized by the accepted match;
- the operator holds scoped execute-attempt authorization;
- any supplied capability-attestation policy/reference pair passes the CMP-1.3.2-style admission interface;
- any supplied 420Trust policy/reference pair passes the CMP-1.3.4-style admission interface;
- any supplied compute-stake policy/reference pair passes the CMP-1.3.5-style admission interface.

The assignment then freezes:

- job/match/acceptance identifiers;
- worker ID and exact worker revision;
- provider/node/resource IDs;
- exact resource revision;
- operator;
- execution signer and execution-key commitment;
- capability-profile commitment;
- jurisdiction commitment;
- capability-attestation policy/reference;
- reputation policy/reference;
- compute-stake policy/reference;
- a domain-separated immutable snapshot commitment.

## Historical semantics

Admission predicates are live **before** assignment.

After the job enters `RUNNING`, its frozen assignment snapshot is historical execution identity. Later worker profile/key changes, suspension, resource suspension, or policy evolution cannot rewrite that accepted snapshot or strand result commitment for work that was already admitted.

This distinction is intentional:

- new work always consumes current worker/resource/policy state;
- accepted running work consumes the immutable admission snapshot;
- later suspension blocks new admission but does not erase historical identity or automatically confiscate earned settlement.

Result commitment includes the frozen snapshot commitment and worker execution-key commitment.

## No correctness or settlement authority

A frozen worker snapshot proves which execution identity and admission context were accepted. It does **not** prove:

- external hardware truth beyond the referenced attestation policy;
- output correctness;
- verifier approval;
- metering accuracy;
- settlement entitlement;
- slashing outcome.

Those remain separate protocol authorities.

## Replay and mutation protection

CMP-1.3.6 enforces:

- one assignment per job;
- exact job revision on assignment;
- exact worker revision on assignment;
- exact accepted resource/operator match;
- complete policy/reference pairs;
- one result commitment per assignment;
- scoped execute and submit-receipt authorization;
- immutable historical assignment state.

Rejected attempts leave job and assignment state unchanged.

## Qualification tests

`contracts/test/ComputeJobWorkerSnapshotEvidence420.t.sol` covers:

1. accepted assignment freezes exact worker/resource/execution identity;
2. capability, Trust, and stake references are frozen into the snapshot;
3. policy admission failure blocks assignment without mutation;
4. incomplete policy/reference pairs fail closed;
5. stale/future worker revisions fail;
6. unavailable resource/parent state fails new assignment;
7. worker profile changes cannot rewrite the accepted snapshot;
8. later worker/resource suspension does not strand an already-running job result;
9. duplicate assignment replay fails;
10. duplicate result commitment replay fails;
11. submit-receipt authorization revocation blocks new result submission.

## Invariant mapping

CMP-1.3.6 advances:

- CMP-INV-002/003 — accepted work binds stable worker identity and exact revision;
- CMP-INV-005 — assignment grants no unrelated authority;
- CMP-INV-007/008 — worker selection cannot broaden accepted resource constraints;
- CMP-INV-019 — one worker/revision cannot consume another assignment;
- CMP-INV-020 — post-admission suspension cannot rewrite historical execution identity or automatically confiscate settlement;
- CMP-INV-021/022 — stake references remain subordinate to the defined CMP-1.5 path;
- CMP-INV-023 — Trust evidence remains evidence, not authority;
- CMP-INV-026 — accepted execution identity is reconstructable;
- CMP-INV-028/029 — later key/capability/resource changes cannot silently alter accepted semantics;
- CMP-INV-030 — worker snapshots are general-purpose and provider-neutral.

## Deployment boundary

This contract is a stricter worker-evidence adapter for deployments that activate canonical WorkerRegistry semantics.

CMP-1.3.6 does not silently replace already-qualified earlier evidence contracts on `main`. Deployment must explicitly bind `ComputeJobRegistry420.workerEvidence` to this adapter and verify all parent addresses/code hashes.

## Deferred boundary

After CMP-1.3.6, the remaining CMP-1.3 work is deployment/publication qualification: deployed addresses, bytecode/code-hash verification, exact parent/admission adapters, ProtocolRegistry publication, and live configuration evidence.

## Completion gate

CMP-1.3.6 is complete only after the exact candidate head passes:

- Solidity Contracts qualification, all required shards;
- 420 Integrated Qualification;
- 420Docs Qualification.

The exact candidate SHA and run evidence must then be recorded, followed by retained exact-head qualification of the evidence-recording head before final closeout.
