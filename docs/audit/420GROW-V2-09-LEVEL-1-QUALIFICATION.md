# GROW-V2-09 — Level 1 exact-SHA qualification

**Disposition: COMPLETE — Level 1.** App-scoped step qualification only; no cumulative Level 2, global Level 3, merge, live deployment, or statutory certification claimed.

- **Canonical step:** GROW-V2-09 — Harvest forecasting and production analytics.
- **Exact qualified implementation SHA:** `802e5f5b34fe4ab7d086cf0bae47ed522a811ec8`.
- **Main/base SHA:** `ffc6a4028676907c266714b5c1ae8ba3af9a7137`; at closeout branch 160 commits ahead and 0 behind.
- **PR:** #582; branch `audit/420grow-v2-01-product-decision-20261008`; draft/unmerged.
- **V2 fast:** [run 37878130176](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37878130176), job `113651306866`, **SUCCESS** on exact implementation SHA, no failing step. Includes retained GROW-V2-01–08 tests, PostgreSQL 16 migration/replay/RLS, Go harvest unit/race, vet, formatting, and harvest SQL adversarial qualification.
- **Retained original Grow fast:** [run 37878130127](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37878130127), job `113651306665`, **SUCCESS** on the same implementation SHA, no failing step. Original Grow directory/service/web/consumer/SDK/static/clean-build/race qualifications preserved.
- **Changed implementation/test/CI files:** `grow/harvest/service.go`, `postgres.go`, `planning_postgres.go`, `report.go`, `service_test.go`, `report_test.go`, `qualify.sql`, `grow/storage/migrations/0007_harvest_analytics.up.sql`, `0008_harvest_plans.up.sql`, `scripts/grow-v2-migrate.py`, `.github/workflows/420grow-v2-fast.yml`.
- **Observed harvest:** tenant-scoped, actor/source/time/idempotency-attributed recorded *dry grams*; only `HARVESTED` plants and correct facility/zone accepted; immutable journal, forced tenant RLS, plant+zone constraints, one recorded harvest per plant. Forecasts do not create observed records.
- **Calendar:** operator-supplied start/end window linked to an existing active plant; validation of duration/time horizon and scope; PostgreSQL upsert with append-only plan revision journal, tenant RLS, immutable revision events.
- **Analytics:** UTC monthly totals/counts in grams, per-plant and cultivar breakdowns, report-bound facility and zone, deterministic UTC/ID order, provenance-bearing CSV with formula-prefix neutralization, stable metric denominators and observed-only trust marker.
- **Forecast quality:** historical per-record mean and heuristic 1.96 standard-error interval, available only with >=3 observed samples and nonextreme variance. `INSUFFICIENT_DATA` and `HIGH_VARIANCE` prevent an available forecast and do not manufacture an observed result. Historical heuristic is not agronomic, cultivar-adjusted, or a guaranteed future outcome.
- **Partial history:** service reads limit+1 and explicitly errors on truncated time windows. Request limits 1–500, window max 366 days; no silent incomplete aggregation. Callers may narrow windows to request comprehensive subsets.
- **Negative/security evidence:** cross-tenant denied at service and PostgreSQL, role/unauthenticated write denial, malformed/nonfinite quantities, invalid windows, replay/double counting, append-only enforcement, wrong-scope records, invalid plan intervals, immutable plan revisions and formula-injection output regression.
- **CI defect chronology:** intermediate candidate failed due to malformed Go test escape, then gofmt, then malformed PL/pgSQL quoting in a migration and a verification block. Each identified cause was repaired without weakening tests. Final above SHA has both required fast jobs **SUCCESS**.
- **Milestone:** last app Level 2 GROW-V2-05; next accumulated integration Level 2 GROW-V2-10 (V2-06–10).
- **Deferred:** full canonical Solidity/Genesis (no duplicated Foundry), 420 Integrated global, Docs/global and full phase Level 3 at GROW-V2-15; production-equivalent testnet deployment/acceptance at GROW-V2-16.
- **External limits:** no sensor-calibrated empirical validation, yield guarantees, certification of regulatory exports, live/private user data or equipment actuation. Human-entered planned dates remain observations of operator intent, not predictive harvest dates.
- **Next canonical step:** **GROW-V2-10 — Inventory, traceability and compliance exports**.

This and the corresponding roadmap/PR updates are **evidence-only** and inherit the exact qualified implementation SHA above. No source/tests/workflows/dependencies/config/runtime artifacts/requirements are changed by the closeout.
