# BNB-6.11 — M6-B Level 2 integration boundary

Canonical milestone: **one exact-SHA integrated deployment/recovery lifecycle, monitoring, operator controls, privacy and provider-boundary validation**.

## Scope and retained qualification

- M6-A (BNB-6.6) already qualifies deployment topology, seven providers, schema migration and negative release activation on its recorded implementation SHA.
- BNB-6.7 retains database readiness, redacted metric/event boundaries, stale Search/Travel consumer acknowledgement and operator-only incident response.
- BNB-6.8 retains immutable release manifest, digest pinning, compatibility and blocked rollback/promotion without independent evidence.
- BNB-6.9 retains signed-authority issuer failure, invalid claims, revoked sessions, abuse security boundaries and cross-account replay safeguards.
- BNB-6.10 retains recovery/failure objectives, isolated PostgreSQL dump/restore, ledger integrity and interruption/consumer reconciliation.
- `tests/test_bnb611_m6b.py` exercises cross-step negative release/monitor/provider/restore/privacy scenarios together: even apparently successful fixture assessments cannot authorize production acceptance.

**Qualification owner:** `.github/workflows/bnb-runtime.yml` with its complete BnB test suite and PostgreSQL fixture, plus the nine BNB guardrails that trigger on this PR. Each required successful run must have the same executable head SHA before Level 2 certification. Supplemental Oracle can be recorded independently; skipped Docs must not be counted.

**Boundaries:** neither fixture-based rehearsal nor repo-side provider schema establishes actual independent issuer acceptance, production gateway distributed rate enforcement, real Search/Travel receipt, live PostgreSQL recovery, incident monitoring/on-call signoff, signed release approval or real production failover RTO/RPO. These remain independently controlled in `docs/bnb/BNB-TESTNET-WORK-ROADMAP.md`, with activation blocked. Level 3 is BNB-6.12 after reconciliation with current main and frozen-input preflight. PR #667 stays draft/unmerged.
