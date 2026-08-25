
# Step 4.8 — Production Dependency Integration and Qualification

Status: **LOCAL QUALIFICATION IMPLEMENTED; EXTERNAL PRODUCTION GATES REMAIN EVIDENCE-BASED**

## Live Engine payload smoke

`integration/cmd/engine-live-smoke` performs a real execution path against node420:
1. query execution genesis through JSON-RPC;
2. exchange Engine capabilities;
3. send `forkchoiceUpdatedV3` with payload attributes;
4. receive a payload ID;
5. call `getPayloadV3`;
6. submit the payload through `newPayloadV3`;
7. advance Engine fork choice to the returned execution block.

The smoke test is wired into `scripts/live-engine-smoke.sh`.

## Partition qualification

The deterministic TCP devnet broker now supports static partitions.

Required local cases:
- 8/7 split: neither partition can reach 11-of-15, therefore **no QC**;
- 11/4 split: the 11-validator partition can certify while the 4-validator partition cannot.

These tests validate the frozen quorum denominator: partitioning does not reduce N.

## Fault matrix

`scripts/run-fault-matrix.py` exercises:
- 15 healthy;
- exactly 11 live;
- 10 live;
- primary unavailable;
- primary + FB1 unavailable;
- 8/7 partition;
- 11/4 partition;
- restart recovery.

Results are written to `qualification/fault-matrix.json`.

## Accelerated soak

`scripts/run-soak.py` runs an extended 15-process accelerated local network and requires finality to
advance through at least 80% of requested slots. Results are written to `qualification/soak.json`.

This is a local logic/process soak, not a substitute for a wall-clock production-network soak.

## Production dependency pipeline

On a networked runner:
- `blst` v0.3.16;
- go-libp2p v0.49.0;
- go-libp2p-pubsub v0.17.0;
- pinned Geth v1.17.5.

`install-production-deps.sh` compiles BLS, libp2p and combined-tag builds.
`qualify-networked.sh` builds the pinned execution binary and runs live Engine qualification.

A GitHub Actions workflow is included at `.github/workflows/qualification.yml`.

## Evidence-based readiness

`release/readiness.json` no longer infers production success from the existence of source adapters.
External gates require explicit CI/release evidence markers.

The public-testnet flag remains false until:
- production BLS compiled/tested;
- production libp2p compiled/tested;
- live Engine payload smoke passed;
- 15 real execution/consensus pairs passed;
- production fault/partition/restart matrix passed;
- production soak passed.

No mock or deterministic TCP result can by itself flip those gates.
