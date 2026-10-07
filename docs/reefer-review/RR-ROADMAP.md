# ReeferReview completion roadmap

This roadmap extends the repository-qualified ReeferReview MVP without replacing the canonical REEFER-AUDIT-7 through REEFER-AUDIT-10 live/testnet/Genesis/production gates.

## RR-1 — Persistent Cannabis Newsfeed

**Purpose:** add a durable external cannabis-news foundation while preserving a strict distinction between third-party linked news and ReeferReview-authored Publications.

Status: **IMPLEMENTED / LEVEL 1 QUALIFICATION PENDING**

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

**RR-1 exit criteria:** all nine requirements implemented; app-specific Level 1 workflow green on one exact implementation SHA; durable qualification evidence recorded. Level 2 is not required until the RR-2/RR-3 user-facing/editorial integration milestone. Level 3 remains deferred to complete app-phase closeout.

## RR-2 — User-Facing News App
Persistent homepage newsfeed, Latest/Cannabis News/ReeferReview Originals/Topics/Search navigation, attribution/read-original handoff, filtering and responsive accessibility.

## RR-3 — Editorial Publishing Completion
Article reader, authenticated writer/publish workflow, revisions, tombstone lifecycle, restricted reads, moderation dashboard/history and API/client parity.

## RR-4 — Identity & Permissions
Production 420Identity/Wallet sessions, scoped author/publisher/moderator capabilities, revocation/expiry, no public reliance on `X-420-Actor`.

## RR-5 — Durable Storage & Rights
Persistent publication store, qualified 420 Storage, encryption/integrity, durable idempotency and live 420 Rights provenance.

## RR-6 — Ecosystem Integrations
Live 420 Search, 420 Notifications and 420Mail adapters plus reconciliation/failure handling.

## RR-7 — Newsfeed Security
SSRF/redirect/DNS-rebinding controls, parser hardening, sanitization, source allowlisting, fetch limits, copyright/attribution enforcement and adversarial ingestion tests.

## RR-8 — Feed Operations
Background polling scheduler, conditional GET, retry/backoff/circuit breaking, source health, checkpoints and operator source dashboard.

## RR-9 — Web UX & Deployment
Production frontend/backend deployment configuration, API routing, security headers/rate limits, logs/metrics/alerts, backup/restore and browser E2E/accessibility/load qualification.

## RR-10 — Repository Level 3 Closeout
Reconcile accumulated app work with current main and execute the complete app-phase Level 3 qualification once on the exact merge-candidate implementation SHA.

After RR-10, resume the existing canonical live gates: REEFER-AUDIT-7 live dependency integration, REEFER-AUDIT-8 deployed security/operations, REEFER-AUDIT-9 Genesis decision/release closeout, and REEFER-AUDIT-10 production closeout.
