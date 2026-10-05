# CMP-3.7 — Checkpointing/resume qualification evidence

Status: **COMPLETE**

## Roadmap step

- Step: **CMP-3.7 — Checkpointing/resume**
- Qualification level: **Level 1**
- Milestone relationship: ordinary post-CMP-3.6 worker-runtime step
- Level 2: not required
- Level 3: deferred to **CMP-3.14 — Phase closeout**

## Qualified implementation

- Implementation SHA: `c438a029a652fdeed42ef94b877e50b804842689`
- Current `main` at qualification: `f6a426fc386b21f871b1805e00a57b1dad2bf902`
- Audit branch: `cmp-3.1-worker-daemon-20261004`
- Pull request: **#512 — CMP-3: node420 compute worker runtime**
- Branch divergence at qualification: **108 commits ahead / 109 behind** current `main`
- Merge base: `2280fb6f9915b849560d9d4d5a95d999c4adc669`

The branch is intentionally not reconciled during this ordinary Level 1 step. Relevant shared dependency surfaces were checked against current `main` and were blob-identical:

- `docs/compute-market/CMP-0.7-AUTHORIZED-JOB-LIFECYCLE.md`;
- `docs/compute-market/CMP-0.11-CLIENT-NODE-AND-420AI-INTEGRATION.md`;
- `contracts/src/compute/ComputeJobWorkerSnapshotEvidence420.sol`.

No shared dependency change requires early Level 3 reconciliation.

## Implementation summary

CMP-3.7 adds worker-local checkpoint persistence and explicit resume for the same still-authorized interrupted attempt.

Implementation/qualification surfaces include:

- `compute/worker/checkpoint.go`;
- `compute/worker/checkpoint_test.go`;
- `compute/worker/checkpoint_resume_test.go`;
- `compute/worker/checkpoint_integration_test.go`;
- `compute/worker/testdata/checkpointprobe/main.go`;
- `compute/worker/lifecycle.go`;
- `.github/workflows/compute-worker-fast.yml`;
- `.github/workflows/compute-worker-integration.yml`;
- `scripts/verify-cmp-3-7-checkpointing-resume.py`;
- `docs/compute-market/CMP-3.7-CHECKPOINTING-RESUME.md`;
- `docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md`.

## Checkpoint persistence semantics

Each checkpoint is:

- scoped to one canonical attempt reference;
- bound to the canonical authorization commitment;
- bound to attempt nonce;
- bound to the exact CMP-3.5 work-unit SHA-256;
- monotonically sequenced from 1 with no gaps or replay;
- positive-sized and bounded;
- SHA-256 hashed while streaming;
- stored in private worker state;
- rehashed before load/resume;
- committed through deterministic checkpoint metadata.

Checkpoint files and metadata are regular private files only. Symlink or unsafe mode states fail closed.

## Resume semantics

Resume is explicit.

The worker:

1. resolves canonical authorization again by reference;
2. validates exact CMP-3.6 worker/job/unit/root-assignment/attempt/nonce/manifest/constraint/input-policy bindings;
3. requires a prior local `interrupted` state;
4. rejects terminal and live/prepared/resuming state reopening;
5. requires live canonical deadline and lease;
6. reopens and rehashes the exact work unit;
7. loads and rehashes the latest checkpoint;
8. verifies exact attempt/nonce/work-unit checkpoint binding;
9. persists `resuming`;
10. persists `running`;
11. streams a versioned resume frame only through the CMP-3.4 sandbox;
12. persists one terminal local state.

A restart during `resuming` or `running` returns the record to `interrupted`; no startup path automatically re-executes work.

## Resume framing

Resume stream version: `CMP420R1`.

Frame:

- magic;
- big-endian work-unit size;
- big-endian checkpoint size;
- exact verified work-unit bytes;
- exact verified checkpoint bytes.

The parser rejects zero/oversized components, truncation and trailing data.

## Authority boundary

Checkpoint state is local operational evidence only.

It does not create or imply:

- a new canonical attempt;
- another payable unit;
- result commitment;
- result correctness;
- verifier approval;
- execution-key receipt;
- payment entitlement;
- settlement;
- retry authorization.

A new retry/replacement attempt still requires separate canonical authorization under the frozen protocol.

## Security/adversarial coverage

Targeted tests prove:

- first checkpoint must be sequence 1;
- sequence gaps/replay/stale sequence fail closed;
- empty and oversized checkpoints fail closed;
- checkpoint payload tampering fails load/resume;
- work-unit tampering after download fails resume;
- cross-attempt/stale authorization cannot consume another checkpoint;
- expired authorization cannot load/resume a checkpoint;
- symlink checkpoint payload is rejected;
- checkpoint files are private;
- resume framing preserves exact bytes and enforces bounds;
- terminal attempts cannot be reopened;
- prepared/resuming/running attempts cannot be concurrently resumed;
- changed canonical attempt nonce invalidates old checkpoint resume;
- cancellation during resume is persisted distinctly;
- restart during resuming recovers to interrupted;
- raw work-unit/checkpoint bytes are not promoted into canonical protocol state.

## Real Docker qualification

