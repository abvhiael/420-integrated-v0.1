# CMP-2.5 — Capacity-aware assignment

Status: **implementation / Level 1 qualification in progress.**

Canonical definition: **Consume CMP-1.3 capacity reservations atomically.**

## Architecture

CMP-2.5 does not create a second capacity ledger and does not rebind the CMP-1.3 controller. The canonical
`ComputeWorkerCapacityReservation420` remains controlled only by
`ComputeJobWorkerSnapshotEvidence420`.

`ComputeCapacityAwareAssignment420` bridges an immutable owner-accepted CMP-2 market match into the
existing JobRegistry match-evidence/runtime ABI. The job owner links the exact market match to the funded
job, records that match through JobRegistry, and confirms the job-level acceptance reference. Schedulers
retain proposal-only authority.

When a worker is finally admitted, the existing WorkerSnapshot path performs the security-critical atomic
boundary:

1. validate canonical accepted job, exact worker revision, admission policy and execution-key signature;
2. validate that the worker's resource/operator is exactly the resource/operator frozen by the CMP-2 match;
3. call `ComputeWorkerCapacityReservation420.reserve(...)`;
4. freeze the worker assignment;
5. call `ComputeJobRegistry420.assignWorker(...)`.

If reservation or downstream assignment fails, the EVM transaction reverts all assignment and capacity
state. No scheduler, adapter, or caller receives direct capacity-controller authority.

## Request-to-job evidence

`ComputeRequestRegistry420.validRequest(...)` now exposes a read-only JobRegistry-compatible proof for the
exact live CMP-2 request commitment and immutable request fields. It grants no debit, funding, matching,
assignment or scheduler authority.

## Assignment invariants

- one accepted market match may be linked to only one canonical job;
- only the canonical job owner can link and accept the market match into JobRegistry;
- market request, owner, immutable request commitment and job fields must match exactly;
- the historical accepted offer commitment, provider/node/resource/operator and resource revision must be
  reconstructable and still eligible when the job is linked or a worker is admitted;
- WorkerSnapshot remains the only capacity mutation authority;
- capacity exhaustion leaves the job ACCEPTED with no assignment or stranded reservation;
- direct scheduler capacity reservation fails closed;
- resource-revision drift blocks assignment before capacity mutation.

## Qualification

CMP-2.5 is an ordinary **Level 1** roadmap step. CMP-2.3 already supplied the current offers/requests/matching
Level 2 convergence milestone. CMP-2.5 adds no new shared custody or consensus authority and therefore does
not require a new Level 2 milestone. Level 3 remains reserved for **CMP-2.8 — Phase closeout**.

Required Level 1 evidence is the exact-head Compute Market Qualification plus the app-scoped Solidity
classification/compute-fast path, including the retained Compute Solidity suite, CMP-2.1 through CMP-2.5
verifiers, and affected SDK tests.
