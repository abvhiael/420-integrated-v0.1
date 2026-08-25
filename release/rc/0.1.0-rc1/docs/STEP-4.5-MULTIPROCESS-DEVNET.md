
# Step 4.5 — Multi-process Local Devnet and Consensus Transport

Status: **EXECUTABLE LOCAL DEVNET IMPLEMENTED; PRODUCTION LIBP2P ADAPTER ENCODED**

## Production networking

Pinned:
- go-libp2p v0.49.0
- go-libp2p-pubsub v0.17.0

Production topics:
- `/420/consensus/1/block`
- `/420/consensus/1/attestation`
- `/420/consensus/1/qc`
- `/420/consensus/1/heartbeat`
- `/420/consensus/1/status`
- `/420/consensus/1/randomness`
- `/420/consensus/1/evidence`
- `/420/consensus/1/recovery`

The libp2p/GossipSub adapter is behind the `libp2p` build tag because this runtime cannot fetch external
Go modules. It implements the same `p2p.Transport` interface used by consensus.

## Executable devnet transport

For deterministic local CI, Step 4.5 includes a TCP broker transport. It is explicitly non-production.
Its purpose is to run independent OS processes and exercise the consensus message boundary without
depending on external modules.

## 15-process devnet

`scripts/run-devnet15.py` launches:
- one local devnet message bus;
- 15 independent `fourtwentyd --devnet-validator` processes;
- one validator identity/seat per process.

The accelerated local slot clock defaults to 250ms for tests. Mainnet remains 12 seconds.

Fault flags:
- `--primary-down`
- `--fb1-down`

These force the deterministic proposal path to exercise FB1 and FB2 respectively.

## Scope

This milestone validates multi-process proposal, attestation, QC broadcast, and finality observation.
It does not yet claim:
- production libp2p dependencies compiled in this sandbox;
- 15 real node420/Geth processes;
- production BLS signatures;
- full fork-choice/lock rules under arbitrary partitions.

Those are subsequent devnet-hardening tasks.
