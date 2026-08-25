# 420 Integrated — Step 4 executable construction

This tree is the first executable implementation scaffold following frozen Decisions 1–18.

## Step 4.1 status

Implemented:
- Go module skeleton;
- `fourtwentyd` executable scaffold;
- `node420` executable-wrapper scaffold;
- go-ethereum baseline pin metadata;
- protocol timing constants;
- slot/epoch/rotation clock;
- deterministic genesis allocation validator;
- repository/module boundaries;
- starter unit tests and Makefile.

Not yet implemented:
- full Geth-derived `node420`;
- Engine API payload flow;
- SSZ consensus containers;
- BLS signing/QCs;
- libp2p networking;
- validator state machine;
- fork choice/finality;
- rewards/system calls;
- randomness/slashing/recovery.

## Build

```sh
make build
make test
make genesis-check

./bin/fourtwentyd --version
./bin/fourtwentyd --protocol
./bin/node420 --version
```

## Pinned execution baseline

go-ethereum `v1.17.5`.

The pin is intentionally an exact release tag, not upstream master.

## Native AI genesis preparation

Step 4.2A encodes the `420ai` role and reserves the native AI provider/model/job/escrow/reputation
interfaces at genesis. AI compute remains off-chain and is never required for consensus liveness.

## Step 4.3

Canonical consensus containers, BLS12-381 signing/PoP/aggregation, 15-seat QCs, chained finality,
and execution-payload binding are implemented and covered by tests.

## Step 4.4

Validator seats, deterministic primary/FB1/FB2 scheduling, attestation collection, QC assembly,
local slashing protection, and a 15-validator in-process consensus simulation are implemented.

## Step 4.6

Devnet hardening adds QC deduplication, persistent consensus state, restart recovery, Engine
fork-choice propagation through an explicit sink, and 11/15 vs 10/15 live-quorum tests.

## Step 4.7

Real-execution devnet packaging includes a candidate post-Merge 420 execution genesis, node420
genesis initialization/version verification, live Engine fork-choice sink, fifteen execution/
consensus deployment pairs, and a machine-readable public-testnet readiness gate.

## Step 4.8

Qualification now includes a live Engine V3 payload-smoke client, partition-aware 15-node fault
matrix, accelerated soak runner, networked production dependency build pipeline, CI workflow, and
an evidence-based public-testnet gate that cannot be satisfied by mock results.

## Step 4.9

The project now has a formal TESTNET_RC release channel, evidence-gated qualification records,
a real fifteen execution/consensus pair launcher, reproducible RC packaging and checksums, and a
networked CI workflow. Public testnet readiness remains false until every formal gate passes.
