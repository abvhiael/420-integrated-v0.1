# 420BnB — Phase 6 canonical working roadmap

Status: Phase 6 proposed sequence accepted for execution by the owner's BNB-6.1 request on 2026-10-15. This file records the step sequence without claiming any Phase 6 acceptance has passed. Repository truth and independent authority remain controlling.

## Starting prerequisite

Phase 5 repository qualification was recorded in [BNB-5.14-PHASE5-LEVEL3-CLOSEOUT.md](BNB-5.14-PHASE5-LEVEL3-CLOSEOUT.md), with original exact-SHA global evidence preserved. PRs #644 and #665 merged; initial Phase 6 baseline main `19166dfbdafd1f51a9cd9bbd2a22abfe95b8d451`. Genuine external acceptance remains in [BNB-TESTNET-WORK-ROADMAP.md](BNB-TESTNET-WORK-ROADMAP.md).

## Phase 6 — Operational readiness, release engineering, and external integration preparation

| Step | Name | Original requirements / exit criteria |
| --- | --- | --- |
| BNB-6.1 | Phase 5 inheritance and release baseline | Verify Phase 5 merge provenance, certificates, current main, deployment artifacts, outstanding limitations and testnet dependencies. Inventory remaining repository-side gaps without reopening qualified work. |
| BNB-6.2 | Release configuration and environment contracts | Versioned environment schemas; mandatory config validation, secret references, service identity, feature-flag enforcement and fail-closed startup; verify negative inputs. |
| BNB-6.3 | Production-equivalent deployment manifests | Reproducible API, worker, PostgreSQL, ingress and consumer deployment definitions; TLS, isolation, limits, health checks, nonroot execution and artifact provenance. |
| BNB-6.4 | Database lifecycle and migration safety | Forward-only migrations, rolling deployment compatibility, restore/replay, migration locking, retention and interrupted-upgrade recovery. |
| BNB-6.5 | External provider adapter readiness | Deployable fail-closed contracts and config for Identity, Pay/Wallet, Compliance, Search, Travel, Location and Notifications; independently controlled live approval remains deferred. |
| BNB-6.6 | M6-A Level 2 integration milestone | One exact-SHA accumulated deployment, config, migration and provider-boundary integration with failure/restart/recovery/security regressions. |
| BNB-6.7 | Operational observability and incident response | Bounded redacted logs/metrics/tracing/alerts, health and incident procedures; test misleading health and data leakage. |
| BNB-6.8 | Release promotion and rollback controls | Immutable image digests, release manifests, compatibility, approvals, promotion, rollback and DB recovery procedures. |
| BNB-6.9 | Security and abuse readiness | Revocation, least privilege, issuer outage/compromise, replay, rate limits, cross-account/privacy, abuse and dependency exhaustion. |
| BNB-6.10 | Recovery and disaster-readiness rehearsal | Isolated multi-instance failure, backup/restore, interrupted rollout, consumer recovery, rollback and measured objectives. |
| BNB-6.11 | M6-B Level 2 integration milestone | One exact-SHA integrated deployment/recovery lifecycle, monitoring, operator controls, privacy and provider-boundary validation. |
| BNB-6.12 | Final Level 3 phase closeout | Reconcile main once; freeze executable SHA and manifests; preserve reusable global evidence when policy allows; qualify missing canonical global, Docs, app/security/deployment suites; certificate and authorized merge. |

## Qualification and authority

Level 1 for BNB-6.1–6.5 and 6.7–6.10: affected app-specific checks only. Level 2 at BNB-6.6 and BNB-6.11. Level 3 once at BNB-6.12, after frozen-input preflight; Solidity owns complete Foundry, independent Genesis only authority, Integrated runtime, full Docs and retained BnB. Do not redundantly rerun qualified unchanged global inputs. Original workflow SHA and evidence SHA must never be conflated.

**Release gates:** `booking_enabled=false`, `travel.bnb_booking=false`, `financial_execution=false`. No live booking/payment/property publication, synthetic provider approval or unauthorized production release. All external acceptance gates remain wholly in the canonical testnet work roadmap.

Initial current step BNB-6.1; successor BNB-6.2 only upon an exact-SHA Level 1 PASS certificate. Any future roadmap amendment must be explicit, approved and documented; no silent renumbering.
