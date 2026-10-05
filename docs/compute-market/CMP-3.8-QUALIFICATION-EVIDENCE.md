# CMP-3.8 — Result commitment qualification evidence

Status: **COMPLETE**

## Roadmap step

- Step: **CMP-3.8 — Result commitment**
- Qualification level: **Level 1**
- Milestone relationship: ordinary post-CMP-3.6 worker-runtime step
- Level 2: not required
- Level 3: deferred to **CMP-3.14 — Phase closeout**

## Qualified implementation

- Evidence anchor SHA: `31e1343625b6bd56d8ea059a7460d1c63c5eb587` (creation commit for this durable evidence record)

- Implementation/spec SHA: `05a4a5f835657c0860cd78685bd274ed66134e35`
- Current `main` at qualification: `e0c8d4b22bdfd0a75e90198404bcb00b5e04d5da`
- Audit branch: `cmp-3.1-worker-daemon-20261004`
- Pull request: **#512 — CMP-3: node420 compute worker runtime**
- Branch divergence at qualification: **134 commits ahead / 163 behind** current `main`
- Merge base: `2280fb6f9915b849560d9d4d5a95d999c4adc669`

The branch is intentionally not reconciled during this ordinary Level 1 step.

Relevant shared dependency surfaces were checked against current `main` and were blob-identical:

- `contracts/src/compute/ComputeJobWorkerSnapshotEvidence420.sol`;
- `docs/compute-market/CMP-0.9-SIGNED-RECEIPTS-AND-VERIFICATION.md`;
- `docs/compute-market/CMP-0.7-AUTHORIZED-JOB-LIFECYCLE.md`.

No shared dependency change requires early Level 3 reconciliation.

## Canonical boundary

The frozen lifecycle requires canonical `RUNNING -> RESULT_COMMITTED` to be backed by an admissible attempt, accepted policy, output commitment and domain-bound receipt/evidence.

The current canonical worker-evidence adapter accepts:

- `receiptHash`;
- `outputHash`;
- execution-key signature.

CMP-3.8 therefore stops one authority layer earlier than the canonical transition.

It creates deterministic **unsigned worker-local result material** and a complete base content commitment. It does not:

- manufacture a receipt hash;
- sign with the execution key;
- call canonical `commitResult` / `recordResult`;
- mark canonical `RESULT_COMMITTED`;
- claim correctness or verification;
- create provider earnings/payment entitlement;
- settle or release funds.

CMP-3.9 owns the execution-key signed receipt boundary.

## Profile-defined output commitment boundary

CMP-0.9 explicitly defines receipt `outputCommitment` under the accepted versioned output/verification profile. A legitimately empty output must have the profile-defined nonzero empty-output commitment.

Accordingly:

- CMP-3.8 computes a complete SHA-256 content commitment over raw sandbox stdout;
- it exposes that digest as lowercase `outputSha256`;
- it also exposes a bytes32-compatible local `outputHash = 0x + outputSha256`;
- this is a profile-neutral base content commitment;
- it is **not** asserted to be the universal canonical receipt `outputCommitment` for every verification profile.

CMP-3.9 must resolve the accepted output/verification profile and may use this base hash directly only when the frozen profile defines raw stdout SHA-256 as the canonical receipt output commitment.

## Implementation summary

CMP-3.8 adds complete output commitment capture and private unsigned result material.

Qualification-relevant surfaces:

- `compute/worker/sandbox.go`;
- `compute/worker/sandbox_test.go`;
- `compute/worker/lifecycle.go`;
- `compute/worker/result.go`;
- `compute/worker/result_test.go`;
- `compute/worker/result_integration_test.go`;
- `compute/worker/testdata/resultprobe/main.go`;
- `.github/workflows/compute-worker-fast.yml`;
- `scripts/verify-cmp-3-8-result-commitment.py`;
- `docs/compute-market/CMP-3.8-RESULT-COMMITMENT.md`;
- `docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md`.

### Complete stdout commitment

The sandbox now:

- hashes all stdout bytes while streaming;
- records complete stdout byte count;
- keeps bounded diagnostic capture separately;
- leaves stderr as diagnostic-only data;
- can therefore commit output larger than `MaxOutputBytes` without committing only the truncated capture.

A legitimate empty stdout still has the standard nonzero SHA-256 empty-byte commitment.

### Durable execution anchor

CMP-3.6 execution records now persist:

- complete stdout SHA-256;
- complete stdout byte count;
- resume checkpoint commitment where applicable.

Both fresh execution and checkpoint-resume execution persist the same output commitment fields.

