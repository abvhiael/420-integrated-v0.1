# CMP-3.8 — Result commitment

Status: **IMPLEMENTED / LEVEL 1 QUALIFICATION PENDING**

## Canonical definition

**Result commitment.**

The canonical roadmap names result commitment after checkpoint/resume and before execution-key signed receipt.

The frozen ComputeMarket lifecycle requires the canonical `RUNNING -> RESULT_COMMITTED` transition to be backed by an admissible attempt, output commitment, accepted policy, and domain-bound receipt/evidence references. Existing worker-evidence contracts require both `receiptHash` and `outputHash`, with execution-key signing handled separately.

CMP-3.8 therefore creates the worker-side **unsigned result commitment material** that CMP-3.9 will sign and submit. It does not create a receipt hash, execution-key signature, canonical job transition, correctness verdict, payment entitlement, or settlement authority.

## Existing contract compatibility

`ComputeJobWorkerSnapshotEvidence420.commitResult` accepts:

- canonical job/attempt context;
- `receiptHash`;
- `outputHash`;
- execution-key signature.

Its execution digest binds the accepted job/request/manifest/assignment/worker/attempt snapshot plus `receiptHash` and `outputHash`.

CMP-3.8 exposes the complete sandbox stdout digest in two equivalent forms:

- `outputSha256`: lowercase 64-hex SHA-256;
- `outputHash`: bytes32-compatible `0x` + the same SHA-256.

CMP-3.9 can therefore bind/sign this exact `outputHash` without reinterpreting or rehashing result bytes.

CMP-3.8's local `resultCommitment` is deliberately **not** the final on-chain worker-adapter result commitment, because the final contract commitment also includes the receipt hash that does not exist until CMP-3.9.

## Complete output hashing

Before CMP-3.8, `SandboxResult.Output` was a bounded diagnostic capture. That is unsuitable as a result commitment source because large stdout may be truncated.

CMP-3.8 changes the sandbox output boundary:

- stdout is SHA-256 hashed in full while streaming;
- the full stdout byte count is recorded;
- diagnostic capture remains bounded by `MaxOutputBytes`;
- stderr remains diagnostic and is not part of the result output hash;
- truncation of diagnostic capture does not truncate the cryptographic stdout commitment.

A legitimately empty stdout has the nonzero SHA-256 empty-string commitment.

## Durable execution binding

CMP-3.8 persists the complete stdout SHA-256 and byte count in the private CMP-3.6 execution record when the sandbox exits.

Result material is created only from that durable execution record.

The result store rejects:

- missing or unsafe attempt records;
- non-exited attempts;
- nonzero exit code;
- timeout;
- malformed/missing stdout SHA-256;
- mismatch between in-memory sandbox output metadata and the durable execution record;
- execution outside the accepted deadline/lease window;
- authorization/execution binding drift.

This prevents a caller from substituting an arbitrary output digest after execution.

## Result material schema

`compute/worker/result.go` defines `420-compute-worker-result-material-v1`.

Each record binds:

- schema/domain/hash algorithm;
- authorization reference and authorization commitment;
- execution commitment;
- chain ID;
- job ID;
- unit ID;
- root assignment reference;
- attempt reference and nonce;
- provider/node/resource/worker IDs;
- manifest hash;
- accepted constraint commitment;
- work-unit SHA-256;
- immutable sandbox image;
- command SHA-256;
- optional resume checkpoint commitment;
- complete stdout SHA-256;
- bytes32-compatible output hash;
- complete stdout byte count;
- zero exit code;
- execution start/end timestamps;
- deterministic local result commitment.

For resumed execution the material binds the exact checkpoint commitment recorded during CMP-3.7 resume.

## Authority flags

Every CMP-3.8 result record explicitly carries:

- `authoritative=false`;
- `signed=false`;
- `resultCorrectnessEvidence=false`;
- `canonicalResultCommitted=false`.

Verification rejects any local record that self-escalates those flags.

CMP-3.8 cannot claim:

- execution-key attribution;
- canonical receipt submission;
- canonical `RESULT_COMMITTED`;
- correctness/verification;
- provider earnings;
- payment/settlement;
- slash/dispute outcome.

## Private durable result store

Result metadata is stored under:

`<stateDir>/results/<attemptRef>.json`

Properties:

