# CMP-1.3.10 — Worker capacity reservation and concurrency semantics

Status: **IMPLEMENTED — exact-head qualification pending**

## Canonical definition

The controlling roadmap requires a narrowly scoped capacity reservation layer over canonical worker/resource identity without replacing `ComputeResourceRegistry420` ownership or 420Vault custody.

Required:

- worker/resource capacity-unit semantics;
- reservation IDs bound to accepted jobs and exact worker/resource revisions;
- concurrency limits and fail-closed exhausted-capacity admission;
- reserve/release/expire/fail transitions;
- replay/duplicate reservation protection;
- isolation so one job/worker/resource cannot consume another party's capacity entitlement;
- reconstructable historical reservations.

Exit: accepted work cannot overbook canonical worker capacity and all capacity transitions are deterministic and replay-safe.

## Repository baseline and gap analysis

Audited from the exact qualified CMP-1.3.9 closeout head `3aabe9a570855614f6d237ef6c237faf770f8c1b`, which was 0 commits behind current main `ac1b9c5a5d7e1b031ea63c210b8c38ac3abee6df`.

Before this step:

- `ComputeResourceRegistry420` explicitly provided advertised capacity only and stated that it was not a reservation or metering engine.
- `Resource.capacityUnits` was canonical advertised capacity but no live-consumption counter existed.
- `ComputeJobWorkerSnapshotEvidence420.acceptAssignment` could move accepted work to RUNNING without a capacity reservation.
- worker/resource revision snapshots already existed, but there was no reservation ID bound to them.
- no aggregate cross-revision counter prevented an old live reservation from being hidden by a resource/worker revision.
- no release/expire/fail reservation state machine or reservation history existed.
- no duplicate reservation or duplicate close protection existed.

## Capacity semantics

CMP-1.3.10 defines one accepted worker attempt as exactly **one concurrency unit**.

The exact historical `ComputeResourceRegistry420.Resource.capacityUnits` value bound to the admitted resource revision is the maximum concurrent live unit count for that resource/worker admission.

This deliberately avoids a caller-selected reservation quantity. A relayer, operator, scheduler, or execution key cannot understate resource consumption to bypass concurrency limits.

The reservation layer does not interpret GPU memory, FLOPs, CPU shares, metering, billing units, or payment amounts. Those remain separate protocol concerns.

## Implementation

### `ComputeWorkerCapacityReservation420`

New independent reservation/accounting authority:

- immutable canonical `ComputeWorkerRegistry420` and its `ComputeResourceRegistry420`;
- one-time controller binding;
- only the bound WorkerSnapshot controller can reserve or transition capacity;
- no ResourceRegistry mutation methods;
- no token, Vault, settlement, payment, beneficiary, verifier, or custody methods.

Reservation identity is deterministically derived from:

- reservation domain/version;
- chain ID;
- reservation contract address;
- accepted job ID;
- expected accepted-job revision;
- assignment reference;
- worker ID and exact worker revision;
- resource ID and exact resource revision;
- fixed concurrency unit value (1).

Every reservation stores:

- job and assignment identity;
- exact worker/resource revisions;
- expected accepted-job revision;
- accepted deadline;
- reserved/closed timestamps;
- capacity limit;
- transition evidence;
- status and history revision.

### Aggregate and isolated counters

Live accounting is maintained in four independent views:

- aggregate live resource units across all resource revisions;
- exact live resource-revision units;
- aggregate live worker units across all worker revisions;
- exact live worker-revision units.

Aggregate resource/worker counters prevent capacity from being recreated by later registry revisions.

Exact-revision counters preserve historical auditability and allow clients to prove which admitted revision consumed capacity.

A failed reserve or failed downstream canonical assignment reverts all counters because reservation and `JobRegistry.assignWorker` occur in one EVM transaction.

### WorkerSnapshot integration

`ComputeJobWorkerSnapshotEvidence420` now:

- holds the immutable capacity reservation engine;
- reserves one concurrency unit only after canonical accepted-job, worker, match, authorization, admission-policy, and execution-signature checks pass;
- creates the reservation before the canonical job becomes RUNNING;
- stores the reservation ID in the immutable assignment record;
- relies on transaction atomicity so a downstream assignment failure cannot strand capacity.

### Deterministic terminal synchronization

`syncCapacity(jobId)` is permissionless to relay, but only WorkerSnapshot can mutate the capacity engine.

Canonical job state determines the only valid transition:

- RESULT_COMMITTED / VERIFIED / SETTLED / DISPUTED / REFUNDED -> RELEASED;
- FAILED -> FAILED;
- EXPIRED or a RUNNING job past its canonical deadline -> EXPIRED.