CMP-3.8 re-reads the private durable execution record before creating result material and rejects a caller-supplied in-memory output digest/length that does not match it.

### Result material

`420-compute-worker-result-material-v1` binds:

- authorization reference/commitment;
- execution commitment;
- chain/job/unit/root-assignment/attempt/nonce;
- provider/node/resource/worker;
- manifest and accepted constraint commitment;
- work-unit SHA-256;
- immutable sandbox image;
- command SHA-256;
- optional CMP-3.7 checkpoint commitment;
- full stdout SHA-256 and byte count;
- local bytes32-compatible output content hash;
- zero exit code;
- execution start/end timestamps;
- deterministic local result commitment.

Authority flags are hard false:

- `authoritative=false`;
- `signed=false`;
- `resultCorrectnessEvidence=false`;
- `canonicalResultCommitted=false`.

### Private result store

Result metadata is stored under:

`<stateDir>/results/<attemptRef>.json`

Properties:

- directory mode `0700`;
- file mode `0600`;
- attempt-derived filename only;
- private temp file;
- fsync;
- atomic rename;
- directory sync;
- unsafe/symlink/non-regular files rejected;
- raw work unit is not persisted;
- raw stdout/stderr is not persisted.

Exact duplicate result creation is idempotent.

A conflicting second commitment for the same attempt fails closed with `ErrConflictingResult`.

## Security/adversarial coverage

Targeted tests prove rejection or safe behavior for:

- failed execution;
- nonzero/unsuccessful execution;
- fabricated in-memory stdout digest/length;
- durable-record mismatch;
- authorization snapshot mutation;
- attempt/worker/resource/work-unit/image/command binding drift;
- execution outside accepted deadline/lease;
- result-material tampering;
- local authority-flag self-escalation;
- unsafe/symlink persisted result record;
- conflicting second result;
- raw customer input/output persistence.

Retained checkpoint-resume tests also prove resumed result material can bind the exact CMP-3.7 checkpoint commitment.

## Real Docker qualification

The Level 1 workflow builds a local scratch result probe.

The probe emits:

- **96 KiB deterministic stdout**;
- a separate stderr diagnostic.

The sandbox diagnostic capture is limited to 64 KiB.

The real-container test proves:

1. diagnostic capture truncates;
2. complete stdout byte count remains 96 KiB;
3. complete stdout SHA-256 matches all 96 KiB;
4. the cryptographic output commitment is not the truncated diagnostic hash;
5. result material binds the complete digest/length;
6. local bytes32-compatible output hash matches that digest;
7. result material remains unsigned/non-authoritative/non-correctness/noncanonical.

## Qualification history / superseded evidence

### Untriggered candidate

Candidate `abd4f0a4f527f340136a5b0dea859f27162a305c` did not register the required fast workflow.

Root cause: malformed fast-workflow YAML created by an incremental edit: split `go test -run` commands and duplicated verifier blocks.

The workflow was replaced wholesale with a clean canonical definition.

This SHA is **not qualification evidence**.

### Failing candidate

Candidate `9d8425f1cb6c2bd929a188c154fe5d7cc6132977` registered:

- Compute Worker Fast Qualification **#181**
- run `37257687511`
- job `111598169014`

It failed at **Test worker runtime**.

Exact root cause:

`TestResultCommitmentBindsResumeCheckpoint` failed because the resumed execution path did not persist `StdoutSHA256` / `StdoutBytes` into the durable attempt record, while the fresh execution path did.

All later Docker/verifier steps were correctly skipped.

The defect was fixed in implementation SHA:

`46067b01ac455e7a2862bf464e3ecd613e6fd7fd`

### Successful intermediate implementation SHA

`46067b01ac455e7a2862bf464e3ecd613e6fd7fd` passed:

- Compute Worker Fast Qualification **#183**
- run `37257796402`
- job `111598489411`
- result **SUCCESS**

That SHA is superseded only because the later repository review found a substantive semantic clarification: CMP-0.9 makes canonical receipt output commitment profile-defined.

The documentation/roadmap were corrected accordingly, creating a new substantive specification SHA requiring fresh exact-head qualification.

## Exact-head Level 1 qualification

Required owner: **Compute Worker Fast Qualification**

- Workflow run number: **#187**
- GitHub Actions run ID: `37257986490`
- Job ID: `111599032446`
- Qualified implementation/spec SHA: `05a4a5f835657c0860cd78685bd274ed66134e35`
- Result: **SUCCESS**

Passing exact-head checks:

