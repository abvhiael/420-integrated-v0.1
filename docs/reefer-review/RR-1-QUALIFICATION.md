# RR-1 — Persistent Cannabis Newsfeed qualification

## Step

**RR-1 — Persistent Cannabis Newsfeed**

## Status

**COMPLETE — Level 1 PASS**

RR-1 is complete at the repository/application layer. This does not claim RR-2 user-facing completion, scheduled polling, live ecosystem integration, testnet readiness, Genesis readiness or production readiness.

## Qualification level

Level 1 — ordinary roadmap-step fast qualification.

Level 2 is not required for RR-1 because the next meaningful app integration milestone is the RR-2/RR-3 user-facing/editorial convergence. Level 3 remains deferred to RR-10 app-phase closeout.

## Exact implementation SHA

`26e5bbf50da09d745b1838e8d35694912cf3e55b`

## Evidence commit

This document and the roadmap status update are evidence-only. They may be committed after the qualified implementation SHA without recursive substantive qualification because they change no executable source, tests, workflows, dependencies, configuration, interfaces, runtime artifacts or deployment state.

## Repository state at qualification

- Repository: `abvhiael/420-integrated-v0.1`
- Branch: `reefer-review-rr1-newsfeed-20261007`
- PR: #562
- Base/main SHA: `c8e8b58d818611276f7a9bb2b8d2241004450d97`
- Implementation head: `26e5bbf50da09d745b1838e8d35694912cf3e55b`
- Divergence: ahead 8 / behind 0
- PR state: OPEN / MERGEABLE / UNMERGED

## Requirements satisfied

### RR-1.1 — External news data model
Implemented `ExternalNewsItem`, source metadata, canonical URL/hash, feed GUID, content fingerprint, categories/topics, language, attribution, lifecycle status and timestamps.

### RR-1.2 — Persistent news store
Implemented restart-safe JSON file storage with schema versioning, owner-only creation permissions, temporary-file write plus atomic rename, persisted deduplication state, visible-only retrieval and keyset pagination.

### RR-1.3 — RSS/Atom source adapter
Implemented bounded RSS 2.0 and Atom fetch/parse support. Feed fetches default to a 2 MiB ceiling; XML document type/entity declarations are rejected.

### RR-1.4 — Normalized ingestion pipeline
Implemented normalization from publisher feed entries into the external-news model. Full third-party article bodies are not imported.

### RR-1.5 — Deduplication + canonical URL handling
Implemented fragment/tracking-parameter removal, deterministic stable IDs, canonical URL hashing, same-source GUID continuity, content fingerprints and cursor/filter binding.

### RR-1.6 — Source registry and trust controls
Added `config/reefer-review-news-sources.json` with HTTPS-only validation, unique source/feed constraints, explicit attribution/excerpt/image policy and minimum poll cadence. Initial enabled sources are Marijuana Moment and High Times RSS feeds; image ingestion is disabled.

### RR-1.7 — Cannabis-topic relevance filtering
Implemented deterministic cannabis vocabulary admission plus topic classification. Unrelated items are retained as REJECTED and excluded from the public news API.

### RR-1.8 — Persistent newsfeed HTTP API
Implemented:
- `GET /v1/news`
- `GET /v1/news/{id}`
- `GET /v1/news/sources`
- `GET /v1/news/topics`

Added typed Go client methods for list/get/sources/topics.

### RR-1.9 — Feed ingestion/restart/recovery tests
Added unit/integration coverage for:
- URL canonicalization/stable IDs;
- RSS and Atom parsing;
- document-type rejection;
- cannabis relevance/topic classification;
- persistence across reopen;
- keyset cursor stability after new inserts;
- cursor/filter mismatch rejection;
- feed-GUID continuity;
- relevant vs unrelated ingestion;
- source-registry HTTPS rejection;
- public HTTP list/item/source/topic behavior;
- fail-closed news service absence;
- bad-limit handling.

## Implementation files

