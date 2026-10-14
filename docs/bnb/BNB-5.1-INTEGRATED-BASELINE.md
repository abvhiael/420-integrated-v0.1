# BNB-5.1 — Integrated baseline and runtime ownership

**Disposition: IMPLEMENTED / LEVEL 1 QUALIFICATION PENDING. No completion certificate yet.**

Canonical requirement: Verify Phase 4 integration and certificate provenance. Inventory APIs, migrations, workers, consumers, feature flags and CI. Map each remaining repository task to its existing external acceptance gate.

## Actual integration and certificate provenance

Phase 4 PR #631 was explicitly authorized and merged as `3f2cf64897e96c4f16213bcaf93564db72a174c9` on 2026-10-14; state CLOSED/MERGED. This is the Phase 5 starting main. Its parents are previous main `959288c8bd33b6da0325b6a5d060e00e7bcf0e48` and certificate HEAD `3a7cdf175840e11c337e36d1321490929b5634f3`.

GitHub compare integration merge against certified HEAD reports zero changed files. The [BNB-4.12 certificate](BNB-4.12-PHASE4-LEVEL3-CLOSEOUT.md) qualifies executable `7ccc76fe613ba4fdc162d459827f5ec95fae3385`; its only subsequent pre-integration differences are the three Phase 4 evidence/status documents. That is predecessor evidence, not a substitute for BNB-5.1 tests.

Audit branch `audit/bnb-phase5-bnb-5-1-baseline-20261014` was created directly from integrated main. Keep its new Phase 5 PR draft/open/unmerged until phase closeout and separate integration authorization. Earlier preparation branch `prep/bnb-5-1-integration-baseline-20261014`, commit `af943ae62cf3095e94cec989491608fbdca1016a`, is historical only; its unmerged-Phase-4 blocker is now resolved. It was never Level 1 PASS.

## Pinned source ownership inventory

[Inventory JSON](BNB-5.1-BASELINE-INVENTORY.json) records 59 Git blob identities, all 98 API method/path pairs, 26 ordered migrations, all 17 existing external gates and the complete remaining-step gate map. New tests independently verify Git objects, ancestry and AST routes.

| Surface | Owner and current behavior |
| --- | --- |
| API | `services/420bnb/api.py`: health; guest listing/search/availability/saved stays; host property/unit/calendar/manager/media operations; quotes/holds/bookings/reservations; message delivery/ack; reviews/appeals/casework; signed Travel/Compliance/Pay/reputation callbacks. Complete 98-route list in JSON. |
| Authentication and claims | `identity.py`, `authority.py`, session/recovery/property/manager routes; BnB consumes independent scoped issuer/property authority, never creates it. |
| Availability | `calendar_engine.py`, `availability_projection.py`: bounded synchronous refresh/read/invalidation; durable mutation-to-refresh supervision belongs to BNB-5.4. |
| Discovery | `discovery_sync.py`, `travel_location.py`: signed pull-time Search/Travel snapshots, tombstones and local checkpoints. No continuous approved consumer deployment. Stable cross-property cursor is BNB-5.5: existing safe_feed compares one after value with per-property revisions. |
| Outbox | `outbox.py`: claim/ack/fail/replay/process_batch, bounded leased/fenced processing, retries/dead letters, sanitized payloads. No standalone worker in inspected Compose (BNB-5.2). Event-level delivered marker needs independent per-consumer completion (BNB-5.3). |
| Notifications | API and migration 025: per-device message cursors/ack; no live SMS/email/push provider. Recipient/device delivery extensions belong to BNB-5.8. |
| Economic views | `pricing.py`, `booking_saga.py`, signed internal Pay callbacks, migration 026. Pay/Wallet/Swap retain consent, signing, custody, execution, finality/refund/settlement authority. Continuous reconciliation is BNB-5.10. |
| Casework and operations | `casework_policy.py`, signed reviewer/case APIs, `recovery_operations.py` assessment functions. Assessment approval arguments are not independently established operational authority. Authenticated controls, monitoring and recovery rehearsal belong to BNB-5.9/5.11/5.12. |
| Data | `migrate.py`, immutable migrations 001–026 and checksum ledger, dedicated runtime/migrator roles. No migration/schema change in BNB-5.1. |
| Deployment | `production.py`, deployment template, Dockerfiles, production Compose, Caddyfile and `web_server.py`: api-a/api-b/web/ingress/migrate; no worker; separated runtime/migrator bindings, approved immutable image inputs, TLS requirements. |
| Acceptance adapters | `external_acceptance.py`, `bnb210_external_acceptance.py`, `live_readiness.py`; synthetic manifests/fixtures do not establish external approval. |
| Browser | `web/bnb/index.html`; nonbinding guest/host projections, disabled execution; independent human device/screen-reader acceptance remains external. |

No later Phase 5 step is implemented or renumbered by these findings. Milestones remain BNB-5.7 / BNB-5.13 and phase closeout BNB-5.14.

## Remaining-step external gate map

A mapped gate is traceability, not an assertion that all repository work must await a live testnet. No prerequisite, criterion, gate ID or issuer ownership changes.

