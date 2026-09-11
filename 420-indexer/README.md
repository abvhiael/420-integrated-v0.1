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

## IDX-6 — query/database layer — complete

IDX-6 establishes stable query contracts and database indexes for consumers of 420Indexer.

Implemented:

- opaque base64url cursors for block, transaction, and block/transaction/log positions;
- bounded page sizes with a default of 50 and hard maximum of 200;
- keyset pagination rather than OFFSET pagination;
- deterministic ascending or descending block feeds;
- deterministic transaction feeds ordered by block number and transaction index;
- address-filtered transaction history;
- deterministic log feeds ordered by block, transaction, and log index;
- protocol-event history filtered by protocol and canonical object key;
- asset-transfer history filtered by asset and/or holder address;
- fetch-one-extra-row semantics for stable `nextCursor` construction;
- direct block, transaction, address, receipt, protocol-object and search query helpers;
- covering/query-oriented indexes for Explorer, Wallet, Analytics, Search, Notifications, and Developer APIs.

Query contracts are chain-scoped and operate only on rebuildable index projections. Canonical protocol state remains on-chain.

## IDX-7 — public/index-consumer API — complete

IDX-7 exposes the stable v1 consumer boundary for 420Explorer, 420Search, 420Analytics, 420Wallet, 420Notifications, and the Developer Hub.

The completed IDX-7.4 surface includes stable typed DTOs, versioned JSON envelopes, direct-resource routes, paged feeds, bounded search, operational surfaces, indexed-head/finality metadata marked `authoritative: false`, exported route contracts, bounded path parameters, and consumer/transport/DTO regression coverage.

See `docs/420INDEXER-API-V1.md` for the complete route table and stability contract.

## IDX-8 — notification/event-stream delivery — complete

IDX-8 provides replayable, non-authoritative notification delivery primitives over the qualified public projection API, including replayable event envelopes, private subscription matching, retry-safe delivery, canonicality signals and the 420Notifications adapter.

See `docs/420NOTIFICATIONS.md` for the notification integration, privacy, replay and reliability contract.

## IDX-9 — operational hardening — complete

Completed slices:

- **IDX-9.1 — runtime lifecycle and readiness:** explicit starting/serving/draining/failed state, stale-ingest detection, source-head lag reporting, and fail-closed readiness semantics.
- **IDX-9.2 — graceful shutdown and bounded work:** stop admission before shutdown, drain already accepted work, reject new ingest runs during drain, preserve the existing per-run block bound, enforce a hard drain deadline, and fail runtime closed on shutdown timeout.
- **IDX-9.3 — observability and operational telemetry:** aggregate non-authoritative telemetry for ingest, reorgs, lag, work pressure and delivery state without private payload leakage.
- **IDX-9.4 — durable recovery invariants:** persistent SQL canonical-history storage, SQL-backed checkpoint/history readers, atomic projection + checkpoint + canonical-history advancement through `DurableBlockConsumer420`, and atomic reorg rollback/history truncation/checkpoint reset when the durable consumer path is available. Legacy non-durable consumers remain supported for tests and adapters that intentionally use external stores.
- **IDX-9.5 — failure injection and recovery qualification:** deterministic fault coverage for process restart/resume, RPC outage, stale ingestion, database interruption, bounded canonical reorg recovery and deep-reorg fail-closed behavior. Dedicated IDX-9.2–IDX-9.4 suites continue to qualify shutdown timeout, bounded work, notification retry/dead-letter behavior and durable SQL recovery-store reads. `docs/420INDEXER-RECOVERY.md` defines operator actions and safe recovery criteria for restart, RPC/source outages, stale heads, DB failures, bounded/deep reorgs, shutdown timeout and notification-provider failures.

`/health` remains a process-liveness probe; `/ready` is the traffic-admission gate when runtime state is supplied. Runtime, shutdown, telemetry and recovery metadata remain off-chain service state and never replace canonical chain authority.

## IDX-10 — testnet qualification — in progress

- **IDX-10.1 — qualification environment and harness contract:** implemented. The runner pins chain ID, genesis hash, RPC endpoint, finality mode, sustained-block target, bounded reorg depth and restart-replay window; malformed or inconsistent configuration fails closed.
- **IDX-10.2 — live RPC ingest/indexing smoke:** harness implemented. It verifies chain/genesis identity before writes, derives the configured safe head, requires the full sustained safe-block window, runs that exact window through `IndexerIngestor420`, and requires exact checkpoint advancement. Live testnet evidence remains deployment-time.
- **IDX-10.3 — restart, replay and bounded reorg qualification:** implemented. Restart qualification requires an existing durable checkpoint, rejects catch-up beyond the configured replay window, advances through the production ingestor, then requires a repeated restart at the same safe head to be a no-op. Reorg qualification exercises the durable rollback path, bounded ancestor recovery and deterministic branch replay; deep reorgs fail closed before rollback or checkpoint movement.
- **IDX-10.4 — public API and consumer integration qualification:** implemented. The qualifier requires healthy v1 operational metadata, traffic-admitting readiness, a non-authoritative status surface whose indexed head covers the configured witness block, direct block/transaction/receipt/address/protocol-object witnesses, non-empty block/transaction/log/asset/protocol feeds, bounded search evidence, and replayable notification/event-stream output carrying canonical provenance and `authoritative: false` metadata. Live witness evidence remains deployment-time.
- **IDX-10.5 — readiness report/operator closeout:** next.

See `docs/420INDEXER-TESTNET.md` for the qualification contract and required evidence.

## Authority boundary

420Indexer is never authoritative for balances, ownership, registrations, settlements, rights, governance outcomes, bridge state, or protocol eligibility. Those remain canonical on-chain. All indexed views are rebuildable from canonical chain history plus deployment and ABI manifests.

## RPC dependency

420Indexer consumes conventional EVM JSON-RPC behind `ChainSource420`; a future 420RPC adapter can satisfy the same source contract without changing indexing semantics.

## Next phase

Proceed to IDX-10.5 readiness reporting and operator closeout. Live IDX-10.2 and IDX-10.4 deployment evidence plus final deployment-time descriptor evidence remain required once the testnet endpoint, witness data and compiled genesis artifacts are available.
