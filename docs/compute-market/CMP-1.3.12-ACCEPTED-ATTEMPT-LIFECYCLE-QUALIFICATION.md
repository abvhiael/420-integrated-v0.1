# CMP-1.3.12 — Accepted-job worker invariant hardening and attempt lifecycle

Status: **COMPLETE — implementation SHA qualified; evidence-only closeout recorded without recursive rerun.**

## Canonical definition

The controlling roadmap defines CMP-1.3.12 as:

> Extend the immutable worker snapshot into a complete accepted-attempt lifecycle.

Required:

- exact attempt identity and transition rules;
- frozen worker/resource/execution-key/capability/Trust/stake context;
- integration with capacity reservation consumption and release;
- deterministic retry/failure/cancellation/expiry behavior;
- no retry may broaden accepted match constraints;
- later worker/resource/key/policy changes may block new admission but cannot rewrite historical accepted work or confiscate valid earned settlement.

Exit:

> accepted work remains reconstructable across success, failure, retry, cancellation, and expiry without identity or authority drift.

## Authoritative baseline

Implementation began from current `main`:

`a07e5d018160078ab5f60b3feff9f426bc0c77b0`

This base includes merged CMP-1.3.11.

Repository evidence inspected before modification included:

- `docs/compute-market/CMP-1-IMPLEMENTATION-ROADMAP.md`;
- `docs/420-COMPUTE-MARKET-V1-ARCHITECTURE.md`;
- `docs/compute-market/CMP-1.3.8-1.3.16-WORKER-REGISTRY-GAP-AUDIT.md`;
- CMP-1.3.6, CMP-1.3.9, CMP-1.3.10, and CMP-1.3.11 qualification records;
- `ComputeJobRegistry420`;
- `ComputeJobWorkerSnapshotEvidence420`;
- `ComputeWorkerCapacityReservation420`;
- retained WorkerSnapshot/capacity/signing tests.

## Pre-change gap analysis

Valid retained work already satisfied substantial parts of the step:

- the initial accepted assignment froze exact worker/resource/execution-key/capability/Trust/stake context;
- assignment/result signatures were chain/contract/job/worker/revision/attempt domain separated;
- one accepted first attempt consumed one capacity unit;
- later worker/resource/key/policy mutation could not rewrite the first accepted snapshot;
- canonical JobRegistry prevented arbitrary lifecycle mutation and terminal reopening.

The remaining CMP-1.3.12 gaps were blocking:

1. **Attempt identity was effectively hard-coded to attempt 1.**
   `assignmentForJob` allowed only one assignment and no later attempt identity could exist.

2. **No accepted-attempt state machine existed.**
   There were no explicit ACTIVE / RESULT_COMMITTED / FAILED / CANCELLED / EXPIRED attempt states or one-way transition evidence.

3. **No retry path existed.**
   An execution attempt could not fail or be cancelled and release capacity for a deterministic retry while the canonical job remained RUNNING.

4. **Capacity could not be reused sequentially by the same job.**
   `reservationForJob` permanently blocked a second reservation even after the first reservation reached a terminal state.

5. **RUNNING deadline expiry could release capacity without canonically expiring the job.**
   That could leave a RUNNING job stranded after its active attempt was expired.

6. **Retry constraint preservation was unproven.**
   There was no immutable accepted-constraint commitment tying retries to the original request/funding/match/acceptance/deadline context.

7. **Retry admission policy requirements could potentially be silently weakened if a future retry mechanism accepted arbitrary refs.**

8. **A timely committed result had no explicit attempt terminal state or committed-at timestamp.**
   This made it difficult to prove that later failure/cancellation/expiry could not confiscate already-valid work.

## Implementation

### Attempt state and identity

`ComputeJobWorkerSnapshotEvidence420` now defines:

- `AttemptStatus.NONE`
- `AttemptStatus.ACTIVE`
- `AttemptStatus.RESULT_COMMITTED`
- `AttemptStatus.FAILED`
- `AttemptStatus.CANCELLED`
- `AttemptStatus.EXPIRED`

Each assignment/attempt now records:

- immutable canonical job/match/acceptance identity;
- exact worker/resource revisions;
- frozen operator and execution signer/key commitment;
- frozen capability profile and jurisdiction commitment;
- frozen capability/Trust/stake admission references;
- snapshot commitment;
- capacity reservation ID;
- immutable lifecycle root assignment;
- previous attempt reference;
- accepted-constraint commitment;
- exact monotonic attempt number;
- accepted deadline;
- opened/closed/result-committed timestamps;
- transition reference;
- attempt status;
- result/receipt commitments.

`rootAssignmentForJob` permanently identifies the first assignment bound into `ComputeJobRegistry420`.

`assignmentForJob` identifies the latest attempt.

