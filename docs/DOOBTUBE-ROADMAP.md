# DoobTube — stable remediation roadmap

Status: **AUDIT BASELINE**
Date: 2026-10-06

This roadmap is dependency-ordered and must not be renumbered after adoption. Repository truth and later explicit architecture decisions override assumptions. DoobTube must not silently inherit or rename 420Media behavior.

## DOOBTUBE-0 — Canonical identity and architecture decision

Freeze the application identity **DoobTube** and adopt the canonical relationship to 420Media.

Required decisions:
- whether DoobTube is a consumer/front end of 420Media, a composition layer, an independent service, or an explicit replacement;
- whether it receives a new Registry/service identity;
- whether any Genesis consumer-service or frozen application-catalog change is required;
- whether any contracts are DoobTube-owned or all authority is delegated to existing protocols;
- authority, trust, data, privacy, moderation and custody boundaries.

**Status: COMPLETE (Level 1).** Canonical architecture: `docs/DOOBTUBE-ARCHITECTURE.md`. DoobTube is a replaceable user-facing application/client over `420/service/media/v1`; no second Media authority, Genesis catalog entry, consumer-service entry, frozen/reserved address or DoobTube-owned contract is created by this step.

**Exit:** adopted architecture document with no unresolved contradiction against 420Media, Genesis application decisions or consumer-service policy.

## DOOBTUBE-1 — Product scope and canonical user workflows

Define stable v1 requirements for:
- account/wallet and optional Identity behavior;
- channel/profile model if applicable;
- upload/publish/library/playback;
- feeds/discovery/search;
- livestreaming if in scope;
- subscriptions/following if in scope;
- comments/reactions/sharing if in scope;
- monetization if in scope;
- rights/provenance;
- privacy/visibility;
- reporting/moderation/appeals;
- deletion/retention/export;
- accessibility and responsive UX.

**Status: COMPLETE (Level 1).** Canonical V1 product definition: `docs/DOOBTUBE-PRODUCT-SCOPE.md`. The scope freezes anonymous public viewing, Wallet-gated creator/controller actions, optional Identity, creator/channel presentation without new authority, upload/library/playback, public discovery/Search, basic livestreaming, creator-update subscriptions, sharing, Rights/provenance, PRIVATE/UNLISTED/PUBLIC visibility, report/moderation/appeal, deletion/retention/export, and accessibility/responsive requirements. Comments/reactions and viewer monetization are explicit V1 non-goals.

**Exit:** requirement IDs, non-goals, state machines and acceptance criteria are frozen.

## DOOBTUBE-2 — Dependency and trust-boundary freeze

Map every required dependency to canonical 420Integrated interfaces, services, Registry identities and failure semantics.

Potential dependency categories include Registry, Wallet, Identity, Names, Rights, Storage, Search, Notifications, Pay, native 420/Token, Compute, Analytics, Verify, Arbitration, Governance, Treasury, Bridge, AI, Oracle Interface Layer and Indexer/Explorer.

Do not adopt a dependency merely because it exists elsewhere.

**Status: COMPLETE (Level 1).** Canonical dependency/trust definition: `docs/DOOBTUBE-DEPENDENCIES-TRUST.md`. Direct V1 dependencies are ProtocolRegistry, Wallet/SmartAccount authority, 420Media, optional 420Identity, 420Rights, 420Storage/Resource, 420Search and 420Notifications. 420Pay and Compute Market remain transitive through 420Media; unrelated ecosystem services are explicitly not adopted.

**Exit:** dependency graph, authority matrix, threat model and failure/degraded-mode model are committed.

## DOOBTUBE-3 — Data, storage, media-processing and lifecycle architecture

Define canonical objects and ownership for:
- media asset identity;
- upload preparation and canonical storage references;
- integrity/provenance;
- transcodes/thumbnails/posters/previews;
- playback manifests;
- lifecycle/delete/privacy;
- stream/session identity;
- processing jobs;
- rebuildable indexes/projections;
- persistence and recovery.

Explicitly decide whether existing 420Media/420Storage/420Compute surfaces are reused.

**Status: COMPLETE (Level 1).** Canonical data/lifecycle definition: `docs/DOOBTUBE-DATA-LIFECYCLE.md`. DoobTube reuses the qualified 420Media/420Storage/420 Compute Market lifecycle and freezes MediaAsset/Stream/Subscription ownership, complete Storage object identity, derivative/output semantics, playback locator authority, visibility/delete behavior, livestream recovery, rebuildable projection behavior, persistence classes, logical schemas, idempotency and recovery rules.

**Exit:** schemas, lifecycle/state machines and idempotency/recovery rules are frozen.

## DOOBTUBE-4 — Contracts and protocol adapters

Implement only the contracts/adapters proven necessary by DOOBTUBE-0 through -3.

Required where applicable:
- interfaces;
- access control/roles;
- initialization/deployment graph;
- signatures/domain separation/nonces/replay protection;
- accounting/settlement/refunds;
- pausing/emergency controls;
- Registry integration;
- events/errors;
- adversarial/fuzz/invariant/property tests.

**Status: COMPLETE (Level 1).** Canonical contract/adapter definition: `docs/DOOBTUBE-CONTRACTS-ADAPTERS.md`. DOOBTUBE-0 through -3 prove that V1 requires no DoobTube-owned Solidity contract, service ID, frozen address, deployment graph, custody or settlement authority. DOOBTUBE-4 therefore implements a contract-free executable adapter policy in `doobtube/integrations/ecosystem.py` with negative/boundary tests covering Registry, Media compatibility, Storage readiness, Search privacy/authority, Notifications consent/authority, direct Pay/Compute bypass and canonical-authority substitution.

