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

## IDX-1 — EVM ingestion core — complete

IDX-1 added the first production-shaped ingestion path while preserving the IDX-0 transport boundary.

Implemented in IDX-1:

- `HttpJsonRpcTransport420` JSON-RPC 2.0 transport with explicit RPC/HTTP failure handling;
- `EvmJsonRpcSource420` adapter for standard EVM reads;
- canonical EVM quantity conversion with safe integer checks;
- `CheckpointStore420` abstraction plus memory and atomic-file implementations;
- `IndexerIngestor420` sequential block ingestion;
- configurable start block and bounded backfill;
- confirmation-safe head support;
- chain-ID checkpoint validation;
- missing/mismatched block rejection;
- checkpoint advancement only after successful consumer application;
- restart-safe replay after consumer failure.

## IDX-2 — reorg/finality engine

IDX-2 upgrades ingestion from fail-on-reorg behavior to bounded deterministic recovery.

Implemented in IDX-2:

- explicit optional finalized-head capability on `ChainSource420`;
- EVM `finalized` block-tag support through `EvmJsonRpcSource420`;
- `CanonicalHistoryStore420` abstraction and deterministic in-memory reference store;
- reorg-aware consumer rollback contract;
- canonical checkpoint ancestry comparison;
- nearest-common-ancestor recovery;
- configurable `maxReorgDepth` with fail-closed excessive-depth behavior;
- projection rollback before replay;
- canonical-history trimming after rollback;
- checkpoint rewind or clear semantics;
- automatic checkpoint validation at each ingestion run;
- finalized-mode ingestion that uses the source finalized head instead of ordinary latest head;
- deterministic tests for shallow recovery, depth-limit refusal, finalized RPC resolution, and finalized ingestion bounds.

## Authority boundary

420Indexer is never authoritative for balances, ownership, registrations, settlements, rights, governance outcomes, bridge state, or protocol eligibility. Those remain canonical on-chain. Indexed data must always be reproducible from canonical chain history plus the applicable deployment/ABI manifests.

## RPC dependency

420Indexer does not depend on a dedicated 420RPC implementation. It uses ordinary EVM JSON-RPC behind `ChainSource420`. A future 420RPC implementation can satisfy the same source contract without changing indexing semantics.

## Recovery boundary

A projection consumer that wants automatic reorg recovery implements `rollbackTo(blockNumber)`. Recovery first verifies the saved checkpoint against canonical chain state, searches backwards through retained local history up to `maxReorgDepth`, rolls projection state back to the nearest common ancestor, rewinds the checkpoint, and only then resumes forward ingestion. A reorg deeper than the configured retained window fails closed rather than guessing.

## Next phase

IDX-3 builds the durable core chain projection layer: blocks, transactions, receipts, addresses/contracts, canonical logs, database schema/migrations, and transactional coupling between projections and checkpoints.
