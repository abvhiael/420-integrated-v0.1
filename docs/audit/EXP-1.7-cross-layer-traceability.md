# EXP-1.7 — Cross-layer traceability

EXP-1.7 qualifies the end-to-end provenance path from canonical execution block to consensus producer history, through 420Indexer, into 420Explorer.

## Trace chain

The execution identity remains the chain ID plus execution block hash owned by node420. Consensus identity remains the consensus slot plus consensus block root owned by fourtwentyd. EXP-1.6 already persisted the consensus-produced block link on `BlockRecord.producer`; EXP-1.7 preserves that link through Explorer instead of dropping it at the presentation boundary.

Explorer block summaries now retain producer provenance. Block detail exposes a `trace` resource containing execution block hash, consensus block root, slot, producer seat, proposer rank, certification, finality, schema version, and explicit authority labels. `GET /v1/blocks/{number}/trace` exposes the same relationship as a dedicated API resource.

The web block-detail view renders the trace and explicitly labels node420, fourtwentyd and 420Indexer roles. Explorer and Indexer remain non-authoritative projections.

## Fail-closed behavior

For non-genesis blocks, Explorer rejects missing producer provenance, missing consensus block root, and proposer rank outside 0–2. Genesis is the sole producer-less exception.

## Qualification boundary

This step qualifies repository/runtime traceability. It does not claim a live testnet comparison witness. That remains blocked until approved execution and consensus endpoints are provisioned and representative live blocks can be compared across both sources.

Exact-head CI must pass retained EXP-1.1–1.6 gates, Indexer tests/vet, Explorer tests/vet, the EXP-1.7 verifier, production Indexer build/container validation, and repository-wide qualification on the same head.
