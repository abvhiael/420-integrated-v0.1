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

## IDX-4 — asset projections

IDX-4 adds normalized asset indexing for the chain's native currency and standard EVM token families.

Implemented in IDX-4:

- native `$420` value-transfer projection from canonical transactions;
- deterministic ERC-20 `Transfer` decoding;
- deterministic ERC-721 `Transfer` decoding using indexed token IDs;
- ERC-1155 `TransferSingle` decoding;
- ERC-1155 `TransferBatch` dynamic-array decoding;
- zero-address mint/burn semantics;
- normalized asset identity keys across native/ERC-20/ERC-721/ERC-1155 assets;
- durable asset, transfer, and holder-balance tables;
- idempotent transfer insertion and balance deltas;
- reorg rollback by deleting non-canonical transfers and rebuilding balances from retained canonical transfer history;
- metadata surface columns for symbol, name, decimals, and URI enrichment in later discovery passes;
- regression tests for native, ERC-20, ERC-721, ERC-1155 single, and ERC-1155 batch decoding.

## Authority boundary

420Indexer is never authoritative for balances, ownership, registrations, settlements, rights, governance outcomes, bridge state, or protocol eligibility. Those remain canonical on-chain. Asset balances and ownership views produced here are rebuildable projections derived from canonical transactions/logs; applications must not treat the indexer as protocol authority.

## RPC dependency

420Indexer does not depend on a dedicated 420RPC implementation. It consumes conventional EVM JSON-RPC behind `ChainSource420`. A future 420RPC adapter can satisfy the same source contract without changing indexing semantics.

## Next phase

IDX-5 adds genesis-protocol decoders and projections for 420 Registry, Names, Identity, Stake, Governance, Treasury, Pay, Exchange/Swap, Bridge, Rights, Randomness, and the remaining genesis-resident protocol event surfaces.
