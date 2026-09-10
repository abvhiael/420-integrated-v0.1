# 420Indexer

420Indexer is the canonical off-chain projection service for 420 Integrated. It consumes chain data through a transport-neutral `ChainSource420` interface and builds rebuildable query projections without becoming protocol authority.

## IDX-0 — foundation — complete

IDX-0 freezes the ingestion boundary and correctness rules before database or RPC-provider choices are introduced.

Implemented in IDX-0:

- transport-neutral EVM chain source contract;
- explicit chain identity lookup;
- block, transaction, receipt, log, call, and bytecode read primitives;
- finality policy validation;
- confirmation-depth safe-head calculation;
- canonical checkpoint representation;
- contiguous-parent checkpoint validation;
- fail-closed reorg detection;
- deterministic log ordering;
- removed-log rejection and duplicate suppression.

## IDX-1 — EVM ingestion core

IDX-1 adds the first production-shaped ingestion path while preserving the IDX-0 transport boundary.

Implemented in IDX-1:

- `HttpJsonRpcTransport420` JSON-RPC 2.0 transport with explicit RPC/HTTP failure handling;
- `EvmJsonRpcSource420` adapter for `eth_chainId`, `eth_blockNumber`, block, transaction, receipt, log, call, and bytecode reads;
- canonical EVM quantity conversion with safe integer checks for transaction/log indexes;
- `CheckpointStore420` abstraction;
- in-memory checkpoint implementation for tests and embedded use;
- atomic file checkpoint persistence for single-process operation;
- `IndexerIngestor420` sequential block ingestion;
- configurable start block and bounded `maxBlocksPerRun` backfill;
- confirmation-safe head support;
- chain-ID checkpoint validation;
- missing/mismatched block rejection;
- parent-hash reorg detection before consumer mutation;
- checkpoint advancement only after successful consumer application;
- restart-safe replay tests after consumer failure;
- finalized mode remains fail-closed until a chain source exposes explicit finalized-head semantics.

## Authority boundary

420Indexer is never authoritative for balances, ownership, registrations, settlements, rights, governance outcomes, bridge state, or protocol eligibility. Those remain canonical on-chain. Indexed data must always be reproducible from canonical chain history plus the applicable deployment/ABI manifests.

## RPC dependency

420Indexer does not depend on a dedicated 420RPC implementation. IDX-1 uses ordinary EVM JSON-RPC behind `ChainSource420`. A future 420RPC implementation can satisfy the same source contract without changing ingestion semantics.

## Persistence boundary

The file checkpoint store is deliberately a minimal IDX-1 implementation, not the final production database. Projection/database transactions arrive in later phases. The correctness rule is already fixed: a block checkpoint must never advance until all consumer-side work for that block has completed successfully.

## Next phase

IDX-2 adds the reorg/finality engine: canonical ancestry recovery, rollback/replay contracts for projection stores, configurable reorg depth limits, finalized-head source support, and deterministic recovery tests.
