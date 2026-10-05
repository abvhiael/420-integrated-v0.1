# CMP-3.3 — Benchmarking and capability evidence qualification evidence

Status: **COMPLETE**

## Roadmap step

- Step: **CMP-3.3 — Benchmarking and capability evidence**
- Qualification level: **Level 1**
- Milestone relationship: ordinary CMP-3 step; Level 2 not required
- Level 3: deferred to **CMP-3.14 — Phase closeout**

## Qualified implementation

- Evidence anchor SHA: `5910c6f9100b5d2e02159861a5bac94561149d9b` (creation commit for this durable evidence record)

- Implementation SHA: `0f7a5a1c3bf40308f4ab029594454f3ab7ff8795`
- Current `main` at qualification: `7a20e806635cc4eab784118628c2505f74632b75`
- Audit branch: `cmp-3.1-worker-daemon-20261004`
- Pull request: **#512 — CMP-3: node420 compute worker runtime**
- Branch divergence at qualification: **41 commits ahead / 64 behind** current `main`
- Merge base: `2280fb6f9915b849560d9d4d5a95d999c4adc669`

The 64 behind commits did not change the shared CMP-3.3 capability/provenance dependency surfaces. The following files had identical blobs between current `main` and the CMP-3 branch during gap analysis:

- `contracts/src/compute/ComputeWorkerAttestation420.sol`;
- `contracts/src/compute/ComputeWorkerCapabilityProfile420.sol`;
- `docs/compute-market/CMP-1.3.11-HARDWARE-PROVENANCE-QUALIFICATION.md`;
- `docs/compute-market/CMP-1.3.0-WORKER-REGISTRY-BASELINE-AND-INTEGRATION-DESIGN.md`.

Per the phase qualification model, full branch reconciliation remains reserved for CMP-3.14 unless a changed shared dependency requires earlier reconciliation.

## Implementation summary

CMP-3.3 adds bounded provider-neutral local benchmarking and deterministic content-addressed capability evidence.

Implementation/qualification surfaces:

- `compute/worker/benchmark.go`;
- `compute/worker/benchmark_test.go`;
- `execution/cmd/node420-compute/main.go`;
- `.github/workflows/compute-worker-fast.yml`;
- `scripts/verify-cmp-3-3-benchmarking-capability-evidence.py`;
- `docs/compute-market/CMP-3.3-BENCHMARKING-CAPABILITY-EVIDENCE.md`;
- `docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md`.

The benchmark runner measures:

- deterministic SHA-256 CPU byte throughput;
- deterministic in-memory copy byte throughput.

The evidence envelope binds:

- evidence schema/version;
- the canonical benchmark-evidence type preimage;
- generation time;
- the exact CMP-3.2 discovery snapshot commitment;
- the exact benchmark result commitment;
- deterministic sorted local capability claims;
- the benchmark result itself;
- a full evidence commitment.

All commitments are SHA-256 values serialized as `0x` + 64 hexadecimal characters for bytes32-compatible downstream provenance use.

## Requirements satisfied

1. Bounded local provider-neutral benchmark execution.
2. Explicit CPU and memory work/duration/throughput metrics.
3. Fail-closed benchmark configuration bounds.
4. Deterministic benchmark input bytes independent of customer data.
5. No network access, external tool execution, customer workload execution or protocol-state mutation.
6. Versioned capability-evidence schema aligned to the canonical benchmark evidence-type preimage.
7. Deterministic bytes32-compatible discovery, benchmark and evidence commitments.
8. Exact CMP-3.2 discovery snapshot binding.
9. Tamper detection and cross-host discovery substitution rejection.
10. Explicit `authoritative=false`, `independentlyAttested=false`, and `resultCorrectnessEvidence=false`.
11. Deterministic capability claims derived from discovery facts and measured throughput.
12. `node420-compute --benchmark` outputs capability-evidence JSON and exits before daemon startup.
13. `--discover` and `--benchmark` are mutually exclusive.
14. CMP-3.1 and CMP-3.2 remain regression-qualified.

## Authority and provenance boundary

Repository truth already provides trusted capability provenance through `ComputeWorkerAttestation420`.

CMP-3.3 worker evidence is intentionally self-reported. It does not:

- sign as an independent attester;
- become canonical eligibility solely because it exists;
- prove job-result correctness;
- create verifier authority;
- create payment/settlement entitlement;
- grant worker/resource lifecycle authority;
- grant custody, staking, slashing, governance, bridge, validator or wallet authority.

Independent attester publication/signature, policy acceptance and exact worker/resource/profile/key binding remain separate canonical provenance operations.

## Security/adversarial/boundary coverage

Targeted tests prove:

- zero/undersized/oversized benchmark configurations fail closed;
- zero-duration metrics fail closed;
- a small real benchmark produces positive bounded metrics;
- capability evidence is content-addressed and explicitly non-authoritative;
- benchmark tampering invalidates evidence;
- a different discovery snapshot invalidates evidence;
- authority escalation is rejected;
- deterministic identical inputs produce identical commitments;
- capability claims are deterministically ordered;
- the serialized evidence does not contain private-key/wallet/validator/job-correctness/verified-result authority tokens.

The mechanical verifier additionally rejects benchmark implementation paths that invoke external commands, network calls, environment dumps, vendor-specific benchmark tools, or private-key semantics.

## Exact-head Level 1 qualification

Required owner: **Compute Worker Fast Qualification**

- Workflow run number: **#35**
- GitHub Actions run ID: `37250495294`
- Job ID: `111576940200`
- Qualified implementation SHA: `0f7a5a1c3bf40308f4ab029594454f3ab7ff8795`
- Result: **SUCCESS**

Passing exact-head checks:

- checkout exact qualification head — PASS;
- verify exact qualification head — PASS;
- `go test ./compute/worker` — PASS;
- `go test ./execution/cmd/node420-compute` — PASS;
- `go vet ./compute/worker ./execution/cmd/node420-compute` — PASS;
- `go build ./execution/cmd/node420-compute` — PASS;
- CMP-3.1 daemon regression verifier — PASS;
- CMP-3.2 hardware/software discovery regression verifier — PASS;
- CMP-3.3 benchmarking/capability evidence verifier — PASS.

### Superseded failed run

Compute Worker Fast Qualification **#33**, run `37250446030`, job `111576800624`, on superseded SHA `ed53e9f4c4c0849813ad9029ee04232e3a4f67b9` failed in the worker-runtime build stage because of a Go line-break syntax error in the capability-evidence commitment comparison.

That deterministic implementation defect was diagnosed and corrected. The failed run is not counted as qualification evidence.

## Intentionally deferred

- independent attester signature/publication of benchmark provenance;
- TEE/device attestation and operator-inspection issuance;
- GPU/vendor-specific performance adapters where a provider-neutral implementation is not yet available;
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
- comprehensive Level 3 reconciliation and repository qualification at CMP-3.14.

No live/testnet dependency is required for CMP-3.3.

## Evidence-only closeout rule

The commit creating this evidence record and subsequent status/roadmap closeout commits are documentation-only. They change no executable source, tests, workflows, dependencies, configuration, generated/runtime artifacts, interfaces, deployment state, or substantive requirements. They therefore reference the qualified implementation SHA above without recursively creating a new Level 1 implementation SHA.

## Formal status

**CMP-3.3 — Benchmarking and capability evidence: COMPLETE.**

Next canonical step: **CMP-3.4 — Secure workload sandbox**.
