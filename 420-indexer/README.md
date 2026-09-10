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

## IDX-5 — genesis protocol projections

IDX-5 provides manifest-driven decoding and rebuildable state views for genesis-resident protocols.

Implemented across IDX-5 so far:

- descriptor-driven event decoding keyed by `topic0`;
- deterministic indexed/data-word decoding for address, bool, fixed bytes, and unsigned integer widths used by current genesis contracts;
- collision detection for conflicting topic descriptors;
- deterministic descriptor generation from exported Foundry ABI artifacts;
- descriptor binding to frozen genesis predeploy addresses;
- fail-closed handling for missing required artifacts, anonymous events, contract-name mismatches, and unsupported dynamic ABI fields;
- normalized protocol/event identity and canonical chain ordering metadata;
- durable `idx_protocol_events` SQL projection with protocol/event/contract indexes;
- protocol-scoped event query views;
- canonical object-key extraction using common 420 event identifiers such as objectId, componentId, labelHash, profileId, validatorId, stakeId, proposalId, paymentId, routeId, requestId, rightId, licenseId, and assetId;
- latest-object state views ordered by block number, transaction index, and log index;
- lifecycle-state extraction from `stateAfter`, `status`, `state`, or `active` where present;
- protocol-specific lifecycle reducers for Names, Stake, Governance, Pay, Bridge, Rights, and Randomness;
- canonical-order reduction with terminal-state protection so completed/cancelled/revoked/expired/failed objects cannot be accidentally resurrected by later stale or duplicate lifecycle events;
- protocol state views for Names, Identity, Stake, Governance, Pay, Swap/Exchange, Bridge, Rights, and Randomness;
- bounded rollback of protocol events during reorg recovery;
- regression coverage using the actual `Names420.NameRegistered(bytes32,address,uint64,uint8)` event shape and lifecycle reducer semantics.

The decoder intentionally consumes deployment/ABI-derived event descriptors rather than hard-coding protocol state assumptions. Events, state views, and lifecycle snapshots remain non-authoritative projections and can always be rebuilt from canonical chain history plus the pinned deployment/ABI manifest.

## Authority boundary

420Indexer is never authoritative for balances, ownership, registrations, settlements, rights, governance outcomes, bridge state, or protocol eligibility. Those remain canonical on-chain. All indexed views are rebuildable from canonical chain history plus deployment and ABI manifests.

## RPC dependency

420Indexer does not depend on a dedicated 420RPC implementation. It consumes conventional EVM JSON-RPC behind `ChainSource420`. A future 420RPC adapter can satisfy the same source contract without changing indexing semantics.

## Next phase

IDX-5 is now functionally complete at the generic projection/reducer layer. The remaining deployment-time closeout is to generate and check the concrete descriptor manifest once compiled genesis artifacts land, then run the full artifact-backed qualification suite. The next development phase is IDX-6: the indexed query/database layer, pagination/index strategy, and stable query contracts consumed by Explorer, Search, Analytics, Wallet, Notifications, and Developer APIs.
