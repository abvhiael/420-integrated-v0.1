# HZ-GCA-14 — Notifications, Search, Analytics and Explorer integration

Status: **PARTIAL — repository-local Level 1 PASS, live cross-service integration TESTNET-GATED**.
Canonical roadmap: `docs/420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md`, HZ-GCA-14.
PR: #565; audit branch `feature/420hz-generate-community-awards-roadmap`.
Observed main/base: `ffc6a4028676907c266714b5c1ae8ba3af9a7137`.
Candidate implementation SHA: `f5ece3ceb5791d451cab5faf70bbb2b2f8ea2366`.

Changed implementation files: `hz/generate/src/cross-service.js`, `hz/generate/test/cross-service.test.js`, `hz/generate/src/index.js`, `hz/generate/package.json`, `.github/workflows/420hz-gca-14.yml`; architectural scope `docs/architecture/420hz/HZ-GCA-14-CROSS-SERVICE.md`.

Local projection coverage: qualified source event registry, immutable replay keys/conflict rejection, public/private audience gate, non-authoritative replayable Search/Explorer result references, disclosure/award discovery facets, separately categorized public Analytics counters, localized projection commitments, source checkpoint/readiness and deletion filters; negative fixtures for spoofing, private leaks, replay and stale inputs.

Level 1 targeted run: https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37869728517
Job `113624790538`; completed SUCCESS. Exact-SHA assertion PASS; 94 tests PASS, 0 FAIL, 0 SKIPPED, 0 CANCELLED.
Required evidence: exact SHA check and retained `hz/generate npm run qualify`.

**Explicit unclosed canonical exit:** genuine same-object Notifications/Indexer/Search/Analytics/Explorer integration through actual service connectors; service checkpoint backfill/replay and publication behavior; authentication of per-account notification reads; durable idempotency and tombstone/reorg processing; deployed endpoints and affected client checks. The present local projection fixture cannot substitute for these. Consequently the canonical HZ-GCA-14 step must remain INCOMPLETE until those integration requirements are implemented and tested on an exact SHA. Do not advance its qualification state based solely on local tests.

Testnet carry-forward recorded at `docs/audit/420HZ-TESTNET-DEFERRED-INTEGRATION-ROADMAP.md` under canonical HZ-GCA-18, with explicit service/endpoint, replay, privacy, same-object and live evidence obligations.\n\nLevel 2: pending service-boundary convergence. Level 3: deferred until complete app-phase closeout.
Next canonical roadmap step after completion: **HZ-GCA-15 — Moderation, abuse, privacy and adversarial hardening**.
