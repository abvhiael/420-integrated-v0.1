# 420Hz testnet work roadmap — HZ-GCA-14 deferred service integration

Status: **PLANNED / TESTNET-GATED**. This records the unresolved live-service work from **HZ-GCA-14 — Notifications, Search, Analytics and Explorer integration** without treating repository-local fixtures as deployed integration.

Canonical parent: `docs/420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md`.
Testnet qualification parent: **HZ-GCA-18 — Production-equivalent public testnet qualification**.
Evidence: `docs/audit/HZ-GCA-14-QUALIFICATION.md`.
PR: #565. Qualified local projection implementation SHA: `f5ece3ceb5791d451cab5faf70bbb2b2f8ea2366`; targeted run [37869728517](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37869728517), job `113624790538`, **PASS — 94 passed, 0 failed, 0 skipped/cancelled**.

## Carry forward to testnet (no new top-level HZ-GCA step)

- **Source connectors:** bind the same canonical Generate, Creative publication, Community, nomination, voting, finalized AwardResult and prize-settlement identifiers through real services; preserve owning authority and exact provenance, checkpoint and version references.
- **Notifications:** connect 420Notifications delivery for generation completed/failed, review readiness, release published, follow/community activity, nominations submitted/accepted, voting opened/closing, awards won and prize status. Authenticate account-scoped reads and subscriptions, respect privacy/opt-out and never expose ballot nullifiers, private drafts or proof payloads.
- **Indexer/Search:** bind actual 420Indexer ingestion/checkpoints and 420Search indexed queries for published Recording, creator, AI disclosure, award metadata and result refs; validate visibility filters and correct reindex after publication/withdrawal/deletion.
- **Analytics:** bind actual 420Analytics events and aggregate queries with separate generation, community, and awards buckets; check dedupe, attribution boundaries and aggregation privacy. No derived metric may become ownership, eligibility, vote, or payment authority.
- **Explorer:** bind canonical transactions/commitments for published release, finalized award/result and prize-settlement status; verify references resolve to the same source objects and clearly distinguish canonical receipts from derived projections.
- **Replay/recovery:** durable idempotency, deterministic index rebuild from identical source checkpoint, restart/backfill, duplicate/out-of-order events, reorg/nonfinal input, tombstone/withdrawal, stale source and partial destination outage. No resurrection or duplicate notification/payment authority.
- **Environment/observability:** capture exact chain/genesis identity, application and service deployment SHA, endpoint versions, service authentication, secrets isolation, rate limits, retries, error metrics and incident logs. Reject wrong-network and stale deployments.
- **End-to-end proof:** demonstrate one published release -> public Search/Indexer/Explorer match -> privacy-safe Analytics -> appropriate Notification, and one award nomination -> vote-window notification -> finalized result/badge -> optional prize-status projection. Check same-object IDs and commitments across every service.

## Exit criteria and evidence

Run affected client/service/Indexer/Search/Analytics/Notifications/Explorer tests and live cross-service integration suites against **one identified deployment lineage and implementation SHA**. Preserve API responses, non-secret receipt IDs, checkpoint/result commitments, observed run/job conclusions, negative authorization/privacy fixtures, replay/reorg restoration and service failure logs. Do not mark live integration **PASS** from local unit tests alone.

The HZ-GCA-14 repository-local Level 1 is **PASS**. The complete cross-service integration obligation remains **open** and is carried to HZ-GCA-18/testnet; no production/testnet qualification or merge authorization is implied.

Next canonical implementation step remains **HZ-GCA-15 — Moderation, abuse, privacy and adversarial hardening**; this testnet checklist is a deferred qualification track, not a renumbering of the original roadmap.
