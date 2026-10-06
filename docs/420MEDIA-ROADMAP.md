# 420Media — audit/remediation roadmap

This roadmap is the stable dependency-ordered remediation plan established by the 2026-10-06 repository audit. Do not renumber requirements. Repository truth and later merged canonical architecture decisions override prose assumptions.

## MEDIA-AUDIT-1 — Canonical definition and audit baseline
Freeze the authoritative definition, current-main inventory, historical PR boundary, requirement matrix and readiness classification. Add a dedicated verifier and exact-head Media audit CI.

**Exit:** audit baseline and verifier are committed; CI checks Phase 1 contracts, Media Go packages and Anvil integration on the exact PR head.

## MEDIA-AUDIT-2 — Contract hardening and deployment graph
Reconcile every Phase 1 contract/interface with current SystemAccess/Registry/Pay/Compute architecture. Add missing adversarial, invariant/fuzz/property tests; validate hostile adapters and failure atomicity; define the canonical deployment order and dependency graph without inventing fixed addresses.

## MEDIA-AUDIT-3 — Operator discovery and service control plane
Supersede or reconcile open PR #86 against current main. Implement canonical operator discovery with event-index acceleration plus authoritative revalidation, deterministic selection, recovery/reorg handling and a stable service control-plane boundary.

## MEDIA-AUDIT-4 — 420Storage video upload and media-asset lifecycle
Implement the Genesis `video_uploads` target: upload preparation, canonical Storage object identity, integrity/provenance references, derivative linkage, lifecycle/delete/privacy semantics and failure recovery. Raw bytes remain off-chain.

## MEDIA-AUDIT-5 — Basic livestreaming service
Turn the existing gateway primitives into the Genesis-enabled `media.livestreaming` service: create/start/stop/status flows, controller authorization, bounded credential resolution, reconnect/failure semantics, persistent session recovery and feature-flag enforcement.

This is a major application milestone and should receive Level 2 cross-component qualification.

**Status: COMPLETE (Level 2).** Exact implementation SHA `6833ed362214f453bfe0fb224424e7f09c7eb1f9`; qualification run `37503557911`. Durable evidence: `docs/audit/420MEDIA-AUDIT-5-QUALIFICATION.md`.

## MEDIA-AUDIT-6 — Identity, Rights and ownership/provenance integration
Bind creator/controller actions to scoped 420Identity/Wallet authorization and authoritative 420Rights/provenance checks where rights-bearing publication or reuse requires them. Preserve pseudonymous/optional Identity semantics and avoid making Media an identity or rights authority.

**Status: COMPLETE (Level 1).** Exact implementation SHA `70376d2b1d41659d7d654e41faa5e9d3c992fd66`; qualification run `37507801987`. Durable evidence: `docs/audit/420MEDIA-AUDIT-6-QUALIFICATION.md`.

## MEDIA-AUDIT-7 — Pay and Compute integration
Replace opaque/legacy compatibility assumptions with explicit canonical Pay settlement and Compute Market coordination boundaries where applicable. Preserve non-custodial accounting, canonical beneficiary binding, idempotency and refund/failure behavior.

**Status: COMPLETE (Level 1).** Exact implementation SHA `a0aeb709b10a155fe7959781a9994a15368a9b4a`; qualification run `37511396911`. Durable evidence: `docs/audit/420MEDIA-AUDIT-7-QUALIFICATION.md`.

## MEDIA-AUDIT-8 — Search, Notifications and indexing projections
Implement public-only Media discovery/projection into 420Search and opt-in provenance-preserving 420Notifications. Add finality/reorg/rebuild/privacy-negative tests. Search and Notifications remain non-authoritative projections/delivery layers.

**Status: COMPLETE (Level 1).** Exact implementation SHA `acbb99e2485c9565598eb723ee1f97492478a52d`; qualification run `37515368608`. Durable evidence: `docs/audit/420MEDIA-AUDIT-8-QUALIFICATION.md`.

## MEDIA-AUDIT-9 — Stable /v1 API and typed SDK
Implement the GEN-SVC API contract: versioned routes, cursor pagination, RFC3339 UTC timestamps, stable IDs/errors, idempotency, provenance, compatibility/capability discovery, Wallet signing handoff and a typed Media client/SDK.

## MEDIA-AUDIT-10 — User-facing 420Media application
Implement the Media frontend for upload/library/playback/livestream workflows with Wallet/network validation, loading/empty/error/transaction states, safe recovery, accessibility basics, responsive behavior and feature availability. Do not claim a domain until deployment exists.

## MEDIA-AUDIT-11 — Security, abuse, moderation and repository closeout
Apply the shared GEN-SVC threat model specifically to Media: content/rights abuse, stream-key leakage, SSRF/endpoint abuse, parser/codec/process isolation, resource exhaustion, webhook/replay concerns, moderation/report boundaries, malicious media and operator compromise. Complete docs, deployment configuration, operator/user/developer guides and Level 3 exact-head repository qualification.

## MEDIA-AUDIT-12 — Production-equivalent public-testnet qualification
Deploy one exact release lineage with real required dependencies. Retain chain/network/genesis identity, exact SHA, contract/service addresses or Registry records, runtime hashes where applicable, live upload and livestream journeys, Pay/Compute/Storage/Identity/Rights/Search/Notifications evidence, reorg/restart/recovery, abuse/rate-limit/secret handling, monitoring and rollback evidence.

Repository-local simulation is not live-testnet completion evidence.

## MEDIA-AUDIT-13 — Genesis / production release
Resolve whether 420Media requires explicit promotion into the frozen Genesis application catalog. Bind final production endpoints/configuration, Registry publication, admin/deployer handoff, secrets, monitoring/SLOs, backups/recovery, incident response, final security review and exact-release evidence.

Final closeout must report CODE, BUILD, CONTRACT, TEST, DOCUMENTATION, INTEGRATION, SECURITY, TESTNET, GENESIS and PRODUCTION readiness separately.