# CMP-7.9 — CLI

Status: **IMPLEMENTED — Level 1 + second/final CMP-7 Level 2 milestone qualification pending.**

## Canonical purpose

Expose the roadmap's `compute submit`, `worker`, `status`, `verify` and `rewards` developer commands without introducing a CLI keystore or parallel protocol authority.

## Commands

- `420 compute submit REQUEST_JSON --compute-api URL` — sends a canonical request envelope to the Compute job API and accepts only a `READY_FOR_WALLET_AUTHORIZATION` unsigned plan.
- `420 compute worker WORKER_ID` — chain-scoped non-authoritative Indexer worker projection.
- `420 compute status JOB_ID` — chain-scoped non-authoritative job projection.
- `420 compute verify JOB_ID` — summarizes verifier/decision fields from the indexed canonical job projection.
- `420 compute rewards REWARD_ID` — chain-scoped useful-reward accounting projection.

The CLI rejects malformed IDs, cross-chain submission envelopes, unsafe submission plans and any Indexer record claiming authoritative state.

## Level 2 milestone

CMP-7.9 is the final CMP-7 app-integration milestone. The retained SDK, Compute API, 420Indexer and CLI suites must all pass on the same exact SHA. Repository-wide Level 3 remains reserved for CMP-7.10.

## Next canonical step

**CMP-7.10 — Phase closeout**
