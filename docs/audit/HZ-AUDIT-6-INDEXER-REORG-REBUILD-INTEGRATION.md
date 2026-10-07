# HZ-AUDIT-6 — Indexer/reorg/rebuild integration

Status: IMPLEMENTED — Level 1 qualification required on the exact implementation head.

## Canonical purpose

HZ-AUDIT-6 closes the repository-side indexer durability gap after HZ-AUDIT-5 deployment convergence.

The Creative Reference Indexer is deliberately non-canonical: chain history and committed manifests remain authoritative, while PostgreSQL is a disposable projection that must be reproducible from canonical input.

This step therefore qualifies:

1. deterministic block/transaction/log ordering metadata;
2. explicit source-provided finality;
3. canonical block-hash conflict detection;
4. fail-closed finalized-block protection;
5. destructive rollback of the non-finalized projection tail;
6. coordinated replay across base, catalog and HZ-4 streaming projections;
7. exact full-projection digest reproduction after rebuild;
8. repository-side JSON-RPC log ingestion metadata and block-header verification;
9. malformed-order, removed-log and hash-mismatch failure paths;
10. preservation of HZ-AUDIT-7 ownership of public-testnet endpoint/address/receipt evidence.

## Repository gap closed

Before HZ-AUDIT-6:

- fixture replay and clean rebuild were tested only for the base Decision #10 projection;
- base, catalog and streaming stores independently wrote the shared event journal;
- no coordinator owned cross-projection reorg rollback/replay;
- event ordering retained block number, transaction hash and log index but not transaction index;
- indexed event blocks were unconditionally marked finalized;
- no RPC source attached canonical parent-hash/finality metadata or verified log block hashes against block headers;
- a conflicting canonical tail could leave stale catalog/streaming projection rows unless the database was manually rebuilt.

HZ-AUDIT-6 corrects these repository-local issues without changing protocol authority.

## Implementation

### Canonical event metadata

`creative-indexer/src/types.ts` extends `CanonicalEvent` with optional:

- `parentHash`;
- `transactionIndex`;
- `finalized`.

Existing deterministic fixture events remain valid and default to transaction index 0 / non-finalized when those values are absent.

### Event journal ordering

`creative-indexer/sql/001_initial.sql` now retains `tx_index` and a canonical ordering index over:

`block_number, tx_index, log_index, event_key`.

The schema uses an `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` compatibility path so an existing repository database can adopt the ordering field.

### Store finality semantics

`CreativeIndexerStore`, `CatalogProjectionStore420` and `StreamingSettlementProjectionStore420` now:

- persist transaction index;
- persist parent hash;
- persist only source-provided finality;
- no longer fabricate `finalized=true` for every indexed block.

### HZ integration coordinator

`creative-indexer/src/hz-indexer-integration.ts` adds `HzIndexerIntegration420`.

It:

- routes canonical events to the base, catalog or streaming projector;
- validates duplicate keys and deterministic block/transaction/log order before mutation;
- detects an already-indexed event-bearing block whose hash conflicts with the incoming canonical tail;
- refuses rollback when the conflicting block is finalized;
- loads the canonical journal prefix below the fork;
- destructively resets every HZ-derived projection;
- replays the retained prefix;
- replays the replacement canonical tail;
- removes orphaned catalog/streaming state by reconstruction rather than ad-hoc row surgery;
- rebuilds the complete HZ projection from the retained canonical journal;
- computes a digest spanning base, catalog and HZ-4 streaming projection tables.

The destructive rebuild is intentional. PostgreSQL is not protocol authority.

### RPC canonical log source

`creative-indexer/src/rpc-log-source.ts` adds a repository-side JSON-RPC boundary.

It:

- loads logs with `eth_getLogs`;
- loads canonical block headers with `eth_getBlockByNumber`;
- captures block hash, parent hash, transaction index, transaction hash and log index;
- derives finality from the RPC `finalized` block where available;
- verifies each log block hash matches the fetched canonical header;
- rejects `removed=true` logs;
- emits ordered `CanonicalEvent` values through a required decoder/enrichment callback.

Protocol-specific ABI decoding/enrichment and deployed-address selection are environment wiring. They are not fabricated in this repository step and remain part of HZ-AUDIT-7 live deployment qualification.

## Focused tests

`creative-indexer/test/hz-indexer-reorg-rebuild.test.ts` proves:

- non-finalized canonical-tail replacement;
- canonical prefix retention;
- orphaned post-fork streaming state removal;
- replacement catalog state projection;
- cross-store canonical journal replay;
- exact full-projection digest reproduction after destructive rebuild;
- idempotent replacement-tail replay;
- finalized-block reorg refusal;
- out-of-order block/transaction/log rejection before mutation.

`creative-indexer/test/rpc-log-source.test.ts` proves:

- RPC log ordering metadata;
- parent-hash retention;
- source-derived finality;
- deterministic event-key provenance;
- `eth_getLogs` range/address filtering;
- removed-log rejection;
- canonical header/log block-hash agreement.

The complete Creative Reference Indexer suite remains required so legacy fixture rebuild, catalog projection/discovery and HZ-4 streaming settlement projections do not regress.

## Security and integrity invariants

- canonical EVM history remains authoritative;
- PostgreSQL remains disposable and rebuildable;
- finalized indexed blocks cannot be rolled back by the coordinator;
- event batches are validated before mutation;
- reorg repair reconstructs derived state from canonical journal input;
- orphaned post-fork rows are not retained;
- removed RPC logs are not treated as canonical;
- RPC log hashes must match canonical block headers;
- no public-testnet RPC URL, deployed address, observed block/reorg, transaction receipt or production rebuild result is invented.

## Level 1 exit criteria

HZ-AUDIT-6 is COMPLETE only when one exact implementation SHA passes:

- `scripts/verify-420hz-audit-6-indexer-reorg-rebuild.py`;
- Creative Reference Indexer exact-head checkout verification;
- TypeScript build;
- complete serialized Creative Reference Indexer test suite;
- focused HZ-AUDIT-6 reorg/rebuild tests;
- focused RPC source tests;
- directly applicable HZ audit verifier/regressions triggered by the PR shape.

## Level 2 status

A separate Level 2 run is **not required** for HZ-AUDIT-6.

HZ-AUDIT-5 immediately completed the documented retained 420Hz Level-2 integration milestone on exact SHA `a6ffdef933c8086d944b59f492f7208405c0cbf8`. HZ-AUDIT-6 directly qualifies its changed indexer surface at Level 1 rather than ceremonially rerunning that milestone.

## Level 3 status

Level 3 remains intentionally deferred to the single complete 420Hz audit-phase closeout.

## Live/testnet boundary

HZ-AUDIT-7 owns:

- public-testnet RPC endpoint and network identity;
- deployed HZ address binding;
- production protocol-specific log decoder/enrichment wiring;
- live canonical block/reorg observations;
- production-equivalent rebuild evidence;
- deployment/governance/Registry/schedule transaction receipts.

## Known limitations retained for HZ-AUDIT-7

- `indexed_blocks` records event-bearing blocks rather than every empty chain block;
- the repository RPC transport requires a caller-supplied protocol decoder/enricher;
- production decoder/address binding is not claimed without a deployed testnet environment.

## Next canonical roadmap step

**HZ-AUDIT-7 — Public-testnet deployment.**