`attemptCount` provides a monotonic exact attempt number.

A retry cannot overwrite or recycle an earlier attempt ID.

### Accepted-constraint commitment

`ACCEPTED_CONSTRAINT_DOMAIN_V1` commits the retry-invariant accepted context:

- chain and WorkerSnapshot contract;
- job ID and owner;
- request ID and request commitment;
- manifest/workload/input/output-schema commitments;
- funding reference;
- accepted match ID;
- acceptance reference;
- canonical deadline.

Every retry must reconstruct the same accepted-constraint commitment as the root assignment.

Retry admission also requires the same accepted resource ID and canonical operator as the root assignment, even if replaceable off-chain/match infrastructure changes later.

This directly prevents a retry from broadening the originally accepted match/resource constraints.

### Retry admission

`retryAssignment` is allowed only when:

- a root assignment exists;
- the immediately prior attempt is FAILED or CANCELLED;
- the prior capacity reservation is no longer live;
- the canonical job remains RUNNING;
- the exact expected job revision matches;
- the JobRegistry assignment still equals the immutable root assignment;
- the deadline has not passed;
- the accepted-constraint commitment still matches;
- capability/Trust/stake **policy IDs** match the root policy requirements;
- current worker/resource eligibility and accepted match authorization pass;
- current capability/Trust/stake references pass live admission;
- the worker resource/operator do not broaden the root accepted resource/operator;
- a valid execution-key signature binds the exact next attempt.

A retry may use refreshed evidence references under the same policy requirements. It may not silently drop a policy requirement.

Later worker/resource/key/policy changes may therefore block a retry as new admission while leaving earlier attempts unchanged.

### Attempt failure and cancellation

`failAttempt` and `cancelAttempt`:

- operate only on the latest ACTIVE attempt;
- require the canonical job to remain RUNNING under the immutable root assignment;
- require the frozen operator's scoped execute-attempt authorization;
- require a frozen execution-key signature over a domain-separated attempt transition digest;
- reject replay and duplicate terminal transitions;
- close the attempt exactly once.

FAILED marks its capacity reservation FAILED.

CANCELLED releases its capacity reservation.

Attempt-level cancellation is **not** canonical JobRegistry cancellation and does not create refund authority. The canonical job remains RUNNING so a policy-preserving retry may follow.

### Expiry

An ACTIVE attempt can expire only after the accepted deadline.

Both:

- `expireAttempt`; and
- the retained permissionless `syncCapacity` deadline path

atomically:

1. expire the live capacity reservation;
2. call the bound `ComputeJobRegistry420.recordRunningExpiry`;
3. transition the canonical RUNNING job to EXPIRED;
4. mark the attempt EXPIRED with durable transition evidence.

This prevents capacity release from leaving the canonical job stranded in RUNNING.

EXPIRED attempts/jobs cannot retry.

### Timely result protection

A result may be committed only while the active attempt is ACTIVE and no later than its frozen accepted deadline.

Result commitment marks the attempt RESULT_COMMITTED and stores `resultCommittedAt`.

Once RESULT_COMMITTED:

- failure is blocked;
- cancellation is blocked;
- expiry is blocked;
- retry is blocked.

`ComputeJobRegistry420.recordResult` now relies on the bound worker-evidence adapter to prove that the result commitment was timely rather than rechecking the current wall-clock deadline.

That means a result validly committed before the deadline may be relayed into canonical JobRegistry state after the deadline without reopening late execution.

This preserves valid already-earned work while still rejecting new execution after the accepted deadline.

### Sequential capacity reservations

`ComputeWorkerCapacityReservation420` still permits at most one live reservation for a job at a time.

A new reservation is allowed only when the previously indexed reservation for that job is terminal.

Each retry has a distinct assignment reference, attempt number, expected job revision, worker/resource revision, and therefore a distinct reservation ID.

Historical reservations remain independently readable.

## Authority boundaries

CMP-1.3.12 does not:

- create a generic job-state setter;
- allow retry to alter request/match/economic constraints;
- make execution signatures correctness proofs;
- grant settlement, verifier, Vault, governance, bridge, validator, wallet, or stake/slash authority;
- let attempt cancellation trigger canonical refund;
- let a relayer become worker/operator identity;
- let current WorkerRegistry state rewrite a historical attempt.

Canonical JobRegistry remains the job lifecycle authority.

Verification remains the correctness authority.

Settlement/refund adapters remain the economic authority.

Capacity remains concurrency accounting only.

## Adversarial and regression coverage

New/retained tests cover:

