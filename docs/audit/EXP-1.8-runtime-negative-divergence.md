# EXP-1.8 — Runtime negative and divergence qualification

EXP-1.8 makes the runtime fail-closed properties from EXP-1.1 through EXP-1.7 continuous rather than startup-only or unit-test-only.

## Continuous source qualification

The production Indexer now runs the existing EXP-1.2 RPC validator before the first catch-up and before every polling-cycle catch-up. It verifies chain ID 420, genesis identity when a frozen hash is configured, head/safe/finalized identities, finality ordering and head freshness. The default head freshness window is two minutes and can be overridden with `INDEXER_MAX_HEAD_AGE`. `INDEXER_EXPECTED_GENESIS_HASH` is the deployment hook for the frozen testnet genesis hash once that live binding exists.

A failed runtime RPC qualification does not mutate the last known indexed checkpoint. It latches a categorical degraded state. Consensus-provider failure and catch-up failure use the same runtime-health latch. The latch is cleared only after a qualified RPC source, qualified consensus provider and successful catch-up complete in the same poll.

## Public observability and safety

`/v1/health` now reports a categorical `runtimeIssue` and issue time while preserving the last known indexed/safe/finalized heights. Raw upstream error strings are not exposed publicly. Explorer treats the degraded Indexer state as not ready and maps wrong-chain, stale, degraded and inconsistent-finality conditions to fail-closed operational responses.

## Negative/divergence matrix

Exact tests cover wrong chain, genesis mismatch, stale head, malformed/missing source identity, execution finality divergence, consensus finality divergence, bad QC, invalid proposer membership, unavailable consensus state, duplicate or malformed historical producer records, missing producer attribution, finalized reorg conflict, replacement-fork producer preflight failure, Explorer stale/degraded/wrong-chain/inconsistent states, unavailable consensus API, and malformed or missing cross-layer trace provenance.

## Qualification boundary

This step qualifies source-level and production-runtime negative behavior in the repository. It does not claim a live testnet fault-injection exercise because the approved testnet execution and consensus sources are still unprovisioned. That production-equivalent exercise remains a later deployment/operations gate.

Exact-head CI must pass the retained EXP-1.1–1.7 gates, the full Indexer and Explorer Go suites, the EXP-1.8 verifier, production binary/container builds, deployment manifest validation, and the retained repository-wide suites before EXP-1.8 is marked COMPLETE.
