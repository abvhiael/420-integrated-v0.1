# GEN-11.1 status

## Complete in current branch

- architecture and authority boundary
- invariants/readiness profile
- canonical-source models
- checkpoint/finality core
- wrong-chain validation
- finalized-history fail-closed behavior
- rebuildable memory and durable file stores
- shared production read API
- RPC source consistency and finality-tag ingestion
- deterministic reorg repair
- Registry-backed historical decoder resolution
- full rebuild tooling
- restart/reorg qualification fixtures
- machine-enforced readiness verification
- first GEN-10 consumer integration: 420Explorer

### GEN-11.1B — production ingestion

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

### GEN-11.1C — deterministic reorg engine

- common-ancestor discovery
- rollback bounded by finalized history
- deterministic replay of replacement non-finalized history
- checkpoint rewind/re-advance during repair
- safe-height adjustment after rollback
- finalized-history conflict fails closed without mutating local indexed state
- live ingestion path automatically invokes repair on ancestry mismatch
- successful non-finalized fork and finalized-conflict qualification tests

### GEN-11.1D — Registry-backed protocol decoder resolution

- rebuildable historical ProtocolRegistry service catalogue
- Registry version/profile/deprecation projection with canonical provenance
- exact implementation-at-block service/version resolution
- monotonic history and idempotent replay enforcement
- decoder dispatch pinned to the exact historical service/version
- missing historical decoder fails closed; no fall-forward
- raw ABI decoding for canonical ProtocolRegistry events
- malformed and unknown registry logs fail closed

### GEN-11.1E — shared production read API

- stable `/v1` HTTP read boundary with no canonical authority
- health, block and fixed-snapshot block pagination
- transaction and receipt reads
- deterministic block-log reads
- ProtocolRegistry service/version reads
- explicit `canonicalAuthority: false` envelopes
- persistent-store-backed API adapter

### Finality ingestion and promotion

- canonical `safe` and `finalized` JSON-RPC tag reads
- post-catch-up and post-reorg finality refresh
- exact indexed-hash verification at safe/finalized boundaries
- HEAD -> SAFE -> FINALIZED durable promotion
- safe/finalized checkpoint height/hash persistence
- invalid ordering and finalized disagreement fail closed

### GEN-11.1F — final qualification / readiness closeout

- `INDEXER_REBUILD=1` full rebuild mode over canonical RPC
- atomic durable-store reset of rebuildable indexed state
- canonical `version.Schema` in production command
- reset/reopen qualification proving stale indexed records do not survive rebuild
- restart -> non-finalized fork -> deterministic repair integration fixture
- machine-readable qualification evidence
- `scripts/verify-420indexer.py` enforced by 420Indexer CI
- reconciled with current `main`
- 420Explorer Go consumer client over 420Indexer `/v1`
- Explorer profile explicitly disables independent RPC ingestion, checkpoints, reorg engine and decoder registry
- Explorer/indexer consumer boundary regression tests
- `scripts/verify-explorer-indexer-consumer.py` enforced by 420Indexer CI
- 420Explorer consumer gate set to `QUALIFIED_INDEXER_API_CONSUMER`

## GEN-11.1 completion state

The implementation completion gate is satisfied once the current integration head clears CI: the index can be built from canonical sources, interrupted/resumed, reorg-repaired, rebuilt from zero, and consumed by 420Explorer without an independent chain-ingestion pipeline.

Testnet deployment URL/service probes remain deployment-stage work rather than GEN-11.1 implementation blockers.

## Post-baseline scalability

A database-backed store remains recommended before high-volume production operation, but it is not a correctness prerequisite for the first consumer integration. The file-backed store is the qualified deterministic baseline and preserves the replaceable-store boundary.
