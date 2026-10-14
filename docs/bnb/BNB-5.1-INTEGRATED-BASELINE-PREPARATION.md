# BNB-5.1 — Integrated baseline and runtime ownership: preparation and blocker record

**Disposition: PARTIAL / BLOCKED — NOT COMPLETE, NOT LEVEL 1 PASS.**
Step requested: “Verify Phase 4 integration and certificate provenance. Inventory APIs, migrations, workers, consumers, feature flags and CI. Map each remaining repository task to its existing external acceptance gate.”

## Repository state and authoritative dependency

- Main at review: `959288c8bd33b6da0325b6a5d060e00e7bcf0e48`.
- Phase 4 audit branch: `audit/bnb-phase4-bnb-4-1-baseline-20261013`; [PR #631](https://github.com/abvhiael/420-integrated-v0.1/pull/631), DRAFT / OPEN / UNMERGED, mergeable at inspection.
- Source/certificate HEAD inspected: `3a7cdf175840e11c337e36d1321490929b5634f3`. [BNB-4.12 certificate](BNB-4.12-PHASE4-LEVEL3-CLOSEOUT.md) records qualified executable SHA `7ccc76fe613ba4fdc162d459827f5ec95fae3385`. The certificate is repository qualification, not proof that Phase 4 reached main.
- Preparation branch: `prep/bnb-5-1-integration-baseline-20261014`, based on the exact Phase 4 certificate HEAD; no Phase 4 PR mutation/merge. This preparation branch is not represented as a main-based integrated Phase 5 baseline. No Phase 5 PR or implementation SHA has been qualified.
- [Phase 5 roadmap](BNB-PHASE5-ROADMAP.md) preserves the previously proposed 14-step order and the owner's requested BNB-5.1 definition. Its explicit starting prerequisite is Phase 4 integration through authorized PR #631 merge.
- Main divergence remains the Phase 4 change set; no new main reconciliation or merge is performed by these planning documents. Integration evidence, final baseline hash and post-integration conflicts/source equivalence must be assessed after authorized integration.

## Pinned ownership inventory

Machine-readable exact source identities and complete method/path list: [BNB-5.1-BASELINE-INVENTORY.json](BNB-5.1-BASELINE-INVENTORY.json). It contains 98 unique API method/path pairs extracted from source decorators, 26 ordered migration file identities, and 59 source/migration/workflow/document Git blob references. Source extraction is not a newly executed HTTP acceptance suite.

| Surface | Actual owner and current limitation |
| --- | --- |
| API routes | `services/420bnb/api.py`: health; guest listing/search/availability/saved stays; host property/unit/calendar/manager/media/review operations; booking/quote/hold/reservation; messages/delivery/ack; abuse/appeal/casework; signed Travel/Compliance/Pay/reputation callbacks. Full 98-route list is in the inventory. |
| Accounts and external authority | `identity.py`, `authority.py`, `travel_location.py`; BnB verifies scoped external sources and records/rejects their observations, not issuer/legal/fund authority. |
| Availability | `calendar_engine.py`, `availability_projection.py`; bounded synchronous refresh/read/invalidation. Continuous mutation-to-refresh supervision belongs to BNB-5.4. |
| Discovery consumers | `discovery_sync.py`: Search/Travel local monotone checkpoints, signed property-scoped pull route and tombstones. Current `safe_feed` compares a shared after value to per-property revisions; BNB-5.5 must establish a stable cross-property cursor, without calling this preparation a fix. No independent external Search/Travel deployment is certified. |
| Outbox | `outbox.py`: bounded claim/fail/ack/replay/process_batch, lease fencing, retries/dead letters and sanitized events. One event-level delivered marker currently completes delivery; independent per-consumer delivery belongs to BNB-5.3. No supervised standalone worker service exists in inspected Compose; BNB-5.2 owns that runtime. |
| Notifications | API and migration 025 retain device cursors and acknowledgments; no real SMS/email/push transport activated. BNB-5.8 owns recipient/device delivery extensions. |
| Economic projections | `pricing.py`, `booking_saga.py`, signed internal Pay routes and migration 026; Pay/Wallet keep execution/consent/finality ownership. Continuous reconciliation belongs to BNB-5.10. |
| Casework/operations | `casework_policy.py`, API casework routes, `recovery_operations.py` assessment functions. Assessment approval input does not establish independent operational authority; authenticated controls belong to BNB-5.9, continuous monitoring to 5.11. |
| Data/migrations | `migrate.py`, immutable ledger 001–026; checksummed migration identities, dedicated runtime/migrator roles. No new migration or schema change here. Live PostgreSQL execution of this preparation was not performed. |
| Acceptance adapters | `external_acceptance.py`, `bnb210_external_acceptance.py`, `live_readiness.py`; manifests/fixtures cannot substitute for real independent acceptance. |
| Deployment | `production.py`, `deployment.template.json`, Dockerfiles, `compose.production.yml`, Caddyfile and `web_server.py`; Compose has api-a/api-b/web/ingress/migrate, no worker. Runtime/migrator bindings separated; immutable approved image inputs and TLS required. |
| Frontend | `web/bnb/index.html`; guest/host status projections and disabled payment/publication posture. Human screen-reader/device acceptance remains separate from CI. |

## CI and qualification ownership

- BNB Runtime Slice `.github/workflows/bnb-runtime.yml`: PR paths `services/420bnb/**`, `web/bnb/**`, own workflow, plus workflow_dispatch. It explicitly checks out `github.event.pull_request.head.sha || github.sha` and verifies exact SHA. PostgreSQL16, 26-migration integrity, app/API/security suites, browser/axe, nonroot image, isolated restore, TLS/topology/static/fail-closed deployment acceptance are its retained scope.
- Nine retained app workflows `bnb-1-1.yml` through `bnb-1-9.yml` were read and inventoried. Some retained jobs (for example BNB-1.1) use the default PR checkout and assert GITHUB_SHA, so a PR merge-ref check must not be silently relabeled as an implementation-head check. Post-integration BNB-5.1 qualification must identify actual checkout SHAs and use the exact-head app owner for required implementation qualification.
- BNB-5.1 is ordinary Level 1, not a Level 2/3 milestone. Level 2 belongs at BNB-5.7 and BNB-5.13; full Level 3 at BNB-5.14. Do not trigger Solidity/Genesis/Integrated/Geth/global Docs merely for this preparation.
- Phase 4's 309 runtime test executions, retained app checks and final Level 3 runs are historical predecessor evidence. They are not BNB-5.1 CI results. No new test run or job ID is invented.

## Remaining repository work to existing external gates

This mapping preserves gate identities/criteria and distinguishes implementation work from external acceptance. A gate mapping never asserts that the mapped work itself requires a live network.

| Step | Existing gate references |
| --- | --- |
| BNB-5.1 — Integrated baseline and runtime ownership | `T-BNB-INTEGRATION-1`, `T-BNB-SECURITY-213` |
| BNB-5.2 — Supervised background-worker runtime | `T-BNB-OPS-214`, `T-BNB-SECURITY-213` |
| BNB-5.3 — Independent consumer delivery state | `T-BNB-INTEGRATION-1`, `T-BNB-TRAVEL-210A`, `T-BNB-OPS-214` |
| BNB-5.4 — Transactional projection invalidation and refresh | `T-BNB-CALENDAR-1`, `T-BNB-BOOKING-1`, `T-BNB-COMPLIANCE-212`, `T-BNB-TRAVEL-210A` |
| BNB-5.5 — Correct incremental discovery feeds | `T-BNB-TRAVEL-210`, `T-BNB-TRAVEL-210A` |
| BNB-5.6 — Search/Travel consumer transport contracts | `T-BNB-TRAVEL-210`, `T-BNB-TRAVEL-210A`, `T-BNB-COMPLIANCE-212`, `T-BNB-IDENTITY-2` |
| BNB-5.7 — M5-A Level 2 integration milestone | `T-BNB-INTEGRATION-1`, `T-BNB-TRAVEL-210A` |
| BNB-5.8 — Notification delivery and device lifecycle | `T-BNB-IDENTITY-2`, `T-BNB-MEDIA-1`, `T-BNB-SECURITY-213`, `T-BNB-OPS-214` |
| BNB-5.9 — Authenticated operational controls | `T-BNB-IDENTITY-2`, `T-BNB-SECURITY-213`, `T-BNB-OPS-214` |
| BNB-5.10 — Continuous Pay/Wallet reconciliation | `T-BNB-QUOTE-1`, `T-BNB-BOOKING-1`, `T-BNB-PAY-2`, `T-BNB-SETTLEMENT-3` |
| BNB-5.11 — Service health and synchronization monitoring | `T-BNB-TRAVEL-210A`, `T-BNB-COMPLIANCE-212`, `T-BNB-SECURITY-213`, `T-BNB-OPS-214` |
| BNB-5.12 — Multi-instance recovery and deployment rehearsal | `T-BNB-INTEGRATION-1`, `T-BNB-SECURITY-213`, `T-BNB-OPS-214` |
| BNB-5.13 — M5-B end-to-end Level 2 milestone | `T-BNB-INTEGRATION-1`, `T-BNB-ACCESSIBILITY-1`, `T-BNB-SECURITY-213` |
| BNB-5.14 — Final Level 3 phase closeout | `T-BNB-INTEGRATION-1`, `T-BNB-SECURITY-213`, `T-BNB-OPS-214` |

All 17 canonical gate headings remain in [BNB-TESTNET-WORK-ROADMAP.md](BNB-TESTNET-WORK-ROADMAP.md). The narrower per-step map does not remove property/media/reputation/calendar/identity or any other existing prerequisite from eventual release.

## Checks performed and exit criteria

| Criterion | Result |
| --- | --- |
| Phase 4 certificate/source provenance | VERIFIED at pinned certificate HEAD; original successful qualification retained. |
| Phase 4 integrated into current main | **BLOCKED**: PR #631 remains unmerged. No integration merge SHA exists to verify. |
| APIs/migrations/runtime/worker/consumer/flags/CI inventory | PREPARED at exact Phase 4 source HEAD; must refresh after integration. |
| Remaining-step external gate map | PREPARED: all 14 step keys mapped, every mapped identifier exists among 17 canonical headings. |
| Inventory integrity checks | PASS: 98 unique method/path pairs, migrations numbered 001–026 without gaps, 59 successfully fetched Git blob references. These are document/source consistency checks, not app CI. |
| Disabled operating posture | VERIFIED: deployment template booking_enabled=false and financial_execution=false; production validator requires both false. Preserve travel.bnb_booking=false and all source-authority publication guards. |
| Exact integrated baseline Level 1 qualification | **NOT RUN / NOT PASS**: no integrated baseline yet. No failed run was blindly rerun. |
| Final BNB-5.1 certificate | NOT ISSUED. |

## Unblocking and next action

Explicit owner authorization is still required to merge the certified Phase 4 PR #631; the earlier keep-draft/open/unmerged restriction is preserved. This is a repository integration dependency, not a live-testnet deferral and not an automatic failure of the app code. Prior Phase 4 certification also records inherited unrelated 420Hz/Governance workflow YAML failures; they remain unresolved, not green and not waived here.

After authorized integration, verify actual main/merge SHA, diff against the qualified Phase 4 implementation, resolve any substantive drift, create the Phase 5 audit branch from the integrated main, refresh this inventory and run directly applicable exact-head Level 1 acceptance. Record implementation/evidence SHAs and actual job outcomes, then individually close the BNB-5.1 criteria. Do not begin BNB-5.2 or claim BNB-5.1 complete before this.

No runtime code/tests/workflows/dependencies/deployment/frozen-address maps or external gate criteria were changed by this preparation. No actual testnet/provider/production acceptance is claimed.
