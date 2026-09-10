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

## IDX-5 — genesis protocol projections — functionally complete

IDX-5 provides manifest-driven decoding and rebuildable state views for genesis-resident protocols. It includes deterministic ABI-derived descriptors, fixed/static ABI decoding, canonical object identities, protocol event journals, latest-object state views, protocol-specific lifecycle reducers, and reorg-bounded replay semantics.

The remaining IDX-5 closeout is deployment-time only: generate and check the concrete descriptor manifest once compiled genesis artifacts land, then run the artifact-backed qualification suite.

## IDX-6 — query/database layer

The first IDX-6 increment establishes stable query contracts and database indexes for consumers of 420Indexer.

Implemented in this increment:

- opaque base64url cursors for block, transaction, and block/transaction/log positions;
- bounded page sizes with a default of 50 and hard maximum of 200;
- keyset pagination rather than OFFSET pagination;
- deterministic ascending or descending block feeds;
- deterministic transaction feeds ordered by block number and transaction index;
- address-filtered transaction history;
- deterministic log feeds ordered by block, transaction, and log index;
- protocol-event history filtered by protocol and canonical object key;
- asset-transfer history filtered by asset and/or holder address;
- fetch-one-extra-row semantics for stable `nextCursor` construction at the service/API layer;
- covering/query-oriented indexes for the block, transaction, log, asset-transfer, and protocol-event paths used by Explorer, Wallet, Analytics, Search, Notifications, and Developer APIs.

Query contracts are chain-scoped and operate only on rebuildable index projections. Canonical protocol state remains on-chain.

## Authority boundary

420Indexer is never authoritative for balances, ownership, registrations, settlements, rights, governance outcomes, bridge state, or protocol eligibility. Those remain canonical on-chain. All indexed views are rebuildable from canonical chain history plus deployment and ABI manifests.

## RPC dependency

420Indexer does not depend on a dedicated 420RPC implementation. It consumes conventional EVM JSON-RPC behind `ChainSource420`. A future 420RPC adapter can satisfy the same source contract without changing indexing semantics.

## Next phase

Continue IDX-6 with an executable database repository/service layer that turns the SQL query contracts into typed pages, stable cursor emission, direct hash/address lookup helpers, and search-oriented query primitives. Then IDX-7 exposes the public/index-consumer API surface for Explorer, Search, Analytics, Wallet, Notifications, and the Developer Hub.
