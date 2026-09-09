# GEN-11.1 status

## Complete in current branch

- architecture and authority boundary
- invariants/readiness profile
- canonical-source models
- checkpoint/finality core
- wrong-chain validation
- non-finalized reorg safety boundary
- finalized-history fail-closed behavior
- rebuildable memory store
- versioned decoder registry
- shared read API response types
- RPC source consistency interface
- indexer-specific CI workflow

### GEN-11.1B — production ingestion slice

- concrete node420-compatible JSON-RPC client
- `eth_chainId` validation
- head discovery with `eth_blockNumber`
- full block retrieval with transactions
- per-transaction receipt retrieval
- receipt/log provenance normalization
- durable atomic file-backed store
- transaction, receipt and log persistence
- restart/resume from durable checkpoint
- full bundle persistence before checkpoint advancement
- production `indexer420` command wired through `INDEXER_RPC_URL` and `INDEXER_STORE_PATH`
- restart/rollback and RPC ingestion qualification tests

GEN-11.1B deliberately stops on ancestry mismatch. Canonical ancestor discovery and deterministic rollback/replay remain GEN-11.1C.

## Remaining before GEN-11.1 completion

- GEN-11.1C deterministic ancestry discovery and replay engine
- finalized/safe tag ingestion and promotion of finality metadata
- 420Registry-backed decoder metadata resolver
- production HTTP/read API
- fixed-snapshot cursor implementation
- scalable database-backed store option after file-store baseline qualification
- full rebuild tooling
- restart/reorg integration fixtures
- first GEN-10 consumer integration, recommended 420Explorer