- checkout exact qualification head — PASS;
- verify exact qualification head — PASS;
- worker package tests — PASS;
- `node420-compute` package tests — PASS;
- Go vet — PASS;
- worker runtime build — PASS;
- local CMP-3.4 sandbox probe image build — PASS;
- real Docker sandbox isolation regression — PASS;
- local CMP-3.7 checkpoint resume probe image build — PASS;
- real Docker checkpoint/resume regression — PASS;
- local CMP-3.8 result commitment probe image build — PASS;
- real Docker result commitment integration — PASS;
- CMP-3.1 daemon regression verifier — PASS;
- CMP-3.2 hardware/software discovery verifier — PASS;
- CMP-3.3 benchmarking/capability evidence verifier — PASS;
- CMP-3.4 secure workload sandbox verifier — PASS;
- CMP-3.5 content-addressed work-unit download verifier — PASS;
- CMP-3.6 execution lifecycle verifier — PASS;
- CMP-3.7 checkpointing/resume verifier — PASS;
- CMP-3.8 result commitment verifier — PASS.

No required CMP-3.8 Level 1 check was skipped, cancelled, missing, stale or substituted.

## Level 2 status

**Not required for CMP-3.8.**

CMP-3.6 remains the most recent worker-runtime Level 2 convergence milestone.

On the exact qualified SHA, **Compute Worker Integration Qualification #47 / run `37257986516` was skipped by design** because PR #512 is not labeled `cmp-worker-level2`.

That skip is not represented as passing evidence and is not required for CMP-3.8 completion.

## Broad unrelated workflows

Repository-wide/broad workflows are not CMP-3.8's required Level 1 owner under the active phase policy.

At the exact qualified SHA:

- 420Docs Qualification run `37257986566` — **FAILURE**;
- 420 Integrated Qualification — not used as CMP-3.8 gate;
- Compute Market Qualification — not used as CMP-3.8 gate;
- node420 Release Gate — not used as CMP-3.8 gate;
- 420Oracle audit qualification — not used as CMP-3.8 gate.

No cancelled, skipped, missing, failing, queued or unrelated broad workflow is promoted to CMP-3.8 passing evidence.

## Exit-criterion disposition

All CMP-3.8 exit criteria are satisfied on the exact implementation/spec SHA:

1. complete stdout hashed independently of bounded diagnostics — PASS;
2. complete stdout byte count recorded — PASS;
3. stderr excluded from committed stdout content — PASS;
4. empty stdout receives valid SHA-256 base content commitment — PASS;
5. stdout hash/length persisted in durable execution record — PASS;
6. result material anchored to durable private attempt record — PASS;
7. only successful exited/zero-exit/non-timeout execution can commit — PASS;
8. execution timestamps bound to immutable deadline/lease — PASS;
9. full canonical authorization/execution/attempt/worker/work-unit bindings preserved — PASS;
10. resumed result binds exact checkpoint commitment — PASS;
11. local bytes32-compatible content hash equals `0x + outputSha256` without claiming universal profile output semantics — PASS;
12. deterministic result material independently verifiable — PASS;
13. identical duplicate result creation idempotent — PASS;
14. conflicting second result fails closed — PASS;
15. private regular durable result storage — PASS;
16. raw input/output absent from result metadata — PASS;
17. authority flags remain false and self-escalation rejected — PASS;
18. no receipt/signature/canonical result/correctness/payment/settlement authority introduced — PASS;
19. real Docker full-output-vs-truncated-diagnostic proof — PASS;
20. CMP-3.1 through CMP-3.7 regressions green — PASS;
21. exact-head Level 1 qualification — PASS.

## Intentionally deferred

- CMP-3.9 execution-key signed receipt;
- accepted profile-specific canonical receipt output commitment adaptation;
- receipt hash and EIP-712/execution-key signing;
- canonical worker-evidence result submission;
- CMP-3.10 result/evidence upload;
- CMP-3.11 local resource controls;
- CMP-3.12 malicious workload protections;
- CMP-3.13 Windows/Linux/macOS packaging;
- complete accumulated reconciliation and comprehensive Level 3 qualification at CMP-3.14.

No live/testnet dependency is required for CMP-3.8.

## Evidence-only closeout rule

The evidence/status commits following the qualified implementation/spec SHA change documentation/bookkeeping only. They do not change executable code, tests, workflows, dependencies, configuration, generated/runtime artifacts, interfaces, deployment state or substantive requirements. They therefore reference the exact qualified SHA above without recursively creating another Level 1 qualification requirement.

## Formal status

**CMP-3.8 — Result commitment: COMPLETE.**

Next canonical step: **CMP-3.9 — Execution-key signed receipt**.
