# CMP-3.1 — Worker daemon

Status: **COMPLETE — Level 1 exact-head qualified on `01badf4cb9302841a00905fdfadda44224bfdd3e`.**

## Canonical definition

CMP-3.1 establishes the process-lifecycle foundation for the node420 compute worker runtime. It allows an ordinary machine to run a separately supervised compute-worker daemon without granting that daemon protocol authority or allowing it to execute customer workloads yet.

The controlling roadmap defines CMP-3.1 only as **Worker daemon**. Hardware/software discovery, benchmarking, sandboxing, workload download, execution lifecycle, checkpointing, result commitments, execution-key receipts, evidence upload, local resource controls, malicious workload protections and packaging remain CMP-3.2 through CMP-3.13.

## Repository inventory and boundary

The pre-existing `execution/cmd/node420` binary is the pinned Geth execution wrapper with optional storage/cache/gateway services. It is not the Compute worker daemon and must not become a workload execution process.

CMP-3.1 adds a separate executable:

- `execution/cmd/node420-compute`

and a provider-neutral lifecycle package:

- `compute/worker`

This follows CMP-0.11: a general worker may run as an independent supervised service or separately opted-in node420 compute companion, while arbitrary customer code must never execute inside consensus, block-production, EVM-engine, validator-key, bridge or wallet processes.

## Exit criteria

CMP-3.1 is complete only when one exact implementation SHA demonstrates all of the following:

1. a dedicated compute-worker daemon executable exists independently of the Geth `node420` process;
2. startup configuration binds explicit chain, provider, node, resource and worker identifiers;
3. malformed or absent canonical identifiers fail closed before the daemon becomes ready;
4. worker state uses a private local directory rather than validator/wallet/Geth state by default;
5. the daemon exposes deterministic STARTING, READY, STOPPING and STOPPED lifecycle states;
6. SIGINT/SIGTERM cancellation propagates to all registered worker services;
7. unexpected service exit or service error cancels siblings and fails the daemon;
8. graceful shutdown has a bounded timeout and fails visibly if a service will not stop;
9. duplicate/nil/unnamed services and daemon-instance reuse are rejected;
10. CMP-3.1 does not execute, download, verify, sandbox or sign any customer workload;
11. no scheduler, matching, capacity-controller, custody, settlement, verifier, governance, validator, bridge or wallet authority is introduced;
12. targeted Go tests, command build and the CMP-3.1 mechanical verifier pass on the same exact SHA.

## Deliberately deferred

CMP-3.1 does **not** claim:

- on-chain provider→node→resource ancestry lookup or active-registration proof;
- hardware/software discovery;
- capability evidence or benchmarking;
- workload retrieval or content addressing;
- container/microVM/WASM isolation;
- workload execution or attempt lifecycle;
- checkpoint/resume;
- result commitments or execution-key signatures;
- result/evidence upload;
- CPU/GPU/thermal/bandwidth/schedule controls;
- malicious workload detection;
- Windows/Linux/macOS installers or service packaging.

Those belong to later canonical CMP-3 steps. The CMP-3.1 command therefore runs only a standby lifecycle service and prints an explicit notice that workload execution is disabled.

## Level 1 qualification

Qualified implementation SHA: `01badf4cb9302841a00905fdfadda44224bfdd3e`.

Authoritative GitHub evidence:

- Compute Market Qualification #213 — run `37240782332` — **SUCCESS**.
- The exact-head job verified the checked-out SHA before qualification.
- Retained Compute Market Solidity suite — **SUCCESS**.
- `go test ./compute/worker` — **SUCCESS**.
- `go test ./execution/cmd/node420-compute` — **SUCCESS**.
- `go build ./execution/cmd/node420-compute` — **SUCCESS**.
- `python scripts/verify-cmp-3-1-worker-daemon.py` — **SUCCESS**.

The contemporaneous 420Docs #4974 failure was outside CMP-3.1 scope: the documentation qualification reported pre-existing/unrelated orphan-navigation defects for `docs/apps/arbitration/deployment-operations.md` and `docs/apps/arbitration/threat-model.md`. It is recorded here for transparency and is not counted as a CMP-3.1 passing gate.

This closeout commit is documentation/evidence-only. It does not change executable code, workflows, configuration, interfaces, dependencies, deployment behavior, or substantive CMP-3.1 requirements, so it references the qualified implementation SHA without requiring a new implementation qualification.

Required CMP-3.1 Level 1 gates:

- `go test ./compute/worker`;
- `go test ./execution/cmd/node420-compute`;
- `go build ./execution/cmd/node420-compute`;
- `python scripts/verify-cmp-3-1-worker-daemon.py`;
- retained Compute Market qualification workflow on the exact PR head.

Level 2 is not required for this isolated runtime foundation. Level 3 remains reserved for CMP-3.14 phase closeout.

## Next canonical step

**CMP-3.2 — Hardware/software discovery**
