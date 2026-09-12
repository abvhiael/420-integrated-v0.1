---
title: Indexer, Explorer, Search, Analytics and Status troubleshooting
audience:
  - user
  - developer
  - operator
category: troubleshooting
status: current
version: current
---

# Indexer, Explorer, Search, Analytics and Status troubleshooting

This registry covers failures in derived and presentation services. None of these services outrank canonical chain or protocol state. If a derived view disagrees with a qualified canonical RPC read, treat the derived surface as stale, degraded, rebuilding or incorrect until reconciled.

## TRB-INDEXER-001 — Indexer is not ready

- **Audience:** developer, operator
- **Surface:** 420Indexer `/ready`, ingestion pipeline
- **Symptom:** the process is running but readiness is false or returns an unavailable/degraded state.
- **Severity:** degraded
- **Authority source:** Indexer health/readiness state for service availability; canonical RPC for chain truth.
- **Likely causes:** upstream RPC unavailable; ingestion lag beyond readiness bounds; database/storage failure; decoder/configuration mismatch; startup recovery still in progress.
- **Diagnostic evidence:** `/health`, `/ready`, service version, ingestion cursor, finalized cursor, upstream endpoint health, sanitized logs.
- **Retry safety:** safe for read-only readiness checks.
- **Recovery steps:** confirm upstream RPC; inspect cursor/finality lag; restore database/storage dependencies; allow bounded recovery/replay; keep downstream derived consumers degraded until readiness returns.
- **Escalation:** escalate if readiness cannot recover without manual data mutation or if cursors appear to advance against unverifiable canonical state.
- **Related documentation:** `docs/architecture/infrastructure/420indexer.md`, `docs/reference/generated/indexer-api.md`.

## TRB-INDEXER-002 — Indexed data is stale or missing

- **Audience:** user, developer, operator
- **Surface:** 420Indexer-backed reads
- **Symptom:** a known transaction, block, address update, protocol event or object is absent or behind canonical chain state.
- **Severity:** degraded
- **Authority source:** canonical RPC/contract state; Indexer only for projection freshness.
- **Likely causes:** ingestion lag; temporary upstream outage; reorg reconciliation; decoder lag; rebuild/replay in progress.
- **Diagnostic evidence:** transaction/block hash, canonical block/finality status, Indexer cursor, projection timestamp/version, `/status` or equivalent operational state.
- **Retry safety:** safe for reads; do not repeat a write merely because the derived projection is missing.
- **Recovery steps:** verify canonical state first; compare Indexer cursor; wait for bounded catch-up or complete recovery/replay; use canonical RPC for time-sensitive verification.
- **Escalation:** escalate if derived state remains inconsistent after the Indexer reaches the relevant finalized block.
- **Related documentation:** `docs/architecture/infrastructure/420indexer.md`, `docs/troubleshooting/chain-rpc-transactions.md`.

## TRB-INDEXER-003 — Reorg recovery or replay is in progress

- **Audience:** developer, operator
- **Surface:** 420Indexer canonical-history/reorg handling
- **Symptom:** data temporarily disappears, changes block association, or the service reports replay/rebuild/reconciliation.
- **Severity:** degraded
- **Authority source:** canonical chain history and the Indexer's recorded canonical/finalized cursors.
- **Likely causes:** bounded chain reorganization; restart/recovery; projection replay; durable-history rollback.
- **Diagnostic evidence:** old/new canonical hashes, affected block range, cursor/checkpoint positions, finality state, rebuild/replay status.
- **Retry safety:** not-applicable for the recovery itself; safe for read-only checks.
- **Recovery steps:** let the Indexer roll back non-canonical projections; verify checkpoint/history reset; replay from a trusted canonical point; expose degraded status to dependants until caught up.
- **Escalation:** stop automated recovery on a reorg deeper than qualified bounds or when canonical history cannot be established.
- **Related documentation:** `420-indexer/README.md`, `docs/architecture/infrastructure/420indexer.md`.

## TRB-INDEXER-004 — Indexer and canonical RPC disagree

