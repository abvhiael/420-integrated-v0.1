# CMP-3.3 — Benchmarking and capability evidence

Status: **IMPLEMENTED / LEVEL 1 QUALIFICATION PENDING**

## Canonical definition

**Benchmarking and capability evidence.**

CMP-3.3 extends CMP-3.2 discovery with bounded local performance measurement and a deterministic content-addressed capability-evidence envelope.

The worker may describe and benchmark itself, but that local evidence is **self-reported**. Trusted hardware eligibility remains a separate concern owned by the existing `ComputeWorkerAttestation420` provenance path. A local benchmark is never, by itself, an independent attestation, job-result correctness proof, verifier decision, or settlement authorization.

## Authoritative dependency boundary

Repository truth already provides the trusted capability/provenance layer:

- `ComputeWorkerCapabilityProfile420` stores bounded worker capability claims;
- `ComputeWorkerAttestation420` defines `EVIDENCE_BENCHMARK_V1`, versioned evidence schemas, content/source commitments, issuer provenance, replay protection, and exact worker/resource/profile/key binding;
- CMP-1.3.11 explicitly preserves the rule that benchmark/capability provenance is admission evidence and not job-result correctness.

CMP-3.3 does not alter those contracts or invent a second hardware oracle. It produces a worker-side evidence object that can later be independently reviewed, signed, stored, and referenced by those canonical surfaces.

## Implementation

### Provider-neutral benchmark runner

`compute/worker/benchmark.go` adds:

- schema `420-compute-worker-benchmark-v1`;
- bounded CPU SHA-256 throughput measurement;
- bounded in-memory copy throughput measurement;
- deterministic benchmark input bytes;
- explicit work-unit, elapsed-time, and units-per-second metrics;
- hard maximum buffer and iteration bounds;
- fail-closed handling for invalid/zero-duration measurements.

The default benchmark intentionally avoids network access, disk mutation, external command execution, vendor-specific GPU tools, customer workloads, and arbitrary code execution.

GPU/accelerator presence remains represented by CMP-3.2 discovery. CMP-3.3 does not fabricate a portable GPU throughput score when no provider-neutral in-process implementation exists.

### Capability evidence envelope

The same package adds schema `420-compute-worker-capability-evidence-v1`.

Every evidence record binds:

- evidence type preimage `420/COMPUTE/ATTESTATION/BENCHMARK/V1`;
- hash algorithm identifier `sha256`;
- generation timestamp;
- exact CMP-3.2 discovery snapshot commitment;
- exact benchmark result commitment;
- deterministic sorted capability claims;
- the complete benchmark result;
- an evidence commitment over the canonical preimage.

All commitments are emitted as `0x` + 64 lowercase hexadecimal characters so they are bytes32-compatible values for downstream provenance systems.

The envelope explicitly states:

- `authoritative=false`;
- `independentlyAttested=false`;
- `resultCorrectnessEvidence=false`.

`VerifyCapabilityEvidence` recomputes the discovery, benchmark and evidence commitments and rejects tampering, cross-host discovery substitution, schema drift, or authority escalation.

### CLI

`node420-compute --benchmark`:

1. performs CMP-3.2 local discovery;
2. runs the bounded provider-neutral benchmark;
3. builds the CMP-3.3 capability-evidence envelope;
4. prints formatted JSON;
5. exits without starting the worker daemon.

`--discover` and `--benchmark` are mutually exclusive.

No chain/provider/node/resource/worker identity is required for a purely local benchmark. Publishing or accepting that evidence into canonical trusted eligibility remains a separate independently authorized protocol action.

## Security and authority boundary

CMP-3.3 does **not**:

- execute customer code;
- start a container, microVM, WASM workload or sandbox;
- invoke Docker, Podman, runc, Wasmtime, `nvidia-smi`, or arbitrary binaries;
- access the network;
- mutate canonical worker/resource/capability state;
- sign as an attester;
- use a validator, wallet, Vault, bridge, governance or execution key;
- assert that local evidence is independently trusted;
- assert job-result correctness;
- create payment or settlement entitlement.

Benchmarks are deliberately bounded to avoid unbounded CPU/memory consumption.

## Privacy boundary

The benchmark evidence inherits CMP-3.2's privacy-minimized discovery schema. It contains no environment-variable dump, username, home directory, network address, device serial number, credential, private key, workload input/output, or customer data.

The discovery snapshot itself is committed into the evidence hash; substitution of another host snapshot invalidates verification.

## Exit criteria

CMP-3.3 is complete when one exact implementation SHA proves all of the following:

1. the worker can run a bounded provider-neutral benchmark locally;
2. CPU and memory measurements expose explicit work amount, elapsed time and throughput;
3. benchmark configuration rejects zero, undersized, oversized and excessive workloads;
4. benchmark inputs are deterministic and do not depend on customer data;
5. no benchmark path executes external tools, accesses the network, runs customer workloads, or mutates protocol state;
6. capability evidence is versioned and carries the canonical benchmark evidence-type preimage;
7. discovery, benchmark and full-evidence content commitments are deterministic and bytes32-compatible;
8. the evidence binds the exact CMP-3.2 discovery snapshot and detects cross-host substitution;
9. tampered benchmark metrics fail evidence verification;
10. local evidence is explicitly non-authoritative, independently unattested and not job-result correctness evidence;
11. deterministic capability claims include relevant discovery facts and measured throughput without broadening canonical resource authority;
12. `node420-compute --benchmark` emits capability evidence JSON and exits before daemon startup;
13. `--discover` and `--benchmark` cannot be requested simultaneously;
14. targeted Go tests, vet, build, CMP-3.1 regression, CMP-3.2 regression and CMP-3.3 mechanical verifier pass on the same exact SHA.

## Qualification model

CMP-3.3 is an ordinary **Level 1** roadmap step.

Required Level 1 owner: **Compute Worker Fast Qualification**.

This step introduces no changed shared contract or repository-wide dependency. The canonical capability/attestation contract blobs are identical between the CMP-3 branch and current `main` at the start of this work.

Level 2 is not required here. A later CMP-3 runtime convergence milestone may use broader retained worker integration.

Level 3 remains reserved for **CMP-3.14 — Phase closeout**, including reconciliation with then-current `main`.

## Deliberately deferred

- independent attester signing/publication of benchmark provenance;
- TEE/device attestation and operator inspection evidence issuance;
- CMP-3.4 secure workload sandbox;
- CMP-3.5 content-addressed work-unit download;
- CMP-3.6 execution lifecycle;
- CMP-3.7 checkpointing/resume;
- CMP-3.8 result commitment;
- CMP-3.9 execution-key signed receipt;
- CMP-3.10 result/evidence upload;
- CMP-3.11 local resource controls;
- CMP-3.12 malicious workload protections;
- CMP-3.13 Windows/Linux/macOS packaging;
- CMP-3.14 Level 3 phase closeout.

Next canonical step: **CMP-3.4 — Secure workload sandbox**.
