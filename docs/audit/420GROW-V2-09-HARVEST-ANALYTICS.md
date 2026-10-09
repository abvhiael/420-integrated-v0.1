# GROW-V2-09 — Harvest forecasting and production analytics

**Status: COMPLETE — Level 1**, exact implementation SHA `802e5f5b34fe4ab7d086cf0bae47ed522a811ec8`. See [durable exact-SHA qualification](420GROW-V2-09-LEVEL-1-QUALIFICATION.md). PR #582 remains an accumulated draft audit PR, not a release.

## Harvest observations, lifecycle and calendar

- Private `harvest_records` are insert-only production observations. The unit is recorded **dry grams** (`weight_grams`); source/actor, harvest time and idempotency are mandatory. Only a plant in `HARVESTED` state and belonging to the same tenant/facility/zone may be recorded. One harvest record per plant; corrections or multi-stage harvest workflows require a later separately governed model rather than altering history.
- `harvest_plans` represent **operator-entered intentions**, never observed harvests or machine-generated agronomic date predictions. Plans require an authenticated plant-write grant, active linked plant, valid UTC timestamps, an ordered positive window no longer than 180 days, and bounded past/future horizons. Windows participate in the private scoped calendar. Plan changes are journaled in immutable `harvest_plan_events` with old/new dates, actor, source and time.
- Both the observation and planning tables enforce composite parent ownership, FORCE PostgreSQL tenant row-level security and fail-closed application scopes. No private facility or plant projection is added to public 420Location.

## Metric contract

- **Observed count** = number of validated harvest records returned for the authorized tenant, facility, zone and half-open interval `[from,to)`. Each plant can contribute at most once due to database uniqueness.
- **Observed total grams** = sum of recorded dry grams across those records. **Observed average grams per record** = total grams divided by observed count; zero records yields count zero with no inferred production. No area, plant-capacity, wet/dry conversion, inventory stock, revenue or legal weight claim is implied.
- **Monthly production** = observed record count and grams grouped by each record's **UTC `YYYY-MM`** month. **ByPlant / ByCultivar** aggregate the same observed values by stable plant ID and currently associated cultivar ID (unknown becomes `UNSPECIFIED`). The returned report identifies its facility and zone explicitly; multiple zones are not silently combined outside the caller's authorization.
- CSV export contains `OBSERVED` record type, harvest/plant/facility/zone IDs, UTC timestamp, dry weight in grams, source, actor and cultivar ID. Rows are sorted by UTC time then harvest ID; CSV fields that could be spreadsheet formulas are neutralized. This is a reproducible internal analytics export, **not** the jurisdiction-specific compliance export of V2-10.
- Time windows must be nonempty and <=366 days; record bounds are 1–500. Services query one extra row and **reject** truncated aggregates instead of representing partial totals as complete. Callers must request narrower windows when volume exceeds bounds.

## Forecast and uncertainty contract

- **Forecast type:** `ESTIMATE`, separate from `OBSERVED`. It is the mean recorded grams per harvest entry, not predicted total inventory, harvest date, unit price, yield by area, or likely yield for a specific cultivar.
- **Method:** for at least three historical records, sample standard deviation and `1.96 × (sample standard deviation / sqrt(n))` create a heuristic uncertainty range for the historical mean, floored at zero on the lower bound. It is **not** a validated 95% predictive interval for an individual plant.
- **Availability:** `INSUFFICIENT_DATA` if fewer than three observations; `HIGH_VARIANCE` if sample standard deviation exceeds the mean; otherwise `AVAILABLE`. Only the last state sets `Available=true` and returns a numeric estimate/range. Outlier-sensitive or sparse histories never silently produce a usable forecast.
- Sources may be biased or manually recorded and are not calibrated sensor evidence. Forecasts require human interpretation and cannot authorize automated irrigation/HVAC/nutrient/electrical control.

## Scope and qualification boundaries

Code: `grow/harvest/{service,postgres,planning_postgres,report,service_test,report_test}.go`, `grow/harvest/qualify.sql`, migrations `0007_harvest_analytics.up.sql` and `0008_harvest_plans.up.sql`, ordered checksum migrator and the existing app-specific CI workflow.

**Level 1 PASS:** V2 [run 37878130176](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37878130176) / job `113651306866`; retained Grow [run 37878130127](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37878130127) / job `113651306665`, both on exact implementation SHA `802e5f5b34fe4ab7d086cf0bae47ed522a811ec8`.

No separate Level 2 was triggered; accumulated V2-06–10 Level 2 belongs at **GROW-V2-10 — Inventory, traceability and compliance exports**. Full phase Level 3 remains GROW-V2-15; external testnet/deployment remains V2-16. Documentation and roadmap closeout commits are evidence-only, not a new tested implementation.
