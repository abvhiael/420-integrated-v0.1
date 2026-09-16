# 420Analytics — Genesis Profile

420Analytics is the reference derived-data and dashboard layer for the 420 Integrated ecosystem. It computes reproducible metrics, historical series, cohorts, rankings, anomalies and forecasts from qualified public source projections while preserving the authority of the chain and the protocol that owns each underlying record.

## Authority model

420Analytics is intentionally contract-free and non-canonical. Metrics, KPIs, materialized views, historical snapshots, rankings, cohorts, anomaly scores, forecasts and dashboards are derived outputs. They cannot override canonical balances, accounting, ownership, identity, rights, governance, settlement, validator state, arbitration outcomes, bridge state or protocol permissions.

Chain-derived analytics consume the qualified 420Indexer public API. Analytics does not crawl node420 RPC, own chain ingestion, implement independent finality/checkpoint/reorg logic, or decode protocol events outside the qualified Indexer boundary.

## Methodology and provenance

Every published metric must identify its methodology version, observation window, source provenance, chain ID and source snapshot context. Chain-derived outputs expose indexed and finalized heights and freshness so clients can distinguish current, lagging and stale data.

Historical snapshots are immutable for a frozen methodology and source snapshot once published. A methodology change produces a new version rather than silently rewriting the meaning of old analytics.

## Metric classes

Genesis Analytics supports network, validator, protocol, economic, cohort, ranking, anomaly and forecast classes. Observed metrics and predictive outputs remain visibly distinct. Cohorts and rankings use documented inclusion rules and stable tie-breaking; forecasts and anomaly scores are explicitly predictive/non-canonical.

## Privacy

Analytics excludes private Messenger content, private Commons content, private Identity fields, encrypted Resource Protocol payloads and raw Attention telemetry. Public commitments, hashes, ciphertext references, transaction metadata or aggregate availability do not authorize recovery, deanonymization or indexing of protected payloads.

## Failure model

Wrong-chain, stale, degraded, incomplete or provenance-invalid upstream state fails closed for metrics that claim canonical context. 420Analytics can fail, be rebuilt, replaced or independently reimplemented without blocking Wallet, RPC, Explorer, Search or any underlying protocol.
