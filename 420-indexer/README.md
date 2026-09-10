# 420Indexer

420Indexer is the canonical off-chain projection service for 420 Integrated. It consumes chain data through a transport-neutral `ChainSource420` interface and builds rebuildable query projections without becoming protocol authority.

## IDX-0 — foundation — complete

Transport-neutral source contracts, explicit chain identity, finality rules, canonical checkpoints, deterministic logs, and fail-closed reorg detection.

## IDX-1 — EVM ingestion core — complete

Standard EVM JSON-RPC ingestion, bounded sequential backfill, durable checkpoint abstractions, confirmation-safe heads, chain-ID validation, and restart-safe replay.

## IDX-2 — reorg/finality engine — complete

Canonical-history retention, nearest-common-ancestor recovery, rollback/replay contracts, finalized block-tag support, configurable reorg depth, and fail-closed deep-reorg handling.

## IDX-3 — durable core projections — complete

Durable SQL projections for blocks, transactions, receipts, addresses/contracts, canonical logs, and checkpoints. Ingestion batches include full transactions and receipts, while projection writes are transactional and reorg rollback removes block-scoped rows above the chosen ancestor.

## IDX-4 — asset projections — complete

Native `$420`, ERC-20, ERC-721, and ERC-1155 transfer decoding; normalized asset identities; durable asset/transfer/balance projections; metadata surfaces; mint/burn semantics; and reorg-safe balance rebuilding.

## IDX-5 — genesis protocol projections

IDX-5 introduces a manifest-driven decoder and projection boundary for genesis-resident protocol events.

Implemented in the first IDX-5 increment:

- descriptor-driven event decoding keyed by `topic0`;
- deterministic indexed/data-word decoding for bytes32, address, uint256, and bool fields;
- collision detection for conflicting topic descriptors;
- normalized protocol/event identity and canonical chain ordering metadata;
- durable `idx_protocol_events` SQL projection with protocol/event/contract indexes;
- idempotent writes keyed by canonical block/transaction/log identity;
- bounded rollback of protocol events during reorg recovery;
- explicit genesis protocol catalog covering 420Registry, 420Names, 420Identity, 420Stake, 420Governance, 420Treasury, 420Pay, 420Swap, 420Exchange, 420Bridge, 420Rights, and 420Randomness;
- tests for deterministic decoding, unknown-event rejection, persistence, and rollback.

The decoder intentionally consumes deployment/ABI-derived event descriptors rather than hard-coding protocol state assumptions. This preserves the frozen 420 event-standard rule that events are auditable projections and never substitutes for authoritative contract state.

## Authority boundary

420Indexer is never authoritative for balances, ownership, registrations, settlements, rights, governance outcomes, bridge state, or protocol eligibility. Those remain canonical on-chain. All indexed views are rebuildable from canonical chain history plus deployment and ABI manifests.

## RPC dependency

420Indexer does not depend on a dedicated 420RPC implementation. It consumes conventional EVM JSON-RPC behind `ChainSource420`. A future 420RPC adapter can satisfy the same source contract without changing indexing semantics.

## Next phase

Complete IDX-5 by generating concrete descriptor manifests from the genesis deployment ABI set and adding protocol-specific materialized views for Registry, Names, Identity, Stake, Governance, Treasury, Pay, Swap/Exchange, Bridge, Rights, Randomness, and the remaining genesis-resident event surfaces.
