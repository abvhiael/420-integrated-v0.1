# GROW-V2-08 — Level 1 exact-SHA qualification

**Disposition:** COMPLETE — Level 1, ordinary app-scoped roadmap step. No cumulative Level 2 or Level 3 claimed.

- Canonical step: **GROW-V2-08 — Nutrients, irrigation and environmental history**.
- Exact qualified implementation SHA: `4918101a4dee85b4f8c8e8d287c1320c07ecd6d2`.
- Main/base SHA: `ffc6a4028676907c266714b5c1ae8ba3af9a7137`; branch 114 ahead / 0 behind at qualification.
- PR #582, `audit/420grow-v2-01-product-decision-20261008`, open/draft/unmerged.
- Implementation: `grow/cultivation/service.go`, `postgres.go`, `service_test.go`, `qualify.sql`; PostgreSQL `grow/storage/migrations/0006_cultivation_history.up.sql`; `scripts/grow-v2-migrate.py`; `.github/workflows/420grow-v2-fast.yml`; `docs/audit/420GROW-V2-08-NUTRIENTS-IRRIGATION-HISTORY.md`.
- Requirements: immutable nutrient, irrigation and environmental journal with actor/source, event id/idempotency key, validated kind/metric/canonical unit, finite numeric ranges and bounded timestamps; tenant/facility/zone composite foreign keys and FORCE RLS; transactional tenant-local repository; event replay prevention, correction by new entry rather than history mutation; 1–500 history limit and bounded time window; authenticated active role and scope checks; no equipment activation.
- **[420Grow V2 fast run 37872648633](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37872648633)**, job `113633987634`: **SUCCESS** at exact implementation SHA, no failed steps. Includes Go cultivation unit/race/vet/gofmt, actual PostgreSQL journal migration/replay, RLS and adversarial SQL, plus retained earlier V2-02–07 checks.
- **[Retained 420Grow fast run 37872648630](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37872648630)**, job `113633987622`: **SUCCESS** at same implementation SHA, no failed steps, retaining legacy Grow/Location, build and race/integration regression ownership.
- Defect reconciliation: earlier intermediate fast run failed the Go formatting gate, after successful cultivation Go unit/race results. One-time formatting workflow run `37872481064` succeeded; helper was removed. The final code and owning workflows were subsequently requalified on the above SHA. Earlier migration-manifest failures arose while commits had not yet updated the manifest; no deterministic final-candidate failures remain.
- Security/invariants: rejected unauthorized writes and cross-tenant access, tampering/UPDATE to append-only history, wrong-parent references, bad pH/units, non-finite quantities, future timestamps, replayed idempotency keys and invalid historical windows.
- Milestones: most recent cumulative Level 2 V2-05 qualified; next Level 2 scheduled V2-10. Full Level 3 once at V2-15 (canonical Solidity Foundry ownership separate from Genesis Address Authority, no duplicate full inventory). Production-equivalent testnet V2-16.
- External limits: entries are observational and human-reported, not proof of delivered irrigation, safe automated dosing or certified hardware; authenticated API/session and live UI deferred to later steps. No global repository qualification or live production deployment claimed.
- **Next canonical step:** GROW-V2-09 — Harvest forecasting and production analytics.

This evidence and ensuing roadmap/PR edits are documentation-only and inherit the fully qualified implementation SHA.