The reservation engine independently enforces its stored deadline for EXPIRED.

A second transition from a terminal reservation fails closed; counters cannot decrement twice.

## Security and authority boundaries

CMP-1.3.10 does not:

- transfer ResourceRegistry ownership;
- change provider/node/resource ancestry;
- create hardware truth or metering proof;
- custody or reserve 420Vault funds;
- authorize spending, refunds, settlement, verification, governance, bridge, validator, or wallet activity;
- allow a relayer to choose a lower reservation quantity;
- allow worker/resource revisions to reset aggregate live capacity.

Execution-key signatures remain authentication evidence from CMP-1.3.9 and do not become capacity administration authority.

## Test and adversarial coverage

The retained WorkerSnapshot suite now covers:

- reservation ID reconstruction from exact accepted identities/revisions;
- fixed one-unit semantics and historical resource capacity limit;
- resource and worker aggregate counters;
- exact worker/resource revision counters;
- successful concurrency up to the canonical limit;
- rejection of the next concurrent accepted job when capacity is exhausted;
- atomic failure: rejected admission leaves the job ACCEPTED with no assignment, reservation, or counter mutation;
- two worker identities sharing one resource while retaining isolated worker counters;
- cross-revision aggregate protection when resource capacity is reduced while an older reservation is still live;
- deterministic result-completion release;
- deadline expiry;
- verification-failure transition;
- duplicate release/expiry rejection;
- controller-only reservation mutation;
- current reservation plus revision-1/revision-2 history reconstruction;
- all retained CMP-1.3 worker admission/signing tests.

## Frozen invariant mapping

Directly strengthened:

- **CMP-INV-002/003** — worker/resource/job identities and exact revisions remain distinct and bound.
- **CMP-INV-004/005** — capacity authority cannot become custody, settlement, governance, bridge, validator, or arbitrary wallet authority.
- **CMP-INV-008** — accepted capacity identity/revisions cannot silently change after assignment.
- **CMP-INV-012/013** — terminal capacity transitions are one-way and cannot reopen or double-decrement.
- **CMP-INV-014** — duplicate/replay operations fail closed.
- **CMP-INV-018/019** — concurrent accepted work cannot exceed canonical live capacity.
- **CMP-INV-020** — later worker/resource revisions preserve existing reservation evidence rather than erasing it.
- **CMP-INV-026** — reservation identity/state/history are independently reconstructable.
- **CMP-INV-028/029** — worker/resource revision changes do not rewrite historical capacity commitments.

## Canonical wiring

`ComputeWorkerCanonicalWiring420` now includes:

- capacity runtime code hash;
- exact capacity contract address;
- capacity -> WorkerRegistry relationship;
- capacity -> ResourceRegistry relationship;
- capacity controller == canonical WorkerSnapshot relationship.

The historical CMP-1.3.7 deployment hash package remains historical. Final release-candidate runtime/hash/publication refresh remains assigned to CMP-1.3.15; this step does not fabricate deployment or ProtocolRegistry evidence.

## Qualification requirements

Before COMPLETE, the exact final head must pass:

- Solidity Contracts with all required PR shards;
- 420 Integrated Qualification;
- 420Docs Qualification;
- all new capacity/concurrency tests;
- all retained WorkerRegistry/WorkerSnapshot/canonical-wiring regressions;
- exact-current-main divergence/reconciliation check.

After candidate CI passes, candidate SHA/run IDs must be recorded in this file. That evidence-recording commit becomes a new exact head and must itself pass the retained suite before COMPLETE.

## Candidate qualification evidence

Reconciled candidate SHA: `791303dd0e3a784c5ad533f733479acb7646f11d`.

Exact-head qualification on that candidate:

- 420Docs Qualification #3278 — **SUCCESS**, run ID `36510674289`.
- 420 Integrated Qualification #5898 — **SUCCESS**, run ID `36510674286`.
- Solidity Contracts #3268 — **SUCCESS**, run ID `36510675104`, all 16/16 `pr-shards` successful; aggregate `foundry` wrapper skipped by workflow design and not counted as a passing gate.

The reconciled candidate was based on main `d99f8a9c5b10d0007a5729ea46802bb58f5b0d56`, was 0 commits behind that base, and the 21 CMP files were verified byte-for-byte identical to the original CMP-1.3.10 branch by Git blob SHA.

After these runs completed, repository `main` advanced again. Therefore these results qualify only `791303dd0e3a784c5ad533f733479acb7646f11d`; final completion requires carrying this evidence head onto current main and rerunning the retained suite on that exact reconciled evidence SHA.

## Completion

**NOT YET COMPLETE** — candidate CI is green, but final current-main reconciliation and exact-head evidence requalification remain required.