- results directory mode `0700`;
- result record mode `0600`;
- filename derived only from validated attempt reference;
- private temp file + fsync + atomic rename + directory sync;
- symlink/non-regular/unsafe-mode records fail closed;
- raw work-unit bytes are not persisted in the result record;
- raw sandbox stdout/stderr is not persisted in the result record.

Exact duplicate result material is idempotent.

A conflicting second result commitment for the same attempt fails with `ErrConflictingResult`.

## Result verification

`VerifyResultMaterial` reconstructs:

- canonical authorization commitment;
- execution commitment;
- exact attempt and worker ancestry bindings;
- output SHA-256/outputHash relation;
- accepted execution-time window;
- deterministic result-material commitment.

Any field mutation invalidates verification.

## Real Docker qualification

The Level 1 workflow builds a local `FROM scratch` result probe.

The probe emits 96 KiB of deterministic stdout while the sandbox diagnostic capture is limited to 64 KiB, and emits separate stderr diagnostics.

The integration test proves:

1. diagnostic output is truncated;
2. `StdoutBytes` still reports the complete 96 KiB;
3. `StdoutSHA256` matches the full stdout bytes;
4. the hash does not collapse to the truncated capture;
5. result material uses the complete stdout digest/length;
6. `outputHash` is the bytes32-compatible form of the same digest;
7. result material remains unsigned/non-authoritative/non-correctness/noncanonical.

## Security/adversarial requirements

CMP-3.8 must fail closed for:

- failed/nonzero/timed-out/non-exited execution;
- fabricated in-memory stdout digest/length;
- mutated durable attempt record;
- mismatched authorization snapshot;
- attempt/worker/resource/work-unit/image/command binding drift;
- execution timestamps outside accepted deadline/lease;
- malformed output hash;
- result-material tampering;
- unsafe/symlink persisted result record;
- conflicting second result for one attempt;
- local authority-flag escalation.

## Exit criteria

CMP-3.8 is complete when one exact implementation SHA proves:

1. complete stdout is hashed while streaming, independent of bounded diagnostics;
2. stdout byte count covers complete stdout;
3. stderr diagnostics do not become the committed result output;
4. empty stdout has a valid nonzero SHA-256 commitment;
5. stdout hash/length are persisted in the durable execution record;
6. result material is derived from that durable private record, not caller-supplied output alone;
7. only successful `exited`, zero-exit, non-timeout execution can commit a result;
8. execution start/end are within immutable deadline/lease;
9. result material binds exact canonical authorization/execution/job/unit/root-assignment/attempt/nonce/worker/resource/manifest/constraint/work-unit/image/command state;
10. resumed result material binds the exact CMP-3.7 checkpoint commitment;
11. `outputHash` is exactly bytes32-compatible `0x + outputSha256`;
12. result material is deterministic and independently verifiable;
13. exact duplicate result creation is idempotent;
14. conflicting second result for one attempt fails closed;
15. result records are private regular files with atomic durable publication;
16. raw customer input/output is not persisted in result metadata;
17. authority flags remain false and self-escalation is rejected;
18. no receipt hash/signature/canonical result transition/correctness/payment/settlement authority is introduced;
19. real Docker qualification proves full-output hashing beyond diagnostic truncation;
20. CMP-3.1 through CMP-3.7 regressions remain green;
21. targeted Go tests, vet, build, Docker result test and CMP-3.8 verifier pass on the same exact SHA.

## Qualification model

CMP-3.8 is an ordinary **Level 1** roadmap step.

Required owner: **Compute Worker Fast Qualification**.

CMP-3.6 remains the most recent Level 2 worker-runtime convergence milestone. CMP-3.8 adds local result material but does not yet cross the execution-key/receipt/canonical-submission authority boundary.

Therefore **Level 2 is not required for CMP-3.8**.

The next likely meaningful authority convergence is CMP-3.9, where execution-key signing is introduced; whether that requires Level 2 will be decided from repository evidence at that step.

Level 3 remains reserved for **CMP-3.14 — Phase closeout**.

## Intentionally deferred

- CMP-3.9 execution-key signed receipt;
- CMP-3.10 result/evidence upload;
- CMP-3.11 local resource controls;
- CMP-3.12 malicious workload protections;
- CMP-3.13 Windows/Linux/macOS packaging;
- complete reconciliation and comprehensive Level 3 qualification at CMP-3.14.

No live/testnet dependency is required for CMP-3.8.

Next canonical step: **CMP-3.9 — Execution-key signed receipt**.
