# ReeferReview completion roadmap

This roadmap extends the repository-qualified ReeferReview MVP without replacing the canonical REEFER-AUDIT-7 through REEFER-AUDIT-10 live/testnet/Genesis/production gates.

## RR-1 — Persistent Cannabis Newsfeed

**Purpose:** add a durable external cannabis-news foundation while preserving a strict distinction between third-party linked news and ReeferReview-authored Publications.

Status: **COMPLETE / LEVEL 1 PASS**

### RR-1.1 — External news data model
Distinct `ExternalNewsItem` records with source attribution, canonical URL, metadata, feed GUID, content fingerprint, topics, status and timestamps.

### RR-1.2 — Persistent news store
Restart-safe file-backed repository with atomic replacement, stable IDs and persisted deduplication state.

### RR-1.3 — RSS/Atom source adapter
Bounded RSS 2.0 and Atom fetch/parse support with explicit XML document-type/entity rejection.

### RR-1.4 — Normalized ingestion pipeline
Normalize publisher metadata into one schema without importing full third-party article bodies.

### RR-1.5 — Deduplication + canonical URL handling
Strip common tracking parameters, hash canonical URLs, preserve feed-GUID continuity and bind pagination cursors to filters.

### RR-1.6 — Source registry and trust controls
Reviewed HTTPS-only source registry with enabled state, attribution policy, excerpt/image policy and minimum poll cadence.

### RR-1.7 — Cannabis-topic relevance filtering
Deterministic cannabis relevance gate and topic classification before public feed admission.

### RR-1.8 — Persistent newsfeed HTTP API
`GET /v1/news`, `GET /v1/news/{id}`, `GET /v1/news/sources`, `GET /v1/news/topics`; typed Go client coverage.

### RR-1.9 — Feed ingestion/restart/recovery tests
Unit/integration coverage for RSS/Atom parsing, canonicalization, relevance, persistence across reopen, GUID deduplication, keyset cursor behavior, API admission and one-shot ingestion.

**RR-1 exit criteria:** SATISFIED. All nine requirements are implemented and the app-specific Level 1 workflow passed on exact implementation SHA `26e5bbf50da09d745b1838e8d35694912cf3e55b`; durable evidence is recorded in `RR-1-QUALIFICATION.md`. Level 2 is not required until the RR-2/RR-3 user-facing/editorial integration milestone. Level 3 remains deferred to complete app-phase closeout.

**Next canonical roadmap step:** RR-2 — User-Facing News App.

## RR-2 — User-Facing News App
Persistent homepage newsfeed, Latest/Cannabis News/ReeferReview Originals/Topics/Search navigation, attribution/read-original handoff, filtering and responsive accessibility.

Status: **COMPLETE / LEVEL 1 PASS**

**RR-2 exit criteria:** SATISFIED. The user-facing news application is implemented and the app-specific Level 1 workflow passed on exact implementation SHA `37017d8157f180297b7771cea1d3c228cf527a30`; retained ReeferReview backend/audit and RR-1 verification also passed inside that exact-head workflow. Durable evidence is recorded in `RR-2-QUALIFICATION.md`. Level 2 remains deferred until the documented RR-2/RR-3 user-facing/editorial convergence after RR-3. Level 3 remains deferred to RR-10.

**Next canonical roadmap step:** RR-3 — Editorial Publishing Completion.

## RR-3 — Editorial Publishing Completion
Article reader, authenticated writer/publish workflow, revisions, tombstone lifecycle, restricted reads, moderation dashboard/history and API/client parity.

Status: **COMPLETE / LEVEL 1 PASS + LEVEL 2 PASS**

RR-3 is the documented RR-2/RR-3 user-facing/editorial convergence milestone. Its exit criteria are SATISFIED on exact implementation SHA `b264250d5014cc30435b86e09d3f2143668cdfb8`: Reefer Review RR-3 Level 1 run `37668110302` PASS and Reefer Review Level 2 Integration run `37668110367` PASS. Durable evidence is recorded in `RR-3-QUALIFICATION.md`. Level 3 remains deferred to RR-10.

**Next canonical roadmap step:** RR-4 — Identity & Permissions.

## RR-4 — Identity & Permissions
Production 420Identity/Wallet sessions, scoped author/publisher/moderator capabilities, revocation/expiry, no public reliance on `X-420-Actor`.

Status: **COMPLETE / LEVEL 1 PASS + AUTHORITY-MILESTONE LEVEL 2 PASS**

RR-4 is an authority milestone because it replaces the development actor boundary with the verified Wallet/420Identity session/capability boundary. Its exit criteria are SATISFIED on exact implementation SHA `74b6f6777dfa47442654b8afcbc4888fe574c3cb`: Reefer Review RR-4 Level 1 run `37673979895` PASS and Reefer Review Level 2 Integration run `37673979982` PASS. Durable evidence is recorded in `RR-4-QUALIFICATION.md`. Level 3 remains deferred to RR-10.

**Next canonical roadmap step:** RR-5 — Durable Storage & Rights.

## RR-5 — Durable Storage & Rights
Persistent publication store, qualified 420 Storage, encryption/integrity, durable idempotency and live 420 Rights provenance.

Status: **COMPLETE / LEVEL 1 PASS + STORAGE-RIGHTS MILESTONE LEVEL 2 PASS**

RR-5 is a material shared-dependency milestone because it replaces development-only publication persistence/body storage/Rights evidence with repository-qualified durable metadata, a bounded 420 Storage integration contract, and structured 420 Rights provenance. Its exit criteria are SATISFIED on exact implementation SHA `914329517c385a60f382216ce505313b1c6e3342`: Reefer Review RR-5 Level 1 run `37687046770` PASS and Reefer Review Level 2 Integration run `37687047515` PASS. Durable evidence is recorded in `RR-5-QUALIFICATION.md`. Level 3 remains deferred to RR-10.

**Next canonical roadmap step:** RR-6 — Ecosystem Integrations.

## RR-6 — Ecosystem Integrations
Live 420 Search, 420 Notifications and 420Mail adapters plus reconciliation/failure handling.

Status: **IMPLEMENTED / LEVEL 1 + ECOSYSTEM-INTEGRATION LEVEL 2 QUALIFICATION PENDING**

RR-6 is a material cross-component milestone because it replaces the generic Search/Notifications/Mail hooks with concrete repository integration contracts for all three shared services and adds durable outage reconciliation. Complete it only after the exact accumulated implementation SHA passes both the RR-6 Level 1 workflow and the retained ReeferReview Level 2 integration workflow.

## RR-7 — Newsfeed Security
SSRF/redirect/DNS-rebinding controls, parser hardening, sanitization, source allowlisting, fetch limits, copyright/attribution enforcement and adversarial ingestion tests.

## RR-8 — Feed Operations
Background polling scheduler, conditional GET, retry/backoff/circuit breaking, source health, checkpoints and operator source dashboard.

## RR-9 — Web UX & Deployment
Production frontend/backend deployment configuration, API routing, security headers/rate limits, logs/metrics/alerts, backup/restore and browser E2E/accessibility/load qualification.

## RR-10 — Repository Level 3 Closeout
Reconcile accumulated app work with current main and execute the complete app-phase Level 3 qualification once on the exact merge-candidate implementation SHA.

After RR-10, resume the existing canonical live gates: REEFER-AUDIT-7 live dependency integration, REEFER-AUDIT-8 deployed security/operations, REEFER-AUDIT-9 Genesis decision/release closeout, and REEFER-AUDIT-10 production closeout.
