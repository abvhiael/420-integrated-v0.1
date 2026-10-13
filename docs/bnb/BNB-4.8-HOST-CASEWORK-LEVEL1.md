# BNB-4.8 — Independent Host Operations and Dispute Casework — Level 1 certificate

**Disposition: REPOSITORY LEVEL 1 COMPLETE / PASS.** This certificate does not authorize real-world legal decisions, staffed casework, escrow, custody, live financial execution, production provider approval, Phase 4 merge, or Level 3 closeout.

## Canonical scope and exact source

- Canonical roadmap: [BNB-PHASE4-ROADMAP.md](BNB-PHASE4-ROADMAP.md), BNB-4.8 — Independent host operations and dispute casework.
- Exact qualified executable SHA **`2864515f7f700025e200d39ac7681a3addf7abf9`**.
- Repo `abvhiael/420-integrated-v0.1`; branch `audit/bnb-phase4-bnb-4-1-baseline-20261013`; [PR #631](https://github.com/abvhiael/420-integrated-v0.1/pull/631) remains DRAFT, OPEN, UNMERGED.
- Phase 4 original base `81c21541acdc1b900b9a15c6f6b75ff2d7c2b5d9`; observed main `959288c8bd33b6da0325b6a5d060e00e7bcf0e48`; implementation branch 125 ahead, 408 behind main at verification. Reconciliation/merge against main is reserved for BNB-4.12.
- BNB-4.7 M4-A Level 2 was previously certified on exact executable SHA `cd799f314ba68fbb290228dded2035018b190723`; it remains inherited rather than redundantly rerun as a separate global phase.

## Implemented app-side requirements and boundaries

1. **Least-privilege host case projection:** new authenticated `GET /v1/bnb/reservations/{reservation_id}/host-casework` returns bounded case ID, revision, state and noncustodial status only. Active property host or an independently active, unrevoked, unexpired `view_reservations` delegate may read; strangers, guests, expired managers, revoked managers or inactive accounts are denied 404. No original payer, private location, contact, raw report detail, wallet, receipt, invoice or full evidence payload.
2. **Independent reviewer view:** new `GET /v1/bnb/internal/casework/abuse-reports/{report_id}` requires a case-scoped signed `BNB_GUEST_REVIEW` `casework-read` token attesting current unrevoked reviewer grant. Reporter, host, original case reviewer and prior appeal reviewers are excluded. Redacted case summary/appeal status/hold flag only; case read is audited in the existing `bnb_audit` ledger. No content republishing or financial authority.
3. **Review decisions and appeal separation:** retained externally signed moderation/appeal disposition APIs, nonce anti-replay, terminal decisions and durable audit history. Strengthened original decision to reject reporter/host as adjudicator; appeal decisions independently exclude original reviewer, reporter and property host, and preserve `content_republished=false`. Concurrent competing appeal dispositions serialize; at most one terminal signed decision/nonce may commit.
4. **Privacy, retention and legal holds:** `casework_policy.py` validates `BNB_REPORT_RETENTION_DAYS` within 90–3650 and fails closed on malformed or shorter durations, retaining previously qualified 90-day minimum. Existing appeal hold and expiring-detail redaction honor the configured floor and outstanding holds. New signed `POST /v1/bnb/internal/casework/abuse-reports/{report_id}/hold` requires independent current nonrevoked review and independently attested legal/privacy authority; non-shortening upsert protects an existing legal hold, with signed nonce replay guard and audit event. Configuration is not a legal-policy acceptance certificate.
5. **Escrow/payment safety:** casework API and moderation cannot release payouts, refund money, adjudicate 420Pay economic cases or gain Wallet privileges. Existing BNB-4.6 canonical Pay case/settlement boundaries remain unchanged. Live reviewers, legal evidence and source/provider acceptance remain gated.
6. **Production packaging:** corrected the non-root `services/420bnb/Dockerfile` to include `casework_policy.py` and previously omitted `booking_saga.py`; added a packaged-dependency regression. Startup and staging must verify imports without bypassing nonroot readiness.

Changed files: `services/420bnb/api.py`, `services/420bnb/casework_policy.py`, `services/420bnb/Dockerfile`, `services/420bnb/tests/test_bnb48_host_casework.py`, `test_bnb48_retention.py`, `test_bnb48_review_integration.py`. Retained prior migration schema, Pay case signatures, role separation and security gates; no new contract or schema migration.

## Required exact-SHA Level 1 CI evidence

- [420BnB Runtime Slice **38484116804**](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38484116804), job **`115593978169`**, terminal **SUCCESS** on `2864515f7f700025e200d39ac7681a3addf7abf9`.
- Exact log totals: **8 migration/operations passed + 290 runtime/API/security passed = 298 tests passed; zero failed** (warnings not counted as failures). PostgreSQL adjudication races, cross-tenant casework, signed grant revocation, replay, privacy hold controls, payout non-authority, manager expiry, controlled migration, verified TLS, backup/restore, frontend/accessibility smoke, nonroot image and deployment checks ran in the retained BNB workflow.
- **9/9 retained 420BnB workflows SUCCESS at same executable SHA:** 1.1 `38484116606`, 1.2 `38484116691`, 1.3 `38484116626`, 1.4 `38484116652`, 1.5 `38484116743`, 1.6 `38484116583`, 1.7 `38484116598`, 1.8 `38484116893`, 1.9 `38484116690`.
- Earlier **superseded failures** were diagnosed, not counted green: import indentation prevented API import; later a properly enforced current-reviewer-grant claim was omitted from a valid fixture (288 passed and one failed); later 289 application tests passed but nonroot staging failed due omitted `casework_policy.py` Docker COPY. All root causes were corrected and qualified with the terminal exact-SHA PASS. No safety gates were suppressed.
- Global Docs `38484116628` intentionally **SKIPPED**, not PASS for Level 1. 420Oracle `38484116810` was in progress at review, and unrelated Governance `38484111882` and 420Hz `38484110720` workflows failed; none is represented as required BNB Level 1 PASS.

## Deferrals and next roadmap step

All 17 independent requirements in [BNB-TESTNET-WORK-ROADMAP.md](BNB-TESTNET-WORK-ROADMAP.md) remain in force: independent reviewer/operator registration and actual revocation, legal/privacy jurisdiction policy, real Pay/Wallet authority, provider/Identity/Travel/Compliance, device accessibility and operational acceptance are **not** implied by signed CI fixture PASS. Preserve `travel.bnb_booking=false`, `booking_enabled=false`, `financial_execution=false`. No live settlement or escrow authority issued.

**Milestones:** BNB-4.8 app-scoped **Level 1 PASS**. Retained **M4-A Level 2** remains certified; **M4-B Level 2** belongs at BNB-4.11; one comprehensive nonduplicated Solidity/Genesis/Integrated/Docs/affected app **Level 3** belongs at BNB-4.12 before merge approval. PR #631 stays draft and unmerged.

**Next canonical step: BNB-4.9 — Accessibility and resilient guest/host experiences.**

This document is an evidence-only commit and does not change the exact qualified executable implementation SHA.