| Step | Existing external gate references |
| --- | --- |
| BNB-5.1 | `T-BNB-INTEGRATION-1`, `T-BNB-SECURITY-213` |
| BNB-5.2 | `T-BNB-OPS-214`, `T-BNB-SECURITY-213` |
| BNB-5.3 | `T-BNB-INTEGRATION-1`, `T-BNB-TRAVEL-210A`, `T-BNB-OPS-214` |
| BNB-5.4 | `T-BNB-CALENDAR-1`, `T-BNB-BOOKING-1`, `T-BNB-COMPLIANCE-212`, `T-BNB-TRAVEL-210A` |
| BNB-5.5 | `T-BNB-TRAVEL-210`, `T-BNB-TRAVEL-210A` |
| BNB-5.6 | `T-BNB-TRAVEL-210`, `T-BNB-TRAVEL-210A`, `T-BNB-COMPLIANCE-212`, `T-BNB-IDENTITY-2` |
| BNB-5.7 | `T-BNB-INTEGRATION-1`, `T-BNB-TRAVEL-210A` |
| BNB-5.8 | `T-BNB-IDENTITY-2`, `T-BNB-MEDIA-1`, `T-BNB-SECURITY-213`, `T-BNB-OPS-214` |
| BNB-5.9 | `T-BNB-IDENTITY-2`, `T-BNB-SECURITY-213`, `T-BNB-OPS-214` |
| BNB-5.10 | `T-BNB-QUOTE-1`, `T-BNB-BOOKING-1`, `T-BNB-PAY-2`, `T-BNB-SETTLEMENT-3` |
| BNB-5.11 | `T-BNB-TRAVEL-210A`, `T-BNB-COMPLIANCE-212`, `T-BNB-SECURITY-213`, `T-BNB-OPS-214` |
| BNB-5.12 | `T-BNB-INTEGRATION-1`, `T-BNB-SECURITY-213`, `T-BNB-OPS-214` |
| BNB-5.13 | `T-BNB-INTEGRATION-1`, `T-BNB-ACCESSIBILITY-1`, `T-BNB-SECURITY-213` |
| BNB-5.14 | `T-BNB-INTEGRATION-1`, `T-BNB-SECURITY-213`, `T-BNB-OPS-214` |

All 17 gates remain unchanged in [BNB-TESTNET-WORK-ROADMAP.md](BNB-TESTNET-WORK-ROADMAP.md), including property/media/reputation/calendar/identity gates not repeated in every narrower task row.

## Level 1 implementation and CI ownership

Files changed: [Phase 5 roadmap](BNB-PHASE5-ROADMAP.md), inventory JSON, this report, `services/420bnb/tests/test_bnb51_integrated_baseline.py`, and one checkout option `fetch-depth: 0` in `.github/workflows/bnb-runtime.yml`.

Seven provenance/ownership tests verify:
1. Real merge parents, ancestor relation and tree equality; only evidence differences from qualified executable.
2. Actual certificate and all 59 pinned source blobs.
3. Complete baseline migrations 001–026 and continued immutability of those existing migration files.
4. Complete AST-derived 98-route method/path inventory and uniqueness.
5. All 17 unchanged gate IDs and all 14 mapped steps/milestone references.
6. Disabled current deployment flags, production fail-closed validator and predecessor outbox/worker ownership boundaries.
7. Exact-head CI checkout/assertion with full provenance history.

Full history is needed for Git ancestry/object checks; no application semantics, dependencies, authorization, migration, source protocol, frozen address or external approval changed. Historical baseline verification does not freeze subsequent Phase 5 source development; new migrations may append without rewriting the existing baseline.

BnB Runtime Slice explicitly checks out `github.event.pull_request.head.sha || github.sha` and asserts equality. It retains PostgreSQL16, migration/operations and app/API/security suites, browser/axe, nonroot container, isolated restore and deployment/TLS/static/fail-closed checks. This is the required exact-head Level 1 owner for BNB-5.1.

Nine retained app workflows `bnb-1-1.yml` through `bnb-1-9.yml` were inventoried. Some use default PR merge checkout and GITHUB_SHA: identify those actual SHAs, do not relabel them as implementation-head checks. Required BnB Runtime Slice uses the exact head.

## Exit criteria and current evidence

| Criterion | Disposition |
| --- | --- |
| Phase 4 integrated into main | VERIFIED, merged #631 with exact certified tree |
| Certificate provenance | VERIFIED, pinned executable/certificate source |
| Runtime/API/migration/worker/consumer/flags/CI inventory | IMPLEMENTED; verifier independently checks pinned objects/routes |
| Remaining task/gate map | IMPLEMENTED, all mapped IDs exist and no gate removed |
| New verifier syntax | PASS locally; syntax alone is not app acceptance |
| Exact-SHA BnB Runtime Slice, including new verifier | PENDING / not PASS |
| Durable final BNB-5.1 Level 1 certificate | PENDING terminal success |

Ordinary Level 1 only: Level 2 intentionally deferred to BNB-5.7/5.13; Level 3 to BNB-5.14. No full Solidity/Genesis/Integrated/Geth/global Docs inventory is required or intentionally dispatched for this baseline. Historical Phase 4 results are not presented as new tests.

Keep `travel.bnb_booking=false`, `booking_enabled=false`, `financial_execution=false`. All Identity/property/media/reputation/calendar, legal/Compliance, Pay/Wallet, Search/Travel, independent accessibility, security and production acceptances remain external. Unrelated inherited 420Hz/Governance workflow defects remain as recorded in Phase 4, not successful BNB-5.1 checks.

**Next canonical step after BNB-5.1 Level 1 PASS: BNB-5.2 — Supervised background-worker runtime.**
