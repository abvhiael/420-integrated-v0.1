# CMP-3.2 — Hardware/software discovery

Status: **COMPLETE — Level 1 exact-head qualified on `a111b1d63083ccffa8a5afacd9529728ce0a2eab`.**

## Canonical definition

**Hardware/software discovery.**

CMP-3.2 extends the CMP-3.1 worker daemon with a local, read-only discovery snapshot that lets an operator inspect the worker host before later benchmarking, capability evidence, sandbox execution, scheduling, or workload execution exists.

Discovery is descriptive only. It does not establish canonical resource eligibility, benchmark truth, attestation, pricing authority, scheduling authority, verification correctness, or permission to execute a workload.

## Implementation

- `compute/worker/discovery.go`
  - schema: `420-compute-worker-discovery-v1`;
  - portable runtime baseline: operating system, architecture, logical CPU count, Go runtime and executable basename;
  - Linux local probes: CPU model, total physical memory, graphics/accelerator PCI vendor/device identifiers;
  - deterministic, allowlisted software-presence probes for `docker`, `podman`, `runc`, `wasmtime`, and `nvidia-smi`;
  - explicit `authoritative=false` and `benchmarkEvidence=false`;
  - partial platform/probe failures remain visible through warnings rather than being silently promoted into claims.
- `execution/cmd/node420-compute/main.go`
  - `--discover` prints the local discovery snapshot as JSON and exits;
  - discovery does not require chain/provider/node/resource/worker identity because it does not perform an on-chain action or claim canonical eligibility.
- `compute/worker/discovery_test.go`
  - portable non-authority boundary;
  - CPU parsing;
  - memory parsing and malformed-input failure;
  - deterministic accelerator parsing/sorting;
  - software-tool allowlist and path-redaction behavior;
  - sensitive host-identifier boundary.
- `.github/workflows/compute-worker-fast.yml`
  - exact-head CMP-3 Level 1 owner;
  - worker package tests, command tests, `go vet`, build, CMP-3.1 regression verifier and CMP-3.2 verifier.

## Privacy and security boundary

CMP-3.2 intentionally does **not** collect:

- usernames or home-directory paths;
- environment variables;
- MAC or IP addresses;
- disk, motherboard, GPU or device serial numbers;
- private keys, wallet material, validator material or credentials;
- workload inputs/outputs;
- benchmark scores;
- signed capability evidence.

The accelerator inventory exposes only coarse local graphics device index plus PCI vendor/device identifiers when Linux DRM sysfs provides them.

Tool discovery uses executable presence lookup only. It does not execute Docker, Podman, runc, Wasmtime, NVIDIA utilities, or any customer-controlled command.

## Cross-platform boundary

All supported Go platforms expose the portable runtime baseline. Linux additionally supplies the local `/proc` and DRM sysfs probes above.

CMP-3.13 remains responsible for Windows/Linux/macOS packaging and platform-specific production installation/operation. CMP-3.2 does not claim equivalent rich OS-native probes on every platform.

## Exit criteria

CMP-3.2 is complete when one exact implementation SHA proves all of the following:

1. the worker can emit a versioned local hardware/software discovery snapshot;
2. the snapshot contains portable OS/architecture/logical-CPU/software-runtime data;
3. Linux discovery safely parses CPU model and physical memory when available;
4. Linux discovery safely enumerates coarse graphics/accelerator PCI identifiers when available;
5. relevant local software presence is discovered without executing those tools and without leaking their filesystem paths;
6. missing or malformed optional platform data is explicit and cannot become a false capability claim;
7. the snapshot is explicitly non-authoritative and contains no benchmark evidence;
8. discovery requires no on-chain identity and grants no scheduler, execution, verification, custody, settlement, governance, validator, bridge or wallet authority;
9. discovery does not collect sensitive host/network/credential identifiers listed above;
10. `node420-compute --discover` emits JSON and exits without starting the daemon;
11. targeted Go tests, vet, build and mechanical verifier pass on the same exact implementation SHA;
12. CMP-3.1 daemon behavior remains regression-qualified.

## Qualification evidence

- Implementation SHA: `a111b1d63083ccffa8a5afacd9529728ce0a2eab`
- Compute Worker Fast Qualification: **#13**
- Run ID: `37243425378`
- Job ID: `111556506389`
- Result: **SUCCESS**
- Durable evidence anchor: `822877d010f38cc16d2fb15b529b11fd765f6ef7`
- Evidence record: [CMP-3.2 qualification evidence](CMP-3.2-QUALIFICATION-EVIDENCE.md)

## Qualification model

CMP-3.2 is an ordinary **Level 1** step.

Required Level 1 owner: **Compute Worker Fast Qualification**.

Level 2 is not required here. A later CMP-3 milestone may run broader retained worker-runtime integration when multiple runtime components materially converge.

Level 3 remains reserved for **CMP-3.14 — Phase closeout**, after reconciliation with current `main`.

## Deliberately deferred

- CMP-3.3 — benchmarking and capability evidence;
- CMP-3.4 — secure workload sandbox;
- CMP-3.5 — content-addressed work-unit download;
- CMP-3.6 — execution lifecycle;
- CMP-3.7 — checkpointing/resume;
- CMP-3.8 — result commitment;
- CMP-3.9 — execution-key signed receipt;
- CMP-3.10 — result/evidence upload;
- CMP-3.11 — local resource controls;
- CMP-3.12 — malicious workload protections;
- CMP-3.13 — Windows/Linux/macOS packaging;
- CMP-3.14 — Level 3 phase closeout.

Next canonical step: **CMP-3.3 — Benchmarking and capability evidence**.