**Exit:** exact contract scope compiles and passes app-specific qualification. If no DoobTube-owned contracts are required, document that decision and qualify the external protocol bindings instead.

## DOOBTUBE-5 — Backend/API/indexing/service control plane

Implement the canonical runtime:
- versioned API;
- authentication/authorization;
- idempotency;
- pagination/timestamps/stable errors;
- persistence/migrations;
- bounded retries;
- replay-safe jobs;
- reorg/finality handling;
- recovery/rebuild;
- secrets boundary;
- observability;
- health/readiness.

**Status: COMPLETE (Level 1).** Canonical backend/control-plane definition: `docs/DOOBTUBE-BACKEND-CONTROL-PLANE.md`. V1 now has a stdlib-only versioned `/v1` backend with Wallet/chain/capability admission, durable SQLite schema/migration, replay-safe idempotency, opaque pagination/RFC3339 timestamps/stable errors, bounded durable jobs, public-only reorg/finality-aware feed projection and deterministic rebuild, raw-secret rejection, protected metrics, and dependency-aware health/readiness.

**Exit:** clean build and requirement-mapped service/integration tests pass.

## DOOBTUBE-6 — Media processing, delivery and livestream integration

Implement upload, processing, verified playback delivery and livestreaming only where included in canonical scope.

Qualify:
- malformed/malicious media;
- parser/codec/process isolation;
- resource exhaustion;
- SSRF/egress boundaries;
- session/key leakage;
- operator/provider compromise;
- interrupted processing/retry;
- stale/invalid manifests;
- recovery after service restart.

**Exit:** processing/delivery workflows satisfy DOOBTUBE-3 invariants with adversarial tests.

## DOOBTUBE-7 — User-facing web application

Implement the production-intended web client:
- canonical routes/workflows;
- Wallet connection and network validation;
- loading/empty/error/transaction states;
- retry/recovery;
- safe media rendering;
- accessibility basics;
- responsive behavior;
- DoobTube branding/assets;
- fail-closed environment configuration;
- no private-key custody.

**Exit:** static build, frontend tests and browser-level integration against qualified service fixtures pass.

## DOOBTUBE-8 — Ecosystem integration milestone

Exercise all adopted cross-app dependencies together using exact interfaces and schemas.

Qualify:
- Registry discovery;
- Wallet/Identity authorization;
- Rights/provenance;
- Storage;
- Search/indexing;
- Notifications;
- Pay/settlement;
- Compute/media processing;
- moderation/arbitration where adopted;
- Analytics/Verify/Explorer visibility where adopted.

**Exit:** Level 2 app-integration qualification on one exact implementation SHA.

## DOOBTUBE-9 — Security, abuse and moderation qualification

Perform application-specific threat review covering:
- broken access control;
- privilege escalation;
- signature/authorization replay;
- nonce/domain mistakes;
- reentrancy/external-call risk where applicable;
- accounting/custody/refund errors;
- front-running/MEV where applicable;
- stale/oracle/bridge risk where applicable;
- content-rights abuse;
- moderation abuse;
- spam/Sybil behavior;
- malicious uploads;
- rate/resource exhaustion;
- webhook replay;
- operator compromise;
- secrets/logging/privacy leakage.

**Exit:** unresolved vulnerabilities are closed or explicitly accepted by the appropriate authority with rationale.

## DOOBTUBE-10 — Documentation, deployment and operator closeout

Complete:
- root/app README;
- architecture/component map;
- contract/interface/API/event/state-machine docs;
- roles/permissions;
- Registry identities;
- config/env reference;
- build/test/deploy instructions;
- migrations/upgrades;
- troubleshooting;
- user/developer/operator guides;
- security assumptions/threat model;
- known limitations;
- rollback/recovery;
- monitoring/SLOs;
- release manifest.

**Exit:** a new developer/operator can reproduce build, tests and a non-production deployment from clean inputs.

## DOOBTUBE-11 — Repository Level 3 exact-head closeout

Reconcile against current `main`, remove stale/duplicate/orphaned artifacts and run all owning qualification workflows on the exact final SHA.

Evidence must include:
- exact SHA;
- clean build;
- unit/integration/adversarial tests;
- contract qualification if applicable;
- frontend/backend builds;
- static/security analysis;
- documentation verifier;
- no required uncommitted changes;
- divergence/PR state.

**Exit:** repository implementation may be declared code/build/test/documentation/integration/security complete only for the repository phase.

## DOOBTUBE-12 — Production-equivalent public-testnet qualification

Blocked until a deployable repository-qualified release and approved public testnet exist.

Retain evidence for:
- chain/network identity;
- exact deployed code/services;
- Registry records;
- TLS/health/readiness;
- real dependencies;
- end-to-end upload/playback/streaming/user workflows;
- restart/reorg/recovery;
- abuse/rate/resource controls;
- monitoring/backups/rollback;
- exact repository/deployment lineage.

**Exit:** TESTNET READY = YES on one exact release lineage.

## DOOBTUBE-13 — Genesis / production release

Resolve final Genesis catalog/service disposition and production deployment.

Require:
- exact production endpoints/config;
- Registry publication;
- deployer/admin handoff;
- secrets/key custody;
- SLO/monitoring/incident response;
- backup/recovery;
- independent security review or approved release exception;
- final exact-release reconciliation;
- separate readiness declarations.

**Exit:** only after all earlier required phases are complete may Genesis-ready or production-ready be considered.
