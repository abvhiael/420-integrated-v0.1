# CMP-3.7 — Checkpointing/resume

Status: **COMPLETE — Level 1 exact-head qualified on `c438a029a652fdeed42ef94b877e50b804842689`.**

## Canonical definition

**Checkpointing/resume.**

The canonical roadmap names checkpointing/resume without redefining the frozen ComputeMarket attempt model. CMP-3.7 therefore extends the already-qualified CMP-3.6 worker lifecycle with worker-local, non-authoritative checkpoint persistence and explicit resume of the **same still-authorized canonical attempt**.

A checkpoint never creates a new payable unit, new attempt, result commitment, verification decision, receipt, payment entitlement, or settlement authority.

## Controlling protocol boundary

The frozen lifecycle and worker architecture require:

- one canonical job/attempt authority;
- finite recoverable attempt leases;
- retries/replacements to use separately authorized attempts;
- no silent reopening of terminal canonical work;
- immutable work-unit/artifact identity;
- sandbox-only customer execution;
- no correctness claim from process exit or worker-local evidence.

CMP-3.7 preserves those rules.

Resume is allowed only when:

1. CMP-3.6 has a local `interrupted` record for the same attempt;
2. the canonical authorization is resolved again by reference;
3. the same chain/provider/node/resource/worker/job/unit/root-assignment/attempt/nonce bindings remain valid;
4. deadline and lease remain live;
5. the exact CMP-3.5 work unit rehashes successfully;
6. the latest checkpoint rehashes successfully and remains bound to that authorization/attempt/work-unit identity;
7. execution re-enters through the CMP-3.4 sandbox.

A completed, failed, cancelled, expired, prepared, resuming, or running local attempt cannot be reopened through resume.

## Checkpoint persistence

`compute/worker/checkpoint.go` adds private worker checkpoint storage under:

`<stateDir>/checkpoints/<attemptRef>/`

For each canonical attempt:

- the first checkpoint sequence is exactly 1;
- each subsequent sequence advances exactly by 1;
- duplicate or stale sequence replay is rejected;
- checkpoint payload size is positive and bounded;
- payload bytes are streamed to a private temporary file;
- SHA-256 is computed while writing;
- payload and metadata are persisted with private permissions;
- metadata is bound to exact authorization/attempt/work-unit state;
- `latest.json` identifies the latest completed checkpoint;
- symlink/non-regular/private-mode violations fail closed;
- payload bytes are rehashed before every load/resume.

## Checkpoint commitment

Each checkpoint records:

- schema version;
- authorization reference;
- exact authorization commitment;
- attempt reference and nonce;
- work-unit SHA-256;
- monotonic checkpoint sequence;
- checkpoint payload SHA-256;
- payload size;
- creation time;
- deterministic checkpoint commitment.

The checkpoint commitment is a local content/provenance commitment only. It is **not** CMP-3.8 result commitment or CMP-3.9 signed receipt evidence.

## Resume input framing

CMP-3.7 defines versioned resume framing with magic:

`CMP420R1`

The sandbox receives:

1. resume magic;
2. big-endian work-unit byte length;
3. big-endian checkpoint byte length;
4. exact reverified work-unit bytes;
5. exact reverified checkpoint bytes.

The frame has explicit size bounds and rejects truncation or trailing bytes.

This gives checkpoint-aware worker images a deterministic resume contract without adding host mounts, devices, privileged execution, or arbitrary environment injection.

## Lifecycle integration

CMP-3.6 gains local observational state:

- `resuming`.

Resume flow:

1. resolve canonical authorization again;
2. validate execution plan against the canonical snapshot;
3. require existing local state `interrupted`;
4. reject terminal/live-state reopening;
5. revalidate deadline and lease;
6. rehash exact work unit;
7. load and rehash latest checkpoint;
8. verify checkpoint attempt/nonce/work-unit bindings;
9. persist `resuming`;
10. persist `running`;
11. execute through `Sandbox.RunWithInput`;
12. persist one terminal local state.

If the worker crashes while `resuming` or `running`, startup recovery returns the record to `interrupted`.

Resume never happens automatically on startup.

## Security/adversarial requirements

CMP-3.7 must fail closed for:

