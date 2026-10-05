# CMP-3.6 — Execution lifecycle

Status: **COMPLETE — Level 1 + Level 2 exact-head qualified on `612d9e9401ab05b7d4864be751f942a8d384a162`.**

## Canonical definition

**Execution lifecycle.**

CMP-3.6 is the first worker-runtime convergence milestone. It composes:

- CMP-3.4 secure sandboxing;
- CMP-3.5 content-addressed work-unit download;
- canonical attempt authorization and finite execution leases;
- restart-safe local execution bookkeeping.

It does not redefine canonical job/attempt state. Protocol authority remains in the accepted ComputeMarket records and attempt registry.

## Canonical authority boundary

Before execution the worker must resolve one authoritative attempt authorization that binds:

- chain ID;
- authorization reference;
- job ID;
- unit ID;
- immutable root assignment;
- current attempt reference and nonzero attempt nonce;
- provider/node/resource/worker identity;
- manifest hash;
- accepted constraint commitment;
- input-access reference;
- exact work-unit SHA-256 and byte size;
- immutable sandbox image digest;
- command commitment;
- canonical deadline;
- finite lease expiry.

The worker never accepts these fields as caller authority. `CanonicalExecutionAuthority` resolves the canonical snapshot by authorization reference, and the lifecycle compares the resulting snapshot to local worker identity and execution inputs.

## Worker-local lifecycle

The local statuses are observational only:

- `prepared`;
- `running`;
- `exited`;
- `failed`;
- `cancelled`;
- `expired`;
- `interrupted`.

They are not replacements for canonical ComputeJob or attempt states and do not grant settlement or correctness authority.

A successful process exit means only that the sandboxed process exited successfully. It does not imply `RESULT_COMMITTED`, `VERIFIED`, payable entitlement or settlement.

## Execution flow

1. Resolve canonical authorization.
2. Validate exact worker/provider/node/resource/chain binding.
3. Validate exact artifact digest/size, sandbox image and command commitment.
4. Rehash the downloaded artifact immediately before execution.
5. Require canonical artifact location under worker private state.
6. Reject expired deadline/lease.
7. Persist `prepared`.
8. Persist `running`.
9. Execute only through CMP-3.4 `Sandbox.RunWithInput`.
10. Stream the verified work-unit bytes to container stdin without host mounts.
11. Persist one terminal local state.
12. Reject replay of that exact attempt.

Independent attempts may execute concurrently. Duplicate execution of the same attempt is serialized by the persisted attempt record and rejected.

## Sandbox input integration

CMP-3.4 is extended with `RunWithInput`.

The production `OSCommandRunner` passes the verified input stream directly to the container process stdin and adds Docker/Podman `--interactive` only when an input stream exists.

No host volume or device exposure is introduced.

## Restart recovery

Attempt records are private JSON files under:

`<stateDir>/attempts/<attemptRef>.json`

Records are:

- regular files only;
- private to the worker;
- filename-bound to the canonical attempt reference;
- atomically replaced through private temp files + fsync + rename + directory sync.

On worker startup, a prior `prepared` or `running` record is converted to `interrupted`.

The worker never silently reruns that attempt after restart. A subsequent execution requires a separately authorized canonical attempt, preserving the repository rule that retries do not fabricate a new payable unit or reuse an old nonce.

## Privacy boundary

Attempt records persist only execution metadata and transition codes.

They do not persist:

- raw work-unit bytes;
- raw sandbox stdout/stderr;
- source authorization tokens;
- private prompts/model data;
- wallet/validator/private keys.

## Failure paths

- expired authorization before start -> local `expired`;
- lease/deadline reached during execution -> local `expired`;
- caller cancellation -> local `cancelled`;
- sandbox failure -> local `failed`;
- worker restart while prepared/running -> local `interrupted`;
- successful sandbox exit -> local `exited`;
- duplicate finalized/interrupted attempt -> replay rejection;
- duplicate live attempt -> in-progress rejection.

No failure path mutates canonical protocol state by itself.

## Qualification evidence

- Implementation SHA: `612d9e9401ab05b7d4864be751f942a8d384a162`
- Level 1 — Compute Worker Fast Qualification **#115**
  - run ID: `37255444231`
  - job ID: `111591383323`
  - result: **SUCCESS**
- Level 2 — Compute Worker Integration Qualification **#5**
  - run ID: `37255444265`
  - job ID: `111591383281`
  - result: **SUCCESS**
- Durable evidence anchor: `27ea5df459f398ffa56ac4ecca864bf392b99262`
- Evidence record: [CMP-3.6 qualification evidence](CMP-3.6-QUALIFICATION-EVIDENCE.md)

## Qualification model

### Level 1

Required owner: **Compute Worker Fast Qualification**.

Level 1 covers targeted worker tests/build/vet, all retained CMP-3.1–3.5 regressions, and the CMP-3.6 mechanical verifier.

### Level 2 milestone

CMP-3.6 is the first meaningful worker-runtime convergence milestone because authorization, verified download and secure execution now compose.

Required owner: **Compute Worker Integration Qualification**.

That workflow builds real local scratch images and runs the full worker package with:

- real CMP-3.4 Docker isolation;
- real TLS content-addressed download;
- canonical lifecycle authorization;
- exact downloaded work-unit streaming into the real Docker sandbox;
- terminal lifecycle persistence;
- replay rejection.

Level 3 remains deferred to CMP-3.14.

## Exit criteria

CMP-3.6 is complete only when one exact implementation SHA proves:

1. canonical attempt authorization is resolved by reference, not caller-declared authority;
2. exact chain/provider/node/resource/worker identity is enforced;
3. job/unit/root assignment/attempt/nonzero nonce/manifest/constraint/input-policy fields are bound;
4. exact work-unit digest/size is revalidated immediately before execution;
5. exact immutable sandbox image and command commitment are enforced;
6. deadline and finite lease are required and fail closed;
7. no downloaded bytes execute outside CMP-3.4 sandbox;
8. verified input reaches the container without host mounts;
9. prepared/running/terminal local states are durably persisted;
10. local states are explicitly noncanonical/non-correctness/non-settlement evidence;
11. exact attempt replay cannot re-execute;
12. independent attempts are not globally serialized;
13. cancellation, failure, expiry and interruption are distinguishable;
14. restart converts prepared/running records to interrupted and never implicitly retries;
15. attempt records are private, filename-bound and contain no raw input/output;
16. CMP-3.1–3.5 regressions remain green;
17. Level 1 fast qualification passes exact head;
18. Level 2 worker integration qualification passes the same exact head.

## Deferred

- CMP-3.7 checkpointing/resume;
- CMP-3.8 result commitment;
- CMP-3.9 execution-key signed receipt;
- CMP-3.10 result/evidence upload;
- CMP-3.11 local resource controls;
- CMP-3.12 malicious workload protections;
- CMP-3.13 Windows/Linux/macOS packaging;
- CMP-3.14 Level 3 reconciliation/closeout.

Next canonical step: **CMP-3.7 — Checkpointing/resume**.
