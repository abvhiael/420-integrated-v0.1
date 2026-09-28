# EXP-1.6 — Historical block-producer attribution

EXP-1.6 closes the repository/runtime gap behind historical validator-produced block attribution without changing the trust boundary: consensus remains canonical authority, while 420Indexer stores and exposes a non-authoritative projection.

## Authority and join

Consensus persistence now carries a `produced_blocks` history. Each record binds an execution block hash to the consensus slot, producer seat, proposer rank, consensus block root, and certification state. Indexer joins by execution block hash. It does not infer the producer from execution coinbase, fee recipient, or the current proposer schedule.

Historical producer records are validated independently from the current active committee because older canonical blocks can legitimately belong to prior rotations. Duplicate execution hashes, duplicate canonical slots, empty consensus roots, and proposer ranks outside 0–2 are rejected.

## Ingestion and persistence

Production `indexer420` wires the qualified `consensusview.Provider` into the ingest engine. Every non-genesis block ingested with a configured producer provider must have a historical attribution record or ingestion fails closed. The projection is stored inline on the canonical `BlockRecord`, so existing block APIs expose the provenance without inventing a second authority.

The durable file store persists producer provenance across restart.

## Reorg safety

Reorg repair now prefetches and validates the complete replacement branch—including producer attribution—before deleting any local blocks. If any replacement block lacks producer history or has invalid history, no rollback occurs. After successful preflight, orphan blocks and their producer projections are removed together and the replacement fork is replayed with its own consensus provenance.

## Qualification boundary

This step qualifies the repository/runtime implementation. It does not claim that a live testnet consensus history feed is provisioned. EXP-FIND-009's implementation gap is remediated here; the live-network evidence portion remains pending until the approved testnet consensus source supplies produced-block history.

Exact-head CI must pass the retained EXP-1.1–1.5 suite, new EXP-1.6 verifier, Go tests/vet, Docker build, and deployment manifest validation on the same SHA before marking EXP-1.6 COMPLETE.