- **Audience:** user, developer, operator
- **Surface:** 420Indexer versus canonical RPC
- **Symptom:** balance, receipt, block, event or protocol object differs between the Indexer and a qualified RPC read.
- **Severity:** degraded
- **Authority source:** canonical RPC/contract state at the relevant finality level.
- **Likely causes:** stale projection; reorg reconciliation; different finality horizons; decoder bug; wrong environment.
- **Diagnostic evidence:** chain ID, block number/hash, finality level, canonical RPC response, Indexer response and cursor.
- **Retry safety:** unsafe for state-changing actions based only on the derived view.
- **Recovery steps:** confirm both reads target the same environment/block; prefer canonical state; reconcile/rebuild the Indexer projection; do not mutate canonical state to make the projection match.
- **Escalation:** escalate if a fully caught-up Indexer disagrees with finalized canonical state.
- **Related documentation:** `docs/troubleshooting/chain-rpc-transactions.md`, `docs/reference/generated/indexer-api.md`.

## TRB-EXPLORER-001 — Explorer does not show a known transaction or block

- **Audience:** user, developer
- **Surface:** 420 Explorer
- **Symptom:** canonical RPC confirms a transaction/block, but Explorer cannot find or display it.
- **Severity:** degraded
- **Authority source:** canonical RPC/receipt/block state.
- **Likely causes:** Indexer lag; Explorer cache lag; reorg reconciliation; search-index delay.
- **Diagnostic evidence:** transaction hash/block hash, canonical receipt/block response, Explorer timestamp/version if shown.
- **Retry safety:** unsafe for repeating the original write solely because Explorer is missing it.
- **Recovery steps:** verify canonical inclusion/finality; refresh after Indexer catch-up; use direct canonical identifiers rather than search where available.
- **Escalation:** escalate if finalized canonical data remains absent after dependent services report healthy/caught-up.
- **Related documentation:** `docs/apps/explorer/index.md`, `docs/troubleshooting/chain-rpc-transactions.md`.

## TRB-EXPLORER-002 — Explorer shows stale or conflicting transaction state

- **Audience:** user, developer
- **Surface:** 420 Explorer
- **Symptom:** Explorer reports pending/failed/success or block/finality information that conflicts with canonical RPC.
- **Severity:** degraded
- **Authority source:** canonical receipt/block/finality state.
- **Likely causes:** cache lag; reorg; delayed projection; stale finality metadata.
- **Diagnostic evidence:** transaction hash, canonical receipt, block hash, safe/finalized markers, Explorer view timestamp.
- **Retry safety:** conditional; never retry a write from Explorer state alone.
- **Recovery steps:** verify canonical receipt and block; wait for projection reconciliation; treat Explorer as presentation only.
- **Escalation:** escalate if a finalized receipt remains misrepresented after services are healthy.
- **Related documentation:** `docs/apps/explorer/index.md`, `docs/troubleshooting/chain-rpc-transactions.md`.

## TRB-SEARCH-001 — Search cannot find an existing object

- **Audience:** user, developer
- **Surface:** 420 Search
- **Symptom:** an address, transaction, block, protocol object or application record exists but search returns no result.
- **Severity:** degraded
- **Authority source:** owning canonical protocol/chain state; Search only for discovery.
- **Likely causes:** search indexing lag; unsupported object class; stale derived index; normalization/tokenization mismatch.
- **Diagnostic evidence:** canonical identifier, object type, environment, exact query, Search/index version if exposed.
- **Retry safety:** safe for search queries.
- **Recovery steps:** navigate using the canonical identifier/direct route; confirm the object at its authority source; allow/rebuild the search index.
- **Escalation:** escalate if a supported finalized/canonical object remains undiscoverable after the index is current.
- **Related documentation:** `docs/apps/search/index.md`.

## TRB-SEARCH-002 — Search returns an unexpected or stale result

- **Audience:** user, developer
- **Surface:** 420 Search
- **Symptom:** result metadata, ownership, status or ranking appears outdated or conflicts with the source application/protocol.
- **Severity:** degraded
- **Authority source:** owning protocol/chain state.
- **Likely causes:** stale indexed document; reorg; delayed metadata refresh; ambiguous query.
- **Diagnostic evidence:** result identifier, canonical source state, index timestamp/version, query text.
- **Retry safety:** safe for reads.
- **Recovery steps:** open the canonical object directly; verify current state; refresh/reindex the derived search document.
- **Escalation:** escalate if stale data could cause unsafe signing/value decisions and cannot be clearly marked or corrected.
- **Related documentation:** `docs/apps/search/index.md`.

