# 420Explorer — Genesis Profile

420Explorer is the reference observability and discovery application for 420 Integrated. It is intentionally contract-free: the Explorer does not own protocol state, authorize actions, custody assets, or become a dependency for direct chain interaction.

## Canonical sources and shared indexing

420Explorer does **not** run its own chain-ingestion pipeline. Its hosted backend consumes the shared, non-authoritative **420Indexer `/v1` read API** for indexed blocks, transactions, receipts, logs, head/safe/finalized health, and Registry-backed historical protocol service/version data.

420Indexer remains a rebuildable projection over canonical chain/RPC and registered protocol sources. Explorer presentation must preserve the chain ID, canonical block hash, finality and schema/decoder provenance supplied by the indexer. If the indexer is stale, degraded, wrong-chain, or unavailable, Explorer must surface that state rather than silently switching to a second independent ingestion database.

The Explorer backend must not implement its own JSON-RPC block crawler, checkpoint database, reorg engine, finality promotion loop or historical protocol decoder registry. Direct RPC remains available to users and other network clients, but it is not an alternate Explorer ingestion path.

## 420Indexer consumer surface

The initial Explorer integration consumes:

- `GET /v1/health`
- `GET /v1/blocks`
- `GET /v1/blocks/{number}`
- `GET /v1/transactions/{hash}`
- `GET /v1/receipts/{hash}`
- `GET /v1/blocks/{number}/logs`
- `GET /v1/services/{service}/versions/{version}`

The Explorer client rejects any 420Indexer response envelope that claims canonical-state authority. This protects the architectural boundary that both services are presentation/read infrastructure rather than consensus authority.

## Indexing model

Indexed records are keyed to chain ID and canonical block hash. Non-finalized history may be repaired following a reorg; finalized history must not be silently rewritten. The index database is owned by 420Indexer and is replaceable/rebuildable from supported canonical sources. Explorer itself stores no independent canonical-source checkpoint or fork history.

## Contract and protocol discovery

For deployed contracts the Explorer exposes runtime bytecode/code hash, transaction history, emitted events and available verification metadata. Registered protocol components should additionally show their 420Registry service identifier, version, component type, manifest commitment, dependency root and interface commitment. Historical service/version resolution comes from the indexer's Registry-backed decoder catalogue. Verified source code is presentation metadata and never overrides deployed bytecode.

420 Names and 420 Identity may enrich display labels without replacing canonical addresses or records.

## Availability and authority

Explorer outages cannot block wallets, RPC clients or dApps from using the network. Explorer operators receive no custody, governance, bridge, validator, smart-account execution or token-transfer authority. Public Explorer APIs and 420Indexer are replaceable infrastructure, not consensus participants or protocol truth sources.

## First-consumer qualification

420Explorer qualifies the GEN-11.1 first-consumer gate when automated tests prove that its chain/protocol reads use the 420Indexer API surface, the configured profile explicitly disables independent ingestion/checkpoint/reorg/decoder pipelines, and the shared readiness verifier fails if that boundary drifts.