The Level 1 workflow builds a local scratch checkpoint probe and exercises:

**verified content-addressed work unit + bound checkpoint → interrupted attempt → explicit resume → real Docker sandbox → exact resume-frame SHA-256 verification → terminal local state → replay rejection**

The test uses no public image registry or testnet dependency.

## Exact-head Level 1 qualification

Required owner: **Compute Worker Fast Qualification**

- Workflow run number: **#143**
- GitHub Actions run ID: `37256445519`
- Job ID: `111594452272`
- Qualified implementation SHA: `c438a029a652fdeed42ef94b877e50b804842689`
- Result: **SUCCESS**

Passing exact-head checks:

- exact-head checkout — PASS;
- exact-head SHA verification — PASS;
- `go test ./compute/worker` — PASS;
- `go test ./execution/cmd/node420-compute` — PASS;
- Go vet — PASS;
- worker runtime build — PASS;
- local CMP-3.4 sandbox probe image build — PASS;
- real Docker sandbox isolation regression — PASS;
- local CMP-3.7 checkpoint resume probe image build — PASS;
- real Docker checkpoint/resume integration — PASS;
- CMP-3.1 daemon regression verifier — PASS;
- CMP-3.2 hardware/software discovery regression verifier — PASS;
- CMP-3.3 benchmarking/capability evidence regression verifier — PASS;
- CMP-3.4 secure workload sandbox regression verifier — PASS;
- CMP-3.5 content-addressed work-unit download regression verifier — PASS;
- CMP-3.6 execution lifecycle regression verifier — PASS;
- CMP-3.7 checkpointing/resume verifier — PASS.

No required Level 1 check was skipped, cancelled, missing or substituted.

## CI policy remediation

During CMP-3.7, the Level 2 worker workflow was corrected to match the phase qualification model.

`Compute Worker Integration Qualification` is now gated by PR label `cmp-worker-level2` rather than executing after every ordinary `compute/worker/**` change.

On the qualified CMP-3.7 SHA the Level 2 workflow was **SKIPPED BY DESIGN** because CMP-3.7 is not a Level 2 milestone. That skip is not counted as passing evidence and is not required for CMP-3.7 completion.

CMP-3.6 remains the most recent Level 2 convergence milestone.

## Superseded CI defect

Candidate SHA `97d730a8d989abd60f60df5129d78a8bed291418` did not register the required fast workflow because the fast-workflow YAML was corrupted during editing.

The defect was diagnosed as CI-definition corruption: split `go test -run` commands and duplicated verifier blocks.

The workflow was replaced with one clean definition, producing qualified SHA `c438a029a652fdeed42ef94b877e50b804842689`.

The untriggered candidate is not qualification evidence.

## Exit-criterion disposition

All CMP-3.7 exit criteria are satisfied on the exact implementation SHA:

1. checkpoint state worker-local/non-authoritative — PASS;
2. private attempt-scoped storage — PASS;
3. strict monotonic sequence — PASS;
4. replay/gap/stale sequence rejection — PASS;
5. positive bounded payload — PASS;
6. streamed SHA-256 + revalidation — PASS;
7. exact authorization/attempt/work-unit binding — PASS;
8. deterministic checkpoint commitment — PASS;
9. unsafe/symlink storage rejection — PASS;
10. explicit interrupted-state-only resume — PASS;
11. canonical authorization re-resolved — PASS;
12. CMP-3.6 canonical bindings retained — PASS;
13. live deadline/lease required — PASS;
14. work unit rehashed before resume — PASS;
15. checkpoint rehashed before resume — PASS;
16. terminal reopening rejected — PASS;
17. concurrent/live resume rejected — PASS;
18. resuming/running crash returns to interrupted — PASS;
19. sandbox-only resumed execution — PASS;
20. bounded versioned resume framing — PASS;
21. real Docker exact-byte resume proof — PASS;
22. CMP-3.1–CMP-3.6 regressions green — PASS;
23. exact-head Level 1 qualification — PASS.

## Level 2 status

**Not required for CMP-3.7.**

CMP-3.6 already qualified the download/authorization/sandbox lifecycle convergence. CMP-3.7 is an app-local extension to that qualified runtime.

## Intentionally deferred

- CMP-3.8 result commitment;
- CMP-3.9 execution-key signed receipt;
- CMP-3.10 result/evidence upload;
- CMP-3.11 local resource controls;
- CMP-3.12 malicious workload protections;
- CMP-3.13 Windows/Linux/macOS packaging;
- complete reconciliation and comprehensive Level 3 qualification at CMP-3.14.

No live/testnet dependency is required for CMP-3.7.

## Evidence-only closeout rule

The evidence/status commits after the qualified implementation SHA are documentation/bookkeeping only. They change no executable source, tests, workflows, dependencies, configuration, generated/runtime artifacts, interfaces, deployment state or substantive requirements. They therefore reference the qualified implementation SHA above without recursively creating another Level 1 qualification requirement.

## Formal status

**CMP-3.7 — Checkpointing/resume: COMPLETE.**

Next canonical step: **CMP-3.8 — Result commitment**.
