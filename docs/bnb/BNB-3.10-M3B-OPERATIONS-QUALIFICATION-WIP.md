> **Supersession notice (M3-B technical evidence):** This is a retained historical WIP snapshot. Later repo-side appeals, moderation separation, report-detail retention, crash-fault tests and the bounded app Level 2 qualification are recorded in [BNB-M3B-LEVEL2-QUALIFICATION.md](BNB-M3B-LEVEL2-QUALIFICATION.md), implementation SHA `0730e78eaac10dc18ca29e46eb6706cd75465cb6`. External/operator/legal/manual-testnet gates remain open; historical unresolved statements below describe their earlier snapshots, not the latest implementation state.

# BNB-3.10 — Operational resilience / M3-B Level 2 qualification work

**Status: PARTIAL / NOT CERTIFIED.** Canonical source: `docs/bnb/BNB-PHASE3-ROADMAP.md`, BNB-3.10 and M3-B.

## Candidate and scope

Implementation SHA: `3c973dff8c604ee4b88a1b1613fb21730f1852c5`.
Audit branch `audit/bnb-phase3-infrastructure-20261012`, PR #620 (draft/unmerged). Observed PR base SHA `fa3ebf8bf70df341a91ad2efa701827ca2bea7e7`; independent current-main reconciliation remains scheduled for BNB-3.12.

Changed:
- `services/420bnb/api.py`: catch `psycopg.Error` from readiness DB connect/query and respond `503 DATABASE_UNAVAILABLE` without leaking credential-bearing failure details. Existing `SCHEMA_NOT_MIGRATED`/`SCHEMA_VERSION_MISMATCH` remain unchanged.
- `services/420bnb/tests/test_bnb214_operations.py`: regression for a DB connection failure carrying a secret DSN, requiring HTTP 503, bounded body and no credential disclosure.

Existing retained controls observed: serialized transactional checksum-guarded migration ledger, untracked-schema guard, readiness schema version, production least-privilege/TLS/issuer manifest checks, API logs with redacted path templates, service-container PostgreSQL tests, backup/restore smoke in the BNB runtime workflow. These are app-scoped fixtures, **not** official-testnet operational acceptance.

## Exact-SHA Level 1 qualification

- BNB Runtime Slice `38339719896` on implementation candidate **queued at authoring** (not PASS).
- Nine retained BNB workflows were queued at authoring (not PASS). Global Docs was skipped by ordinary-step policy (not PASS).
- No unnecessary repository-wide Foundry/Genesis/Integrated workflow dispatched.
- After CI completion, review exact test failure/steps and security, browser, migration, backup, image/staging and fail-closed behavior.

## BNB-3.10 and M3-B milestone reconciliation still required

- App-scoped reproducible crash/retry, outbox publication/reconciliation, duplicate replay, multi-instance idempotency and worker/process restart; verify durable outbox and no dropped/double economic or booking state changes.
- Rate/resource/connection controls, dependency outages (Pay, Identity, Travel, Compliance, location, reputation/media), fail-closed auth, redacted telemetry, recovery alerting and safe post-outage resumption.
- Backup/restore, migration rollback/expand safety and disaster recovery procedures with repeatable repository fault simulation. Existing CI fixture must not be presented as evidence of actual encrypted off-host backups.
- M3-B is **mandatory Level 2 after BNB-3.10**: complete guest/host/trust/operations retained app regressions with adversarial integration on *one exact implementation SHA*. BNB-3.7 guest evidence remains informal and BNB-3.9 appeals/retention/redaction gaps remain open in `docs/bnb/BNB-3.9-TRUST-SAFETY-LEVEL1-WIP.md`, so accumulated M3-B cannot be certified merely from 9/9 legacy workflows.
- Independent official-testnet operations, measured RTO/RPO, encrypted off-host backup, actual two-instance failover, operator on-call drills and security review are **blocked/deferred** to `T-BNB-OPS-214` and `T-BNB-SECURITY-213`.

**Do not activate booking or financial execution, merge PR #620, or advance to BNB-3.11 on this evidence alone.** After completed BNB-3.10/M3-B repository qualifications, next canonical roadmap step is **BNB-3.11 — End-to-end integration**; full Level 3 app closeout remains BNB-3.12.
