# GEN-10.3 — 420Search roadmap

420Search is a contract-free, non-authoritative discovery application for the 420 Integrated ecosystem. Development is stacked on `feature/gen10-3-420search-v1` through SEARCH-10 and merged as one GEN-10.3 change set after final reconciliation and qualification.

## Frozen architecture

- 420Search owns no canonical protocol state.
- 420Search does not crawl node420 RPC and does not implement chain ingestion, finality, checkpoints, reorg processing, or protocol decoding independently of 420Indexer.
- Chain-derived discovery consumes the qualified 420Indexer public API.
- Search-owned indexes, ranking, relevance, snippets, categories and sponsorship metadata are rebuildable, replaceable presentation infrastructure.
- Resolver search and discovery search are separate modes.
- Resolver search resolves exact canonical identifiers through qualified source adapters.
- Discovery search provides text/prefix/category/relevance retrieval over rebuildable Search projections that preserve canonical source references.
- Search must fail closed on wrong-chain, stale, degraded or provenance-invalid upstream state where canonical context matters.
- Private Messenger payloads, private Commons content, private Identity fields, encrypted Resource payloads and raw Attention telemetry are excluded from indexing.
- Sponsored placement is always explicit and cannot alter canonical ownership, identity, rights, registration, payment, trust, validator or protocol fields.

## Roadmap

| Phase | Scope | Exit condition |
| --- | --- | --- |
| SEARCH-0 | Architecture freeze and qualification contract | Service identity, authority boundary, search modes, domains, privacy exclusions and SRCH invariants executable in tests |
| SEARCH-1 | Qualified 420Indexer consumer | Search client consumes only documented Indexer v1 endpoints with health/readiness/status/provenance and fail-closed upstream semantics |
| SEARCH-2 | Search result model | Stable result IDs, canonical source reference, source authority, chain/finality/freshness metadata, categories, snippets and deep-link contract |
| SEARCH-3.1 | Core chain discovery | Blocks, transactions, addresses and contracts resolve through qualified Indexer projections |
| SEARCH-3.2 | Registry discovery | Registered services/applications/versions searchable with 420Registry provenance |
| SEARCH-3.3 | Names and public Identity | 420 Names and explicitly public Identity/profile discovery with privacy exclusions |
| SEARCH-3.4 | Assets and validators | Native $420, indexed assets and validator/consensus discovery |
| SEARCH-3.5 | Public ecosystem domains | Public Market, Rights, Commons and Pulse records available through source adapters |
| SEARCH-4.1 | Query parsing | Exact identifiers, prefixes, text queries, filters and type-aware routing |
| SEARCH-4.2 | Ranking | Deterministic documented default ranker with stable tie-breaking and non-canonical relevance metadata |
| SEARCH-4.3 | Sponsored discovery | Explicit sponsorship metadata isolated from canonical result fields |
| SEARCH-4.4 | Snapshot pagination | Stable result IDs and deterministic pagination for a fixed Search snapshot |
| SEARCH-5 | Search HTTP API | Versioned search/suggest/resolve/capabilities/health/readiness/status surface with bounded input contracts |
| SEARCH-6.1 | Privacy hardening | Negative-index and source-admission tests enforce all genesis privacy exclusions |
| SEARCH-6.2 | Reorg/finality/freshness behavior | Results expose freshness/finality and stale/reorged projections are handled without rewriting finalized truth |
| SEARCH-6.3 | Abuse/resource controls | Query length/result/time bounds, pathological-query regression tests and rate-limit hooks |
| SEARCH-7.1 | Frontend shell | Global search, navigation, filters and result-domain UX |
| SEARCH-7.2 | Result presentation | Domain-specific cards/views for all required genesis domains |
| SEARCH-7.3 | Trust presentation | Canonical source, provenance, freshness, finality, sponsored and privacy-safe labels visible to users |
| SEARCH-8 | Runtime/deployment | `search420` runtime, configuration, graceful shutdown, container packaging and operational probes |
| SEARCH-9 | Testnet qualification | Live Indexer integration, seeded domain evidence, restart/rebuild/reorg validation and machine-readable evidence |
| SEARCH-10 | Genesis closeout | Full SRCH invariant audit, docs/readiness completion, final qualification matrix and reconciliation with current main |

## Qualification policy

Every phase must remain green before moving forward. The branch is not merged phase-by-phase. SEARCH-0 through SEARCH-10 stay stacked on the same feature branch, with final reconciliation against current `main` immediately before the single GEN-10.3 merge.
