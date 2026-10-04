# CMP-3.2 — Hardware/software discovery qualification evidence

Status: **COMPLETE**

## Roadmap step

- Step: **CMP-3.2 — Hardware/software discovery**
- Qualification level: **Level 1**
- Milestone relationship: ordinary CMP-3 step; Level 2 not required
- Level 3: deferred to **CMP-3.14 — Phase closeout**

## Qualified implementation

- Implementation SHA: `a111b1d63083ccffa8a5afacd9529728ce0a2eab`
- Base/current `main`: `2280fb6f9915b849560d9d4d5a95d999c4adc669`
- Audit branch: `cmp-3.1-worker-daemon-20261004`
- Pull request: **#512**
- Branch divergence at qualification: **27 commits ahead / 0 behind** before the final verifier-durability commit; `main` remained unchanged during qualification.

## Implementation summary

CMP-3.2 adds a local, read-only and explicitly non-authoritative discovery snapshot for the compute worker.

Changed implementation/qualification surfaces include:

- `compute/worker/discovery.go`
- `compute/worker/discovery_test.go`
- `execution/cmd/node420-compute/main.go`
- `.github/workflows/compute-worker-fast.yml`
- `scripts/verify-cmp-3-1-worker-daemon.py`
- `scripts/verify-cmp-3-2-hardware-software-discovery.py`
- `docs/compute-market/CMP-3.2-HARDWARE-SOFTWARE-DISCOVERY.md`
- `docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md`

The broad Compute Market workflow was restored to its pre-CMP-3 scope and a dedicated exact-head **Compute Worker Fast Qualification** workflow now owns ordinary CMP-3 Level 1 checks.

## Requirements satisfied

1. Versioned local worker discovery schema.
2. Portable OS, architecture, logical CPU and software-runtime inventory.
3. Linux CPU-model and physical-memory discovery.
4. Linux coarse graphics/accelerator PCI vendor/device discovery.
5. Allowlisted relevant software-presence discovery without executing discovered tools.
6. Deterministic accelerator ordering and visible malformed/missing optional data.
7. Explicit `authoritative=false` and `benchmarkEvidence=false`.
8. No on-chain identity requirement for local discovery.
9. No scheduler, execution, correctness, custody, settlement, governance, validator, bridge or wallet authority.
10. No username/home/environment/network-address/device-serial/private-key collection.
11. `node420-compute --discover` emits JSON and exits before daemon startup.
12. CMP-3.1 lifecycle behavior remains regression-qualified.

## Exact-head Level 1 qualification

Required owner: **Compute Worker Fast Qualification**

- Workflow run number: **#13**
- GitHub Actions run ID: `37243425378`
- Job ID: `111556506389`
- Qualified SHA: `a111b1d63083ccffa8a5afacd9529728ce0a2eab`
- Result: **SUCCESS**

Passing exact-head checks:

- checkout exact qualification head — PASS;
- verify exact qualification head — PASS;
- `go test ./compute/worker` — PASS;
- `go test ./execution/cmd/node420-compute` — PASS;
- `go vet ./compute/worker ./execution/cmd/node420-compute` — PASS;
- `go build ./execution/cmd/node420-compute` — PASS;
- CMP-3.1 daemon regression verifier — PASS;
- CMP-3.2 hardware/software discovery verifier — PASS.

Two earlier superseded fast runs exposed stale verifier bookkeeping after CI ownership/status changes. Their runtime tests/builds passed, but they are **not** used as qualification evidence. The exact-head run above is authoritative.

## Security/adversarial/boundary results

- malformed memory input fails visibly;
- numeric processor indices are not misclassified as CPU models;
- graphics device enumeration ignores connector-style DRM entries and sorts numerically;
- detected tool filesystem paths are not emitted;
- discovery does not execute discovered tools;
- local discovery does not claim benchmark or canonical capability evidence;
- sensitive host/network/credential identifiers are outside the schema.

## Intentionally deferred

- **CMP-3.3** benchmarking and capability evidence;
- secure workload sandboxing and all workload execution lifecycle work;
- checkpointing, commitments, execution-key receipts and evidence upload;
- local resource controls and malicious workload protections;
- Windows/Linux/macOS production packaging;
- Level 3 repository-wide qualification until **CMP-3.14**.

No live/testnet dependency is required for CMP-3.2.

## Evidence-only closeout rule

The commits that add this durable evidence and change CMP-3.2 documentation/roadmap status to COMPLETE are evidence-only. They do not alter executable source, tests, workflows, dependencies, configuration, interfaces, deployment state, generated/runtime artifacts, or substantive requirements. They therefore reference the already-qualified implementation SHA above without recursively creating a new implementation qualification requirement.

## Formal status

**CMP-3.2 — Hardware/software discovery: COMPLETE.**

Next canonical step: **CMP-3.3 — Benchmarking and capability evidence**.
