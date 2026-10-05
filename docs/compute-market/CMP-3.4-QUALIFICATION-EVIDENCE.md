# CMP-3.4 — Secure workload sandbox qualification evidence

Status: **COMPLETE**

## Roadmap step

- Step: **CMP-3.4 — Secure workload sandbox**
- Qualification level: **Level 1**
- Milestone relationship: ordinary CMP-3 runtime/security step; Level 2 not required
- Level 3: deferred to **CMP-3.14 — Phase closeout**

## Qualified implementation

- Implementation SHA: `a3ad2c5c8d70b428d61c1b70f546ec5edbeedcaf`
- Current `main` at closeout: `3d3c01dd8029a3b5c586c77f0f6084f4a16b64ac`
- Merge base: `2280fb6f9915b849560d9d4d5a95d999c4adc669`
- Audit branch: `cmp-3.1-worker-daemon-20261004`
- Pull request: **#512 — CMP-3: node420 compute worker runtime**
- Branch divergence at closeout: **59 commits ahead / 95 behind** current `main`

The controlling isolation architecture file
`docs/compute-market/CMP-0.11-CLIENT-NODE-AND-420AI-INTEGRATION.md`
had the identical blob SHA `394602f274b31bbc31df6c139809e9b29e39b306`
on current `main` and the CMP-3 branch at closeout. CMP-3.4 therefore did not require an early Level 3 reconciliation merely because unrelated `main` history advanced.

## Canonical requirement

The roadmap requirement is:

> Container, microVM, WASM or equivalent isolation. Customer workloads must not execute unrestricted on the host.

The controlling architecture additionally requires nonprivileged execution, resource limits, sandbox isolation, immutable artifact-digest verification, timeouts, egress restriction and host/tenant separation.

## Implementation summary

CMP-3.4 adds a digest-pinned OCI sandbox primitive under `compute/worker`.

Implementation/qualification surfaces:

- `compute/worker/sandbox.go`;
- `compute/worker/sandbox_test.go`;
- `compute/worker/sandbox_integration_test.go`;
- `compute/worker/testdata/sandboxprobe/main.go`;
- `.github/workflows/compute-worker-fast.yml`;
- `scripts/verify-cmp-3-4-secure-workload-sandbox.py`;
- `docs/compute-market/CMP-3.4-SECURE-WORKLOAD-SANDBOX.md`;
- `docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md`.

### Sandbox runtime controls

The production `OSCommandRunner` launches only allowlisted OCI engines (`docker` or `podman`) through `exec.CommandContext` with an argument vector rather than a host shell.

Every run requires a lowercase SHA-256-pinned image reference or immutable local image ID.

The sandbox command enforces:

- `--network none`;
- `--read-only`;
- `--cap-drop ALL`;
- `--security-opt no-new-privileges`;
- explicit non-root numeric user;
- bounded PID count;
- bounded memory;
- bounded CPU;
- bounded writable `/tmp` tmpfs with `noexec,nosuid,nodev`;
- mandatory finite timeout;
- bounded stdout/stderr capture;
- unique random per-run container names;
- best-effort forced container removal on timeout/cancellation.

No host volume/mount, host device, privileged mode, host PID namespace or host IPC namespace is provided.

GPU/device access is denied by default at this step.

## Requirements satisfied

1. Customer-command execution is exposed only through an explicit sandbox API.
2. OCI engines are allowlisted to Docker/Podman.
3. Mutable image tags are rejected; SHA-256-pinned references/IDs are mandatory.
4. Non-root execution is mandatory.
5. Root filesystem is read-only.
6. All Linux capabilities are dropped.
7. No-new-privileges is mandatory.
8. Network is disabled and CMP-3.4 callers cannot enable it.
9. No host mounts, devices, host PID namespace or host IPC namespace are exposed.
10. CPU, memory and PID limits are mandatory and bounded.
11. Writable scratch space is bounded `noexec,nosuid,nodev` tmpfs.
12. Every run has a finite timeout with best-effort forced cleanup.
13. Captured output is bounded to prevent log-memory exhaustion.
14. Customer command arguments are passed as argv without host-shell interpolation.
15. A real Docker/scratch probe validates isolation from inside the container.
16. No alternate `exec.Command*` execution path exists in the CMP worker/runtime command outside the sandbox backend.
17. CMP-3.1, CMP-3.2 and CMP-3.3 regressions remain green.

## Real isolation probe

The fast workflow builds a local static probe binary and a local `FROM scratch` Docker image without pulling a registry image.

The production sandbox backend then executes that image by immutable Docker image ID.

Inside the sandbox the probe verifies:

- effective UID is not root;
- writing the read-only root filesystem fails;
- writing bounded `/tmp` succeeds;
- Linux `NoNewPrivs` equals 1;
- effective Linux capabilities are zero;
- outbound TCP egress is unavailable.

The probe emits `cmp-sandbox-probe-ok` only after all assertions pass.

