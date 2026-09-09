# GEN-11.1 status

## Complete in current branch

- architecture and authority boundary
- invariants/readiness profile
- canonical-source models
- checkpoint/finality core
- wrong-chain validation
- finalized-history fail-closed behavior
- rebuildable memory store
- shared read API response types
- RPC source consistency interface
- indexer-specific CI workflow

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
- `ServiceVersionPublished` projection with canonical block provenance
- `ServiceRegistrationProfilePublished` projection for component/manifest/dependency/interface commitments
- `ServiceDeprecated` projection and historical deprecation boundary
- exact implementation-at-block service/version resolution
- monotonic version-history enforcement and idempotent replay
- decoder dispatch pinned to the exact historical service/version
- missing historical decoder fails closed; no fall-forward to newer decoder
- decoded results retain registry identity, decoder version and canonical log provenance
- qualification for historical version resolution, deprecation, version gaps, replay conflicts and decoder pinning

## Remaining before GEN-11.1 completion

- finalized/safe tag ingestion and promotion of finality metadata
- raw ProtocolRegistry ABI event decoding from indexed logs into the normalized GEN-11.1D event surface
- production HTTP/read API
- fixed-snapshot cursor implementation
- scalable database-backed store option after file-store baseline qualification
- full rebuild tooling
- restart/reorg integration fixtures
- first GEN-10 consumer integration, recommended 420Explorer