- `reefer-review/news_model.go`
- `reefer-review/news_sources.go`
- `reefer-review/news_store.go`
- `reefer-review/news_feed.go`
- `reefer-review/news_service.go`
- `reefer-review/news_http.go`
- `reefer-review/news_test.go`
- `reefer-review/news_http_test.go`
- `reefer-review/http.go`
- `reefer-review/client/client.go`
- `reefer-review/README.md`
- `cmd/reefer-review/main.go`
- `cmd/reefer-news-sync/main.go`
- `config/reefer-review-news-sources.json`
- `docs/reefer-review/RR-ROADMAP.md`
- `docs/reefer-review/RR-1-PERSISTENT-CANNABIS-NEWSFEED.md`
- `scripts/verify-reefer-review-rr1.py`
- `.github/workflows/reefer-review-rr1.yml`

## Level 1 results

### Reefer Review RR-1
- Run: **37661090836**
- Job: `qualify`
- Result: **PASS**
- Exact implementation SHA: `26e5bbf50da09d745b1838e8d35694912cf3e55b`

Passed:
- exact qualification-head assertion;
- Go format;
- RR-1 unit/integration tests;
- Go race qualification;
- Go vet;
- RR-1 static verifier;
- retained Reefer Review audit regression.

### Reefer Review Audit
- Run: **37661091019**
- Job: `qualify`
- Result: **PASS**
- Exact implementation SHA: `26e5bbf50da09d745b1838e8d35694912cf3e55b`

Passed:
- Go format;
- Go tests;
- static Reefer Review audit verifier;
- shared GEN-SVC validator.

## Failure diagnosis and repairs

Earlier exact heads failed deterministically at Go formatting. The failure was diagnosed from the exact failed job/step, not blindly rerun:
- initial HTTP replacement contained literal escaped newline/tab characters and omitted news route registration;
- the repaired HTTP file exposed ordinary gofmt deltas in `news_feed.go` and `cmd/reefer-news-sync/main.go`;
- those formatting defects were repaired narrowly;
- final exact implementation SHA `26e5bbf...` passed all required Level 1 checks.

Unrelated broad push-time governance workflow failures are not RR-1 qualification evidence and were not treated as required app-step gates.

## Security/adversarial results

PASS:
- public news API returns only VISIBLE records;
- unrelated feed items are rejected from public admission;
- insecure HTTP feed registry entries are rejected;
- malformed/unsafe XML document-type input is rejected;
- feed size is bounded;
- cursor replay under a different filter set is rejected;
- duplicate GUID continuity avoids duplicate semantic items;
- persistence survives store reopen;
- API fails closed with 503 when the news service is not configured.

## Intentionally deferred

- RR-2 full persistent homepage/news navigation and polished reader UX;
- RR-6 live 420Search projection of external news;
- RR-7 comprehensive production network-ingestion hardening including SSRF/DNS-rebinding/redirect policy;
- RR-8 background scheduling, conditional GET, retry/backoff/circuit breaking and source-health operations;
- RR-9 production deployment/observability/backup/browser E2E/load qualification;
- RR-10 complete Level 3 app-phase qualification;
- REEFER-AUDIT-7+ live testnet/Genesis/production gates.

## Limitations

RR-1 uses a file-backed JSON store suitable for repository/development persistence. It is not being claimed as the final production database. Ingestion is one-shot/operator-triggered through `cmd/reefer-news-sync`; automatic polling is deliberately deferred to RR-8. The current user-facing page does not yet render the new persistent news API; that is the next roadmap step.

## Completion state

- RR-1 implementation: **COMPLETE**
- Level 1: **PASS**
- Level 2: **NOT REQUIRED AT THIS STEP**
- Level 3: **DEFERRED TO RR-10**
- TESTNET READY: **NO**
- GENESIS READY: **NO**
- PRODUCTION READY: **NO**

## Next canonical roadmap step

**RR-2 — User-Facing News App**