- immutable root assignment and monotonic attempt numbers;
- exact predecessor linkage and reconstructable retry history;
- signed failure transition;
- signed cancellation transition;
- wrong execution-key transition rejection;
- duplicate/terminal transition rejection;
- capacity release/failure on attempt close;
- sequential capacity reservation reuse without concurrent double-booking;
- policy requirement preservation across retry;
- live policy rejection blocking retry without rewriting failed history;
- accepted-constraint preservation across retry;
- canonical root assignment remaining unchanged across retries;
- running deadline expiry transitioning both attempt and canonical job to EXPIRED;
- expiry releasing capacity exactly once;
- expired job retry rejection;
- timely result commitment becoming RESULT_COMMITTED;
- RESULT_COMMITTED attempt rejecting cancellation/expiry;
- timely result remaining recordable after wall-clock deadline;
- result capacity release after canonical result recording;
- all retained CMP-1.3.6/1.3.9/1.3.10 admission, signing, capacity, mutation, and historical-reconstruction regressions.

## Frozen invariant mapping

Directly strengthened:

- **CMP-INV-002/003** — job/root/attempt/worker/resource identities remain distinct and stable.
- **CMP-INV-005** — attempt authority grants no custody/governance/validator/bridge/wallet authority.
- **CMP-INV-007/008** — retry cannot broaden accepted request/match/resource constraints.
- **CMP-INV-012** — there is no generic administrator attempt/job state setter.
- **CMP-INV-013** — terminal attempts cannot reopen; canonical terminal job rules remain intact.
- **CMP-INV-014** — attempt acceptance/result/failure/cancellation signatures are domain-separated and replay-safe.
- **CMP-INV-016** — attempt/result signatures remain claims, not correctness proofs.
- **CMP-INV-018/019** — sequential retries cannot create concurrent duplicate capacity entitlement or consume another job's reservation.
- **CMP-INV-020** — later worker/resource/key/policy changes cannot rewrite historical accepted work or confiscate a timely committed result.
- **CMP-INV-023** — Trust remains admission evidence, not lifecycle/custody/settlement authority.
- **CMP-INV-026** — accepted work is reconstructable across attempt success/failure/retry/cancellation/expiry.
- **CMP-INV-028/029** — later resource/profile/key/manifest changes cannot broaden or rewrite accepted attempt semantics.
- **CMP-INV-030** — lifecycle semantics remain general-purpose and do not require 420AI.

## Deployment/publication boundary

This step changes runtime bytecode for:

- `ComputeJobWorkerSnapshotEvidence420`;
- `ComputeWorkerCapacityReservation420`;
- `ComputeJobRegistry420`.

The historical CMP-1.3.7 deployment package remains historical evidence.

The canonical roadmap assigns final release-candidate code-hash, deployment-descriptor, ProtocolRegistry publication, and live dependency reconciliation to CMP-1.3.15. This step does not fabricate live addresses, transactions, blocks, code hashes, or publication evidence.

## Qualification gate

Before COMPLETE, the exact qualification-relevant implementation SHA must pass:

- Solidity Contracts, all required PR shards;
- 420 Integrated Qualification;
- 420Docs Qualification;
- new accepted-attempt lifecycle/adversarial tests;
- retained JobRegistry, WorkerRegistry, WorkerSnapshot, execution-signing, capacity, canonical-wiring, settlement/refund regressions;
- current-main divergence/reconciliation review.

Per the repository qualification evidence rule, a later documentation-only evidence commit may record the qualified implementation SHA and workflow run IDs without recursively rerunning the full suite. Any qualification-affecting reconciliation or implementation/test/config/workflow/dependency change requires fresh exact-head qualification.

## Qualified implementation evidence

Qualified implementation SHA:

`844e5141e7763e92c68aa7b459f466bc887f4fd8`

Base/main SHA used for qualification:

`a07e5d018160078ab5f60b3feff9f426bc0c77b0`

Exact-SHA qualification:

- Solidity Contracts #3336 — run `36619855394` — **SUCCESS**, all 16 required PR shards passed; aggregate `foundry` wrapper skipped by workflow design;
- 420 Integrated Qualification #5973 — run `36619855495` — **SUCCESS**;
- 420Docs Qualification #3349 — run `36619855470` — **SUCCESS**.

The qualification-relevant implementation SHA above is exactly the PR #405 head that passed the retained suite. The documentation-only evidence commit containing this section does not change contracts, tests, configuration, workflows, dependencies, or substantive CMP-1.3.12 requirements and therefore inherits that implementation qualification under the repository evidence-only rule.

## Completion

**COMPLETE** — every canonical CMP-1.3.12 requirement and exit criterion is implemented and repository-qualified at implementation SHA `844e5141e7763e92c68aa7b459f466bc887f4fd8`. Accepted work is reconstructable across success, failure, retry, cancellation, and expiry without identity or authority drift. Release-candidate code-hash/publication refresh remains correctly deferred to CMP-1.3.15.
