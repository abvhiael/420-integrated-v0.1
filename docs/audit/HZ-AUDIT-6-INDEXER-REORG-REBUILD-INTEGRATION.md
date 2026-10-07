# HZ-AUDIT-6 — Indexer/reorg/rebuild integration

Status: COMPLETE — Level 1 qualified on exact implementation SHA `6f1ae819ede4b011be53f894ebc4f132f1deabad`.

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
- performs normal canonical batches and complete replacement/rebuild operations atomically in one PostgreSQL transaction;
- rejects event-key replay if its original block/transaction/log provenance changes;
- permits idempotent replay to promote block finality without duplicating projection state;
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
- out-of-order block/transaction/log rejection before mutation;
- atomic rollback when a later event in a multi-event batch violates projection lifecycle rules;
- finality promotion during idempotent replay without duplicate projection writes.

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
- structural event-batch validation occurs before mutation;
- canonical multi-event ingestion and reorg/rebuild replacement commit atomically;
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


## Durable qualification evidence

- Roadmap step: `HZ-AUDIT-6 — Indexer/reorg/rebuild integration`
- Status: **COMPLETE**
- Qualification level: **Level 1**
- Qualified implementation SHA: `6f1ae819ede4b011be53f894ebc4f132f1deabad`
- Audit branch: `feature/420hz-remediation-20261006`
- Pull request: **#556**
- Qualification merge-base/base SHA: `ff4440bfd7b69c0712ee3dd7c4b417cb049ae76d`
- Current `main` observed at closeout: `c8e8b58d818611276f7a9bb2b8d2241004450d97`
- Branch/main state at closeout: diverged; branch is 82 commits ahead and 168 commits behind current `main`.
- PR #556 is open and currently reported mergeable. This does not substitute for later reconciliation against current `main`; Level 3 remains the owner of the final merge-candidate reconciliation.

### Level 1 exact-head results

420Hz Audit Qualification run `37664239176`, fast job `112939237464` — **PASS**.

The exact implementation SHA passed:

- exact-head checkout and identity verification;
- HZ-AUDIT-2 deployment-package verifier;
- HZ-AUDIT-3 authority/Registry verifier;
- HZ-AUDIT-4 STREAM-economics verifier;
- HZ-AUDIT-5 deployment-smoke verifier;
- HZ-AUDIT-6 indexer/reorg/rebuild verifier;
- affected Solidity format check;
- consolidated deployment graph build;
- retained HZ-AUDIT-2 focused deployment regression;
- retained HZ-AUDIT-3 focused Registry/authority regression;
- retained HZ-AUDIT-4 focused STREAM-economics regression;
- retained HZ-AUDIT-5 focused deployment-smoke regression.

Creative Reference Indexer run `37664239300`, job `112939236369` — **PASS**.

The exact implementation SHA passed:

- exact-head checkout and identity verification;
- Decision #10 fixture generation;
- Node.js installation;
- dependency installation;
- TypeScript build;
- complete serialized Creative Reference Indexer rebuild/reference projection test suite, including the HZ-AUDIT-6 reorg/rebuild and RPC-source tests.

Solidity Contracts run `37664239266` — **PASS**:

- classification job `112939243313` — PASS;
- shard 0 `112947696935` — PASS;
- shard 1 `112947696881` — PASS;
- shard 2 `112947696969` — PASS;
- shard 3 `112947696922` — PASS;
- monolithic `foundry` job `112939244718` — expected SKIP under PR shard routing;
- `compute-fast` job `112947698937` — expected SKIP as irrelevant to this PR shape.

Supplementary same-SHA workflows also passed:

- 420Registry REG-AUDIT-4 `37664239206`;
- 420Indexer `37664239090`;
- Genesis Address Authority `37664239179`;
- 420Docs Qualification `37664239229`;
- 420Oracle audit qualification `37664239292`.

### Security / adversarial / failure-path result

HZ-AUDIT-6 exact-head qualification confirms:

- non-finalized canonical tails can be replaced deterministically;
- finalized indexed fork points fail closed;
- canonical prefix state is preserved below a fork;
- orphaned post-fork catalog and streaming state is removed by reconstruction;
- complete base/catalog/streaming projection state reproduces the same digest after destructive rebuild;
- malformed block/transaction/log ordering fails before mutation;
- later-event projection failures roll the complete multi-event batch back atomically;
- event-key replay provenance cannot silently drift;
- idempotent replay can promote finality without duplicating projection state;
- removed RPC logs are rejected;
- log block hashes must match fetched canonical block headers.

PostgreSQL remains explicitly non-authoritative and rebuildable from canonical input.

### Level 2 status

Level 2: **not required for HZ-AUDIT-6**.

The retained 420Hz Level-2 milestone was completed immediately at HZ-AUDIT-5 on exact SHA `a6ffdef933c8086d944b59f492f7208405c0cbf8`. The HZ-AUDIT-6 workflow therefore correctly skipped `hz-audit-integration-level-2` for this ordinary indexer-focused step rather than repeating the already-qualified app milestone.

### Exit criteria satisfied

HZ-AUDIT-6 now has durable exact-SHA evidence that:

1. canonical event ordering retains block, transaction and log position;
2. source-provided finality is preserved without fabricating finalization;
3. conflicting non-finalized event-bearing blocks are detected;
4. finalized-block rollback attempts fail closed;
5. base, catalog and HZ-4 streaming projections rebuild together from canonical journal input;
6. reorg/rebuild replacement is atomic across the shared HZ projection state;
7. orphaned state is removed rather than retained;
8. full HZ projection digest reproduction is exact;
9. RPC log ingestion verifies canonical block headers and rejects removed/hash-mismatched logs;
10. complete Creative Reference Indexer build/tests pass;
11. the dedicated HZ-AUDIT-6 verifier passes;
12. directly applicable Solidity PR qualification passes;
13. no live/testnet RPC endpoint, network, address, decoder wiring or receipt evidence is fabricated.

### Deferred checks and limitations

Level 3: **intentionally deferred** to the single complete 420Hz audit-phase closeout.

HZ-AUDIT-7 retains ownership of:

- public-testnet RPC endpoint/network identity;
- deployed HZ address binding;
- production protocol-specific ABI decoder/enrichment wiring;
- live canonical block and observed-reorg evidence;
- production-equivalent rebuild evidence;
- deployment/governance/Registry/schedule receipts.

Known retained limitation:

- `indexed_blocks` records event-bearing blocks rather than every empty block in chain history.

This does not invalidate repository-side HZ-AUDIT-6 qualification, but production behavior must be qualified against the live testnet in HZ-AUDIT-7.

### Evidence-only closeout rule

This COMPLETE bookkeeping changes documentation/evidence only. It does not modify executable source, tests, workflows, dependencies, configuration, generated/runtime artifacts, interfaces, deployment state or substantive requirements. Therefore `6f1ae819ede4b011be53f894ebc4f132f1deabad` remains the authoritative qualified implementation SHA and no recursive substantive test rerun is required for these closeout commits.

## Next canonical roadmap step

**HZ-AUDIT-7 — Public-testnet deployment.**
