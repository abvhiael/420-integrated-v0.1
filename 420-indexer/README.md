# 420Indexer

420Indexer is the canonical off-chain projection service for 420 Integrated. It consumes chain data through a transport-neutral `ChainSource420` interface and builds rebuildable query projections without becoming protocol authority.

## IDX-0 — foundation — complete
Transport-neutral chain reads, finality policy, checkpoints, deterministic log normalization, and fail-closed reorg detection.

## IDX-1 — EVM ingestion core — complete
Standard EVM JSON-RPC ingestion, bounded sequential backfill, restart-safe checkpointing, and chain-ID validation.

## IDX-2 — reorg/finality engine — complete
Finalized-head support, retained canonical history, nearest-common-ancestor recovery, rollback/replay, and configurable fail-closed reorg-depth limits.

## IDX-3 — durable core projections

IDX-3 introduces the first durable canonical query model.

Implemented in IDX-3:

- block ingestion batches now include ordered transactions and receipts as well as canonical logs;
- standard EVM `eth_getBlockByNumber(..., true)` support for full block transactions;
- deterministic receipt collection for each transaction before projection mutation;
- SQL migration `001-core-projections.sql` for blocks, addresses/contracts, transactions, receipts, canonical logs, and checkpoints;
- `CoreProjectionConsumer420` transactional projection writer;
- idempotent block/transaction/receipt upserts and log deduplication;
- address discovery from senders, recipients, contract creation, and log emitters;
- rollback semantics that delete block-scoped state above a recovered canonical ancestor;
- core address identity is retained across shallow rollback because address discovery is non-authoritative metadata;
- SQL migrations are copied into the build output;
- focused transaction and rollback regression tests.

## Authority boundary

420Indexer is never authoritative for balances, ownership, registrations, settlements, rights, governance outcomes, bridge state, or protocol eligibility. Those remain canonical on-chain. Indexed data must always be reproducible from canonical chain history plus the applicable deployment/ABI manifests.

## RPC dependency

420Indexer does not depend on a dedicated 420RPC implementation. It uses ordinary EVM JSON-RPC behind `ChainSource420`. A future 420RPC implementation can satisfy the same source contract without changing indexing semantics.

## Transaction boundary

`CoreProjectionConsumer420` requires a transactional SQL adapter. A canonical block's projection rows and its SQL checkpoint are written inside one transaction. The existing ingestion checkpoint remains the outer progress marker until IDX-3's database adapter is wired as the shared checkpoint/history implementation; production deployment must use a database adapter that commits projection state and authoritative progress atomically.

## Next phase

IDX-4 adds asset projections: native $420 transfer/account activity plus ERC-20, ERC-721, and ERC-1155 token metadata, transfers, ownership/balance projections, and deterministic token event decoding.
