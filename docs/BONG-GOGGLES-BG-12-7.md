# Bong Goggles BG-12.7 — Production Ingestion & Operations Closeout

BG-12.7 closes the Phase-12 production backend by wrapping the deterministic projector, durable checkpointing, search/recommendation service and notification pipeline in an operator-facing ingestion runtime.

## Production runtime

`services/bong-goggles-indexer-v1/src/operationsRuntime.js` provides a provider-neutral RPC/log ingestion coordinator. It requires an RPC adapter exposing `getBlockNumber`, `getBlock` and `getLogs`, a canonical log decoder, a canonical-state hydrator, and a projection store. The runtime itself does not introduce a new protocol authority.

The runtime:

- validates chain/schema/deployment configuration and required non-zero Bong Goggles contract addresses
- ingests logs only through the configured canonical contract set
- waits for the configured confirmation depth before indexing a block
- chunks log retrieval with a configurable maximum block span
- sorts logs deterministically by block, transaction index and log index
- hydrates canonical state before using BG-12.3 event adapters where an event payload is incomplete
- persists after each indexed block range
- verifies a deterministic full rebuild after every successful synchronization pass
- resumes from the persisted checkpoint after restart without duplicate event application

## Reorg handling

Before new ingestion, the runtime checks the persisted indexed-head hash against the RPC provider. If the head is no longer canonical, it walks backward through the persisted block hashes up to the configured `reorgWindow`, rebuilds from the last matching block and resumes ingestion from the canonical replacement history.

If no matching block can be found inside the configured window, synchronization fails closed with `reorg exceeds configured window`. Operators must then investigate provider/network state and perform an explicit rebuild rather than silently accepting an unbounded fork.

## Durable storage boundary

The runtime depends only on a store with `load` and `save` semantics. The existing `PersistentProjectionStore` remains the file-backed Genesis implementation and preserves atomic writes, event-stream digest verification, schema/chain binding and state-root verification. `MemoryProjectionStore` exists only as a deterministic test/reference backend demonstrating the storage abstraction.

Production deployments may replace the file store with another durable backend only if the replacement preserves the same deterministic event stream and checkpoint guarantees.

## Deployment configuration

`services/bong-goggles-indexer-v1/config.example.json` documents the runtime configuration surface:

- `chainId`
- canonical search `schemaHash`
- `startBlock`
- confirmation depth
- bounded `reorgWindow`
- RPC `maxBlockSpan`
- health `staleAfterBlocks`
- canonical deployment addresses for the profile, relationship, social-object, community, discovery and search-index contracts

The example addresses are placeholders and MUST NOT be used as production deployment values.

## Health and observability

The runtime exposes a non-authoritative health envelope containing:

- `ready`, `catching_up`, `stale` or `degraded` state
- indexed block/hash
- observed and confirmation-safe heads
- lag in blocks
- event/entity counts
- deterministic state root
- last successful sync time
- latest error
- recovered reorg count

Structured log records include chain ID, timestamp, severity and event name. Initial operator events are `range_indexed`, `reorg_recovered` and `sync_failed`. These records are suitable for ingestion by the wider 420 observability/status stack.

Recommended alerts:

1. health state remains `stale` beyond the normal RPC/indexing interval;
2. any `sync_failed` event;
3. any `reorg_recovered` event requiring operator awareness;
4. repeated or increasing reorg count;
5. deterministic rebuild mismatch;
6. failure to load the persisted checkpoint/state root;
7. RPC head unavailable or chain ID/deployment configuration mismatch.

## Operator recovery runbook

1. Stop the indexer before manually changing persistence files or deployment configuration.
2. Verify RPC endpoint chain identity and the canonical Bong Goggles deployment addresses.
3. Inspect the last indexed block/hash and compare it with canonical RPC state.
4. For a bounded reorg, restart normally; the runtime rolls back within `reorgWindow` and replays the canonical replacement.
5. For `reorg exceeds configured window`, preserve the old persistence artifact for diagnosis, create a clean projection store, and rebuild from the configured canonical `startBlock`.
6. After any rebuild, require `verifyDeterministicRebuild` to reproduce the same event count, indexed hash and state root.
7. Do not treat search, notification or indexer output as canonical protocol state during recovery; users may verify canonical state through contracts/RPC/Explorer.

## Phase-12 closeout gate

BG-12.7 completes implementation of BG-12.3 through BG-12.7 on the monolithic Phase-12 branch. Before PR #307 may merge:

- Bong Goggles Indexer Verification must pass on the final head;
- 420 Integrated Qualification must pass on the final head;
- documentation qualification must pass where triggered;
- deterministic rebuild verification must remain covered;
- the branch must be reconciled with the then-current `main`;
- the reconciled head must be requalified if reconciliation changes the commit.

Only after those gates are green is Phase 12 eligible for its single merge to `main`.
