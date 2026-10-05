# CMP-3.4 — Secure workload sandbox

Status: **IMPLEMENTED / LEVEL 1 QUALIFICATION PENDING**

## Canonical definition

**Secure workload sandbox.**

The canonical roadmap requires:

> Container, microVM, WASM or equivalent isolation. Customer workloads must not execute unrestricted on the host.

CMP-3.4 establishes the worker-side isolation primitive that later work-unit download and execution-lifecycle steps must use. It does not implement scheduling, work-unit retrieval, attempts, checkpoints, receipts or result upload.

## Architecture requirements carried into this step

The controlling worker isolation architecture requires that arbitrary customer code never execute inside consensus, block-production, EVM-engine, validator-key, bridge or wallet processes.

For a cohosted worker, isolation requires:

- explicit resource limits;
- nonprivileged identity;
- sandboxed runtime;
- immutable artifact-digest verification;
- execution timeouts;
- egress restriction;
- host/tenant separation;
- no access to validator or custody keys.

CMP-3.4 implements these controls at the sandbox primitive boundary without claiming later resource-policy, scheduler or execution-lifecycle functionality.

## Implementation

### OCI sandbox backend

`compute/worker/sandbox.go` introduces a backend-neutral `Sandbox` API with an OCI command backend supporting `docker` and `podman`.

Every sandbox run requires an immutable image reference:

- `repository@sha256:<64 lowercase hex>`; or
- local immutable image ID `sha256:<64 lowercase hex>`.

Mutable tags such as `latest` are rejected.

### Mandatory isolation policy

The default policy is fail-closed and cannot disable:

- network isolation: `--network none`;
- read-only root filesystem: `--read-only`;
- all Linux capabilities dropped: `--cap-drop ALL`;
- no privilege escalation: `--security-opt no-new-privileges`;
- non-root user: `65532:65532`;
- PID limit;
- memory limit;
- CPU limit;
- bounded writable `/tmp` tmpfs with `noexec,nosuid,nodev`;
- execution timeout;
- bounded captured output.

The sandbox passes no host volumes, mounts, devices, host PID namespace or host IPC namespace.

GPU access is denied by default because no GPU/device mapping is passed. Explicit GPU/resource control remains a later CMP-3.11 concern.

### Command execution boundary

The worker invokes the OCI engine directly with an argument vector through `exec.CommandContext`; it does not pass workload commands through a host shell.

Customer command strings therefore remain container arguments rather than host shell syntax.

Within the CMP worker/runtime code, the only unrestricted OS command construction allowed for customer execution is the sandbox backend itself. The CMP-3.4 verifier fails if another `exec.Command` / `exec.CommandContext` path appears in `compute/worker` or `execution/cmd/node420-compute`.

### Timeout cleanup

Every run uses an execution context with a mandatory finite timeout.

On timeout/cancellation, the worker performs best-effort forced cleanup using the same OCI engine and the generated per-run container name.

Container names are generated from cryptographically random bytes and are not derived from customer input.

### Output safety

Combined sandbox stdout/stderr is captured through a bounded writer.

Excess output is discarded after the configured limit and the result explicitly records `outputTruncated=true`, preventing a malicious workload from exhausting worker memory merely by writing unbounded logs.

CMP-3.4 does not yet persist or upload workload output; those responsibilities belong to later roadmap steps.

## Real isolation integration qualification

The app-specific fast workflow builds a tiny local static probe image using `FROM scratch`.

The image is built locally with no registry pull and is executed through the production `OSCommandRunner` sandbox backend by immutable Docker image ID.

From inside the sandbox the probe verifies:

1. effective UID is non-root;
2. the read-only root filesystem cannot be written;
3. the bounded `/tmp` tmpfs is writable;
4. Linux `NoNewPrivs` is set;
5. effective Linux capability mask is zero;
6. outbound network access is unavailable.

The probe must emit `cmp-sandbox-probe-ok` and exit zero.

This is a real container-isolation test, not a mocked command-line assertion.

## Security and adversarial boundary

CMP-3.4 rejects or prevents:

- mutable/unpinned images;
- root execution;
- privileged mode;
- added Linux capabilities;
- host networking;
- host PID/IPC namespaces;
- host volume/mount exposure;
- host devices;
- unrestricted writable root filesystems;
- unbounded process count;
- unbounded CPU/memory policy values;
- unbounded runtime;
- unbounded captured output;
- host-shell interpolation of customer command arguments.

The sandbox does not accept environment-variable injection, host path mounts, secret mounts, device mappings, network allowlists or privileged overrides at this step.

## Relationship to later roadmap steps

CMP-3.4 provides an isolation primitive only.

It deliberately does **not** implement:

- CMP-3.5 content-addressed work-unit download;
- CMP-3.6 execution lifecycle / attempt authorization;
- CMP-3.7 checkpointing/resume;
- CMP-3.8 result commitment;
- CMP-3.9 execution-key signed receipts;
- CMP-3.10 result/evidence upload;
- CMP-3.11 operator-configurable CPU/GPU/thermal/bandwidth/schedule controls;
- CMP-3.12 broader malicious-workload detection/response;
- CMP-3.13 OS packaging.

Later steps must call the sandbox rather than invent a direct host-execution bypass.

## Exit criteria

CMP-3.4 is complete when one exact implementation SHA proves all of the following:

1. customer command execution is only available through an explicit sandbox API;
2. supported OCI engines are allowlisted to Docker/Podman;
3. workload images must be immutable SHA-256 pinned references/IDs;
4. non-root execution is mandatory;
5. root filesystem is read-only;
6. all Linux capabilities are dropped;
7. no-new-privileges is mandatory;
8. network access is disabled by default and cannot be enabled by CMP-3.4 callers;
9. no host mounts, devices, host PID namespace or host IPC namespace are exposed;
10. CPU, memory and PID limits are mandatory and bounded;
11. writable scratch space is a bounded `noexec,nosuid,nodev` tmpfs;
12. every run has a finite timeout and timeout triggers best-effort forced cleanup;
13. captured output is bounded;
14. customer command arguments are passed without host-shell interpolation;
15. a real Docker/scratch integration probe proves non-root, read-only rootfs, zero effective capabilities, no-new-privileges and no network egress from inside the sandbox;
16. CMP-3.1, CMP-3.2 and CMP-3.3 regressions remain green;
17. targeted Go tests, vet, build, real sandbox integration and CMP-3.4 mechanical verifier pass on the same exact implementation SHA.

## Qualification model

CMP-3.4 is **Level 1**.

Required Level 1 owner: **Compute Worker Fast Qualification**.

Although this is a security-significant runtime boundary, it does not modify a shared protocol authority or require cross-app state integration. The real backend isolation probe is therefore included directly in Level 1 rather than escalating to repository-wide qualification.

Level 2 is not required at this step. A later runtime milestone may run broader retained app integration after work download/execution lifecycle converge.

Level 3 remains reserved for **CMP-3.14 — Phase closeout**, including full reconciliation with then-current `main`.

## Limitations

- The qualified production backend in CI is Docker on Linux; Podman command construction is unit-qualified but no Podman daemon is required by CI.
- CMP-3.4 provides no outbound network allowlist: networking is entirely disabled, which is the fail-closed subset of the architecture requirement.
- No GPU device is exposed in this step.
- No host directory or secret mount is exposed in this step.
- Platform-specific installation/service packaging remains CMP-3.13.

## Formal next step

Next canonical step: **CMP-3.5 — Content-addressed work-unit download**.
