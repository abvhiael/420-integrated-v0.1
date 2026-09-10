# 420Indexer

420Indexer is the canonical off-chain projection service for 420 Integrated. It consumes chain data through a transport-neutral `ChainSource420` interface and builds rebuildable query projections without becoming protocol authority.

## IDX-0 scope

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

## Authority boundary

420Indexer is never authoritative for balances, ownership, registrations, settlements, rights, governance outcomes, bridge state, or protocol eligibility. Those remain canonical on-chain. Indexed data must always be reproducible from canonical chain history plus the applicable deployment/ABI manifests.

## RPC dependency

IDX-0 intentionally does not depend on a dedicated 420RPC implementation. The first concrete source adapter may use ordinary EVM JSON-RPC. A future 420RPC adapter can satisfy the same `ChainSource420` interface without changing indexer semantics.

## Next phase

IDX-1 adds the first concrete EVM JSON-RPC source, sequential block ingestion, checkpoint persistence abstraction, bounded backfill ranges, and restart-safe ingestion tests.