- missing canonical authority;
- wrong worker ancestry/identity;
- wrong or changed attempt ref/nonce;
- expired deadline or lease;
- checkpoint sequence zero, gap, duplicate, or replay;
- zero/oversize checkpoint;
- malformed/tampered checkpoint metadata;
- tampered checkpoint payload;
- symlink/non-regular checkpoint payload/metadata;
- wrong work-unit digest/size/path;
- tampered work unit after download;
- resume of exited/failed/cancelled/expired attempt;
- concurrent resume of prepared/resuming/running attempt;
- trailing or malformed resume frame;
- implicit retry after restart.

Raw checkpoint/work-unit bytes are not written into lifecycle records.

## Real Docker qualification

The Level 1 fast workflow builds a local `FROM scratch` checkpoint-aware probe image.

The exact-head test performs:

**content-addressed work unit + bound checkpoint → interrupted local attempt → explicit resume → real Docker sandbox → resume-frame parsing → exact work-unit/checkpoint SHA-256 verification → terminal local state → replay rejection**

No registry pull or testnet dependency is required.

## Exit criteria

CMP-3.7 is complete when one exact implementation SHA proves all of the following:

1. checkpoint state is worker-local and explicitly non-authoritative;
2. checkpoint storage is private and scoped to canonical attempt identity;
3. sequence starts at 1 and advances monotonically by exactly one;
4. replay/gaps/stale sequence values fail closed;
5. payload size is positive and bounded;
6. payload SHA-256 is computed while writing and reverified before resume;
7. checkpoint metadata binds exact authorization commitment, attempt ref/nonce and work-unit digest;
8. deterministic checkpoint commitment is present and revalidated;
9. checkpoint metadata/payload symlink or unsafe-file states fail closed;
10. resume is explicit and requires prior local `interrupted` state;
11. canonical authorization is re-resolved immediately before resume;
12. same worker/job/unit/root-assignment/attempt/nonce/manifest/policy bindings remain enforced through CMP-3.6 validation;
13. deadline and lease must still be live;
14. exact work unit is rehashed immediately before resume;
15. exact checkpoint is rehashed immediately before resume;
16. terminal attempts cannot be reopened;
17. live/prepared/resuming attempts cannot be resumed concurrently;
18. crash during resuming/running recovers to interrupted without implicit execution;
19. resume bytes enter only through the CMP-3.4 sandbox;
20. versioned bounded resume framing preserves exact work-unit/checkpoint bytes and rejects malformed/trailing input;
21. a real Docker integration test proves the resumed sandbox receives the exact verified work unit and checkpoint;
22. CMP-3.1 through CMP-3.6 regressions remain green;
23. targeted Go tests, vet, build, real Docker resume test and CMP-3.7 verifier pass on the same exact implementation SHA.

## Qualification evidence

- Implementation SHA: `c438a029a652fdeed42ef94b877e50b804842689`
- Compute Worker Fast Qualification: **#143**
- Run ID: `37256445519`
- Job ID: `111594452272`
- Result: **SUCCESS**
- Durable evidence anchor: `1971279df16ad20af1761766f67f116ceb61b866`
- Evidence record: [CMP-3.7 qualification evidence](CMP-3.7-QUALIFICATION-EVIDENCE.md)

## Qualification model

CMP-3.7 is an ordinary **Level 1** step.

Required owner: **Compute Worker Fast Qualification**.

CMP-3.6 already served as the first worker-runtime Level 2 convergence milestone. CMP-3.7 extends that qualified lifecycle with an app-local checkpoint/resume primitive and does not introduce a new shared protocol authority or cross-component dependency.

Therefore **Level 2 is not required for CMP-3.7**.

The broader worker integration workflow is now explicitly milestone-gated rather than running after every worker change.

Level 3 remains reserved for **CMP-3.14 — Phase closeout**.

## Intentionally deferred

- CMP-3.8 result commitment;
- CMP-3.9 execution-key signed receipt;
- CMP-3.10 result/evidence upload;
- CMP-3.11 local resource controls;
- CMP-3.12 malicious workload protections;
- CMP-3.13 Windows/Linux/macOS packaging;
- complete accumulated reconciliation and Level 3 qualification at CMP-3.14.

No live/testnet dependency is required for CMP-3.7.

Next canonical step: **CMP-3.8 — Result commitment**.