## TRB-ANALYTICS-001 — Analytics totals differ from canonical data

- **Audience:** user, developer, operator
- **Surface:** 420 Analytics
- **Symptom:** counts, balances, volumes, participation or other aggregates differ from direct canonical reads.
- **Severity:** degraded
- **Authority source:** canonical chain/protocol records; Analytics is derived.
- **Likely causes:** lagging data window; reorg; aggregation definition mismatch; incomplete indexer catch-up; sampling/filter differences.
- **Diagnostic evidence:** metric name/definition, time range, block range, finality policy, source cursor, canonical comparison sample.
- **Retry safety:** safe for reads.
- **Recovery steps:** align windows/finality/filters; compare against canonical samples; rebuild/recompute derived aggregates when needed.
- **Escalation:** escalate if published metrics materially affect financial, governance or operational decisions and provenance cannot be established.
- **Related documentation:** `docs/apps/analytics/index.md`, `docs/architecture/infrastructure/420indexer.md`.

## TRB-ANALYTICS-002 — Analytics changed after a reorg or rebuild

- **Audience:** user, developer, operator
- **Surface:** 420 Analytics
- **Symptom:** historical values change after previously being displayed.
- **Severity:** info
- **Authority source:** canonical history plus the documented metric definition/finality window.
- **Likely causes:** non-final data was included; bounded reorg; corrected/rebuilt projection.
- **Diagnostic evidence:** old/new block ranges, finality status, rebuild/reorg event, metric definition.
- **Retry safety:** not-applicable.
- **Recovery steps:** distinguish provisional from finalized analytics; publish provenance/finality window; recompute from canonical history where required.
- **Escalation:** escalate if finalized-window analytics change without a documented data-definition or correction reason.
- **Related documentation:** `docs/apps/analytics/index.md`.

## TRB-STATUS-001 — Service is healthy but not ready

- **Audience:** user, developer, operator
- **Surface:** 420 Status and service health/readiness
- **Symptom:** liveness/health is positive while readiness is negative/degraded.
- **Severity:** degraded
- **Authority source:** the service's readiness contract for whether it should receive normal traffic.
- **Likely causes:** dependency unavailable; catch-up/replay in progress; initialization incomplete; chain/finality lag; degraded provider.
- **Diagnostic evidence:** health response, readiness response, dependency state, version/build, cursor/finality where applicable.
- **Retry safety:** safe for health/readiness reads.
- **Recovery steps:** keep the service out of normal traffic; restore dependencies/catch-up; only restore routing when readiness criteria pass.
- **Escalation:** escalate if readiness can only be forced by disabling safety/freshness checks.
- **Related documentation:** `docs/architecture/infrastructure/observability-status-operator-services.md`.

## TRB-STATUS-002 — Status dashboard disagrees with direct service checks

- **Audience:** user, developer, operator
- **Surface:** 420 Status
- **Symptom:** Status reports healthy/degraded/down differently from direct service checks.
- **Severity:** degraded
- **Authority source:** direct service-specific health/readiness plus canonical chain/protocol checks; Status is aggregation/presentation.
- **Likely causes:** polling delay; notification lag; stale cache; partial regional/provider outage.
- **Diagnostic evidence:** dashboard timestamp, direct health/readiness responses, region/endpoint, incident identifier.
- **Retry safety:** safe for reads.
- **Recovery steps:** verify the affected service directly; prefer direct readiness for routing decisions; allow Status to reconcile without rewriting service state.
- **Escalation:** escalate if Status systematically masks a safety-relevant outage or marks unsafe services ready.
- **Related documentation:** `docs/apps/status/index.md`, `docs/architecture/infrastructure/observability-status-operator-services.md`.

## Canonical fallback order

When a derived surface is missing, stale or contradictory:

1. confirm environment/chain identity;
2. query a qualified canonical RPC endpoint;
3. establish the relevant block/receipt/contract state and finality level;
4. inspect the Indexer cursor/readiness if the derived service depends on it;
5. diagnose Explorer/Search/Analytics/Status presentation only after canonical truth is established;
6. repair/rebuild the derived layer without mutating canonical state simply to match the UI.

Explorer, Search, Analytics, Status and Indexer can all be unavailable while consensus/execution remain healthy.