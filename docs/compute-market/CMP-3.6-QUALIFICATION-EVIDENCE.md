# CMP-3.6 — Execution lifecycle qualification evidence

Status: **COMPLETE**

## Roadmap step

- Step: **CMP-3.6 — Execution lifecycle**
- Qualification level: **Level 1 + Level 2**
- Milestone relationship: first worker-runtime convergence milestone
- Level 3: deferred to **CMP-3.14 — Phase closeout**

## Qualified implementation

- Implementation SHA: `612d9e9401ab05b7d4864be751f942a8d384a162`
- Current `main` at qualification: `f6a426fc386b21f871b1805e00a57b1dad2bf902`
- Audit branch: `cmp-3.1-worker-daemon-20261004`
- Pull request: **#512 — CMP-3: node420 compute worker runtime**
- Branch divergence at qualification: **90 commits ahead / 109 behind** current `main`
- Merge base: `2280fb6f9915b849560d9d4d5a95d999c4adc669`

The branch is intentionally not fully reconciled during this milestone. The controlling shared dependency surfaces were checked against current `main` and were blob-identical:

- `docs/compute-market/CMP-0.11-CLIENT-NODE-AND-420AI-INTEGRATION.md`;
- `docs/compute-market/CMP-0.7-AUTHORIZED-JOB-LIFECYCLE.md`;
- `contracts/src/compute/ComputeJobWorkerSnapshotEvidence420.sol`;
- `contracts/src/compute/ComputeAuthorization420.sol`.

No changed shared dependency requires early Level 3 reconciliation.

## Implementation summary

CMP-3.6 adds the worker-side authorized execution lifecycle and composes the previously-qualified download and sandbox layers.

Implementation/qualification surfaces:

- `compute/worker/lifecycle.go`;
- `compute/worker/lifecycle_test.go`;
- `compute/worker/lifecycle_integration_test.go`;
- `compute/worker/testdata/lifecycleprobe/main.go`;
- `compute/worker/testenv_test.go`;
- `compute/worker/sandbox.go`;
- `compute/worker/sandbox_test.go`;
- `.github/workflows/compute-worker-fast.yml`;
- `.github/workflows/compute-worker-integration.yml`;
- `scripts/verify-cmp-3-6-execution-lifecycle.py`;
- `docs/compute-market/CMP-3.6-EXECUTION-LIFECYCLE.md`;
- `docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md`.

## Canonical authorization boundary

Execution starts only after `CanonicalExecutionAuthority` resolves an exact authorization by reference.

The resolved snapshot binds:

- chain;
- authorization reference;
- job and unit;
- root assignment;
- attempt reference and nonzero nonce;
- provider/node/resource/worker identity;
- manifest;
- accepted constraint commitment;
- input-access reference;
- work-unit SHA-256/size;
- immutable sandbox image;
- command SHA-256;
- execution deadline;
- finite lease expiry.

Caller-supplied fields cannot independently authorize execution.

## Lifecycle semantics

Worker-local states are observational only:

- `prepared`;
- `running`;
- `exited`;
- `failed`;
- `cancelled`;
- `expired`;
- `interrupted`.

They do not replace canonical ComputeMarket job/attempt state.

A sandbox process exiting zero does not claim:

- result commitment;
- verification;
- correctness;
- payment entitlement;
- settlement.

Those remain later protocol/roadmap responsibilities.

## Download + sandbox composition

Immediately before execution, the worker reopens and rehashes the exact CMP-3.5 artifact from canonical private worker state.

Execution then goes only through the CMP-3.4 sandbox.

`Sandbox.RunWithInput` streams the already-verified work-unit bytes directly to container stdin. No host volume/device mapping was added.

## Replay / restart behavior

- Exact finalized attempt replay is rejected.
- Exact active attempt duplication is rejected.
- Independent attempt refs can progress concurrently.
- Attempt records are atomically/private persisted.
- A startup-time `prepared` or `running` record becomes `interrupted`.
- Interrupted attempts are not implicitly rerun.
- A replacement execution requires a separately authorized canonical attempt.

## Privacy result

