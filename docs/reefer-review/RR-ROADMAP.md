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

Status: **COMPLETE / LEVEL 1 PASS + ECOSYSTEM-INTEGRATION MILESTONE LEVEL 2 PASS**

RR-6 is a material cross-component milestone because it replaces the generic Search/Notifications/Mail hooks with concrete repository integration contracts for all three shared services and adds durable outage reconciliation. Its RR-6.A–RR-6.H repository-stage exit criteria are SATISFIED on exact implementation SHA `e8cb1c85186701602a7a348cef6347df3eba7459`: Reefer Review RR-6 Level 1 run `37694358214` PASS and Reefer Review Level 2 Integration run `37694358258` PASS. Durable evidence is recorded in `RR-6-QUALIFICATION.md`. Level 3 remains deferred to RR-10, and deployed Search/Notifications/Mail provider evidence remains under the REEFER-AUDIT-7+ testnet handoff.

**Next canonical roadmap step:** RR-7 — Newsfeed Security.

## RR-7 — Newsfeed Security
SSRF/redirect/DNS-rebinding controls, parser hardening, sanitization, source allowlisting, fetch limits, copyright/attribution enforcement and adversarial ingestion tests.

Status: **COMPLETE at repository Level 1 + Level 2** on implementation SHA `c0f874efbd754c9ff49c313c3096ed0c6488572c`; passing runs `37695907354` and `37695907728`. Durable record: `RR-7-QUALIFICATION.md`. Live security and Level 3 reconciliation remain separate.


## RR-8 — Feed Operations
Background polling scheduler, conditional GET, retry/backoff/circuit breaking, source health, checkpoints and operator source dashboard.

Status: **COMPLETE at repository Level 1 + Level 2** on implementation SHA `43a44e756fceb1b811c1992ca5b48df0558b76bb`; passing runs `37697397017` and `37697397030`. Durable record: `RR-8-QUALIFICATION.md`. Live operations and Level 3 reconciliation remain separate.


## RR-9 — Web UX & Deployment
Production frontend/backend deployment configuration, API routing, security headers/rate limits, logs/metrics/alerts, backup/restore and browser E2E/accessibility/load qualification.

Status: **REPOSITORY LEVEL 1 + LEVEL 2 PASS; CANONICAL DEPLOYMENT QUALIFICATION PARTIAL**

Exact executable SHA `d5ddc7e1ae63aaf86df5ccb3a8a791313d310116`: RR-9 Level 1 `37718113350` PASS and Level 2 `37718113288` PASS, including mocked Chromium/browser-a11y tests and local backup recovery tests. See `RR-9-QUALIFICATION.md` and `RR-9-WEB-UX-DEPLOYMENT.md`. Live same-origin routing, non-development adapters, distributed ingress, operational alerts, remote disaster recovery and production-equivalent browser/load checks remain unqualified; RR-9 is NOT fully COMPLETE.


## RR-10 — Repository Level 3 Closeout
Reconcile accumulated app work with current main and execute the complete app-phase Level 3 qualification once on the exact merge-candidate implementation SHA.

Status: **COMPLETE — REPOSITORY LEVEL 3 PASS; PRODUCTION/LIVE GATES EXPLICITLY OUTSTANDING**

Qualified reconciled implementation SHA: `a513e2ecf99c08688465623393f441eb753c903b`. Reconciliation base `main` SHA: `c6b62a6ea75be97564564e56b779dfad7df3f784`. Canonical Solidity four-shard full Foundry inventory `37727302938` PASS; Genesis/address authority (without duplicate Foundry) `37727302974` PASS; 420 Integrated `37727302915` PASS; 420Docs `37727302963` PASS; 420Indexer `37727303004` PASS; retained app Level 2 `37727303025` PASS; RR-1–RR-9 and audit workflows PASS. Durable full evidence: `RR-10-LEVEL3-QUALIFICATION.md`. The closing evidence-only commit inherits this qualified implementation SHA. PR #562 stays open until an authorized merge.

**Scope boundary:** RR-10 marks only repository-phase Level 3 complete. RR-9 still has unqualified deployed production requirements (real provider integration, trusted ingress and TLS, observability/alerts, offsite recovery and deployed E2E/accessibility/load) and remains **PARTIAL / NOT PRODUCTION QUALIFIED**. REEFER-AUDIT-7 through REEFER-AUDIT-10 live/testnet/Genesis/release gates remain open; do not construe this as production or testnet release authorization.


After RR-10, resume the existing canonical live gates: REEFER-AUDIT-7 live dependency integration, REEFER-AUDIT-8 deployed security/operations, REEFER-AUDIT-9 Genesis decision/release closeout, and REEFER-AUDIT-10 production closeout.


## RR-11 — Standalone RSS News Aggregation (new post-RR-10 app phase)

Purpose: make the existing RSS/Atom news ingestion, scheduled polling, durable news store and public ReeferReview news UI operable independently of the 420 Integrated blockchain/testnet. This is an additive app-scoped step, authorized after the prior RR-10 repository audit closeout; it does not rename, replace, or reopen RR-1–RR-10.

**Status: COMPLETE — REPOSITORY LEVEL 1 + LEVEL 2 PASS, LIVE/PRODUCTION GATES OPEN.** Qualified implementation SHA `93f4bd0b547ab1b72e584968b1f800ba886255f6`, base `main` `d112b2eb55b50a3a4f52a5e2a5364374595efe71`; all RR-1–RR-9 and ReeferReview Audit plus retained Level 2 completed successfully; durable record: `RR-11-QUALIFICATION.md`. Evidence-only bookkeeping inherits that SHA without requalification. The separately specified live feed approval/permission, deployment, Cloudflare ingress, admin operation, and release acceptance criteria remain **UNVERIFIED**; do not construe this repository status as production COMPLETE. Level 3 deferred to full new app-phase closeout. PR #568 remains open pending authorized merge.  Launch sources: StratCann (Canadian priority), Marijuana Moment (policy), MJBizDaily and Green Market Report (business/markets). News sections: Latest, Canada, Legalization & Policy, Medical & Research, Cultivation, Business & Markets, Culture and International. Feed endpoints and rights must be validated before activation; disable unknown endpoints and fail closed, not fake a live feed. Admin requirements: capability-protected and persistent source enable/disable/add/edit, URL and SSRF validation, per-source category and polling controls, health/failure visibility and audit trail, rejection of unauthorized and malformed changes. Existing RR-7 news security, RR-8 conditional poller, public API and website must be preserved.

**Level 1 exit criteria:** verified approved feeds and use rights; safe backend source management and persistent scheduled RSS ingestion; all eight visible/filterable news sections; provenance labels/canonical publisher outbound links; live admin management with authorization, negative/SSRF/concurrency tests; same-origin public API; successful affected Go/browser/verifier/app-specific fast CI against one executable SHA. **Level 2 milestone:** retained ReeferReview app integration once ingestion, API and admin converge. **Level 3:** one complete new app-phase closeout after its final accumulated scope, not after each change. **External live gates:** Cloudflare/backend publication, real DNS/TLS/API routing and deployed RSS egress/storage qualification; 420 testnet is not needed for read-only RSS, and REEFER-AUDIT-7–10 on-chain/live service gates remain separate.