## Security/adversarial/boundary coverage

Targeted unit/adversarial tests cover:

- mandatory control disablement fails closed;
- mutable/unpinned images are rejected;
- root user is rejected;
- required isolation flags are always emitted;
- host mount/device/namespace escape flags are absent;
- shell metacharacters remain inert argv values rather than host-shell syntax;
- timeout triggers cleanup;
- output truncation is explicit and bounded;
- NUL/empty commands are rejected;
- engine failures remain visible.

The mechanical verifier also checks that no other `exec.Command` or `exec.CommandContext` path exists in `compute/worker/*.go` or `execution/cmd/node420-compute/*.go` outside `sandbox.go`.

## Exact-head Level 1 qualification

Required owner: **Compute Worker Fast Qualification**

- Workflow run number: **#64**
- GitHub Actions run ID: `37251256261`
- Job ID: `111579187313`
- Qualified implementation SHA: `a3ad2c5c8d70b428d61c1b70f546ec5edbeedcaf`
- Result: **SUCCESS**

Passing exact-head checks:

- exact-head checkout — PASS;
- exact-head SHA verification — PASS;
- `go test ./compute/worker` — PASS;
- `go test ./execution/cmd/node420-compute` — PASS;
- `go vet ./compute/worker ./execution/cmd/node420-compute` — PASS;
- `go build ./execution/cmd/node420-compute` — PASS;
- local scratch sandbox probe image build — PASS;
- real Docker sandbox integration probe — PASS;
- CMP-3.1 daemon regression verifier — PASS;
- CMP-3.2 hardware/software discovery regression verifier — PASS;
- CMP-3.3 benchmarking/capability evidence regression verifier — PASS;
- CMP-3.4 secure workload sandbox verifier — PASS.

## Diagnosed superseded failures

### Candidate `65d14e3a6662be6d28f382544d33f7ad8bedf043`

The required Compute Worker fast workflow did not register because the workflow YAML had been corrupted while adding the Docker integration step.

This was classified as a **CI/workflow definition defect**. Missing/untriggered qualification was not treated as passing evidence.

### Run #60 — `fcedc9b0202dc0e48b7764606b58ec938f792894`

- run ID: `37251053922`
- job ID: `111578571946`
- result: **FAILURE**

After the workflow definition was repaired, the worker-runtime stage exposed malformed `sandbox.go` source caused by a corrupted digest-regexp/file prefix.

### Run #62 — `794003e3e38d79c792876bf679a051c14518bb83`

- run ID: `37251151507`
- job ID: `111578884741`
- result: **FAILURE**

A partial regexp repair left a duplicated source prefix embedded in the file. The deterministic syntax failure was diagnosed rather than rerun unchanged.

The file was then replaced wholesale with the intended clean implementation, producing the qualified SHA `a3ad2c5c...`.

None of the missing/failed/superseded runs above is counted as qualification evidence.

## Level 2 status

**Not required for CMP-3.4.**

The step is security-significant, but the isolation boundary is contained within the worker runtime and receives a real backend isolation integration test directly in Level 1. No shared protocol authority or cross-app lifecycle changed.

A later CMP-3 runtime convergence milestone may run broader retained app integration once sandboxing, work-unit retrieval and execution lifecycle are composed.

## Intentionally deferred

- CMP-3.5 content-addressed work-unit download;
- CMP-3.6 execution lifecycle;
- CMP-3.7 checkpointing/resume;
- CMP-3.8 result commitment;
- CMP-3.9 execution-key signed receipt;
- CMP-3.10 result/evidence upload;
- CMP-3.11 operator CPU/GPU %, idle-only, thermal, bandwidth and schedule controls;
- CMP-3.12 malicious workload protections beyond the mandatory isolation primitive;
- CMP-3.13 Windows/Linux/macOS packaging;
- CMP-3.14 full reconciliation and Level 3 phase closeout.

## Limitations

- Docker/Linux is the real backend qualified by CI.
- Podman command construction is supported and unit-qualified but Podman daemon execution is not required in Level 1 CI.
- Network policy is fail-closed `none`; selective egress is not yet exposed.
- GPU/device access is disabled.
- Host path and secret mounts are disabled.
- CMP-3.4 does not yet fetch a work unit or start an authorized job attempt.

## Blockers

**None for CMP-3.4.**

No live chain/testnet dependency is required for this isolation primitive.

## Evidence-only closeout rule

The commit creating this evidence record and subsequent roadmap/status bookkeeping commits are evidence-only. They modify no executable source, tests, workflows, dependencies, configuration, generated/runtime artifacts, interfaces, deployment state or substantive requirements. They therefore reference the already-qualified implementation SHA without recursively requiring another Level 1 run.

## Formal status

**CMP-3.4 — Secure workload sandbox: COMPLETE.**

Next canonical step: **CMP-3.5 — Content-addressed work-unit download**.