Persistent attempt records contain metadata/transition codes only.

They do not persist:

- raw work-unit input;
- raw sandbox output;
- source authorization tokens;
- prompt/model contents;
- private keys or credentials.

## Level 1 exact-head qualification

Required owner: **Compute Worker Fast Qualification**

- Workflow run number: **#115**
- Run ID: `37255444231`
- Job ID: `111591383323`
- Exact SHA: `612d9e9401ab05b7d4864be751f942a8d384a162`
- Result: **SUCCESS**

Passing checks:

- exact-head checkout — PASS;
- exact-head SHA verification — PASS;
- worker package tests — PASS;
- `node420-compute` package tests — PASS;
- Go vet — PASS;
- worker runtime build — PASS;
- local CMP-3.4 scratch image build — PASS;
- real Docker sandbox isolation regression — PASS;
- CMP-3.1 regression verifier — PASS;
- CMP-3.2 regression verifier — PASS;
- CMP-3.3 regression verifier — PASS;
- CMP-3.4 regression verifier — PASS;
- CMP-3.5 regression verifier — PASS;
- CMP-3.6 execution-lifecycle verifier — PASS.

No required Level 1 check was skipped, cancelled, missing or substituted.

## Level 2 exact-head integration qualification

Required owner: **Compute Worker Integration Qualification**

- Workflow run number: **#5**
- Run ID: `37255444265`
- Job ID: `111591383281`
- Exact SHA: `612d9e9401ab05b7d4864be751f942a8d384a162`
- Result: **SUCCESS**

Passing checks:

- exact-head checkout — PASS;
- exact-head SHA verification — PASS;
- build real local CMP-3 integration images — PASS;
- full retained worker integration suite — PASS;
- `node420-compute` package tests — PASS;
- Go vet — PASS;
- worker runtime build — PASS.

The retained integration suite included the real path:

**TLS content-addressed download → canonical authorization → artifact revalidation → real Docker sandbox → exact verified work-unit bytes on stdin → terminal local state → duplicate replay rejection.**

## Exit-criterion disposition

All CMP-3.6 exit criteria are satisfied on the exact implementation SHA:

1. canonical authorization resolved by reference — PASS;
2. exact worker ancestry/chain identity enforced — PASS;
3. canonical job/unit/assignment/attempt/nonce/manifest/policy fields bound — PASS;
4. artifact revalidated immediately before execution — PASS;
5. immutable image and command commitment enforced — PASS;
6. finite deadline/lease enforced — PASS;
7. no direct host workload execution — PASS;
8. verified input reaches sandbox without host mount — PASS;
9. prepared/running/terminal state durable — PASS;
10. local status is noncanonical/non-correctness evidence — PASS;
11. exact attempt replay rejected — PASS;
12. independent attempts are not globally serialized — PASS;
13. cancellation/failure/expiry/interruption distinct — PASS;
14. restart marks live local work interrupted and never reruns implicitly — PASS;
15. private attempt records do not persist raw input/output — PASS;
16. CMP-3.1–3.5 regressions green — PASS;
17. Level 1 exact-head qualification — PASS;
18. Level 2 exact-head integration qualification — PASS.

## Intentionally deferred

- CMP-3.7 checkpointing/resume;
- CMP-3.8 result commitment;
- CMP-3.9 execution-key signed receipt;
- CMP-3.10 result/evidence upload;
- CMP-3.11 local resource controls;
- CMP-3.12 malicious workload protections;
- CMP-3.13 Windows/Linux/macOS packaging;
- complete reconciliation and comprehensive Level 3 qualification at CMP-3.14.

No live/testnet dependency is required for CMP-3.6.

## Evidence-only closeout rule

The evidence/status commits after the qualified implementation SHA are documentation/bookkeeping only. They change no executable source, tests, workflows, dependencies, configuration, generated/runtime artifacts, interfaces, deployment state or substantive requirements. They therefore reference the already-qualified implementation SHA without recursively creating another implementation qualification requirement.

## Formal status

**CMP-3.6 — Execution lifecycle: COMPLETE.**

Next canonical step: **CMP-3.7 — Checkpointing/resume**.
