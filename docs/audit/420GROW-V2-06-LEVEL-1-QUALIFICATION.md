# GROW-V2-06 — Level 1 qualification evidence

**Status:** COMPLETE — Level 1 app-scoped qualification. No Level 2 or Level 3 claimed.

- Canonical step: GROW-V2-06 — Sensor telemetry ingestion and historical charts.
- Exact qualified implementation SHA: `0ec71e7af64116d8698bd15212d198511e6295f9`.
- Reconciliation base/main SHA: `ffc6a4028676907c266714b5c1ae8ba3af9a7137` (at inspection); 79 ahead and 0 behind.
- PR #582, branch `audit/420grow-v2-01-product-decision-20261008`, draft/unmerged.
- Components: `grow/telemetry/service.go`, `postgres.go`, `service_test.go`, `qualify.sql`, `chart.mjs`, `chart.test.mjs`, `grow/storage/migrations/0004_telemetry.up.sql`, checksummed migration manifest, workflow and V2-06 architecture documentation.
- Acceptance: tenant-scoped authorized ingestion and historical observations, bounded chart queries, validated kind/unit/ranges/timestamp, duplicate prevention by tenant observation ID, PostgreSQL constraints, composite FK isolation, RLS, JavaScript SVG chart tests, previous app security/facility/plant regressions.
- [420Grow V2 fast run 37868683106](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37868683106): exact qualified SHA; job `113621431632` **SUCCESS**, no failed steps.
- [Retained Grow fast run 37868683071](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37868683071): same exact SHA; job `113621431170` **SUCCESS**, no failed steps.
- One-time source formatting run 37868503593 succeeded; its temporary workflow removed before final candidate.
- Level 2 last passed at V2-05; next cumulative app milestone V2-10, intentionally not rerun here.
- Level 3 deferred to V2-15; canonical Solidity Foundry and Genesis Address Authority require independent ownership, not duplicated full Foundry executions.
- No live sensor adapter, device controls, deployed production database, signed device credential chain, or public customer-facing chart is claimed. V2-07 introduces equipment adapter and safety model, V2-13 integrates app dashboard, and V2-16 is production-equivalent testnet.
- No blockers to app-scoped V2-06 Level 1 at this SHA. Next canonical step: **GROW-V2-07 — Equipment adapters, monitoring and safe controls**.

This record and roadmap update are evidence-only and inherit the tested implementation SHA.
