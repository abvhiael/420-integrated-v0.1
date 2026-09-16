# ANALYTICS-1 — Qualified 420Indexer consumer

420Analytics consumes canonical-chain projections only through the qualified 420Indexer public API.

## Boundary

- no direct `node420` RPC;
- no independent ingestion, checkpointing, finality tracking, reorg processing, or protocol decoding;
- exact chain ID binding on all qualified reads;
- health, readiness, and status must all pass before Analytics treats the upstream projection as qualified;
- Indexer must remain explicitly non-authoritative;
- stale, future-dated, malformed, wrong-chain, unavailable, or not-ready upstream state fails closed;
- Analytics snapshots preserve chain ID, indexed height, indexed head hash, safe height, and indexed timestamp;
- protocol objects are fetched only through the documented versioned Indexer v1 protocol-object route.

Analytics may derive metrics from these projections in later phases, but those metrics never become canonical protocol truth.
