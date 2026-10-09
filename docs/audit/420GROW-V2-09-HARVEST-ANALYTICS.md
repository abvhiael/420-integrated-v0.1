# GROW-V2-09 — Harvest forecasting and production analytics

**Status: IN PROGRESS — NOT YET LEVEL-1 QUALIFIED.** This file is an implementation inventory, not a completion claim.

## Implemented on the stacked V2 audit branch

- A tenant-private harvest observation service, with authenticated scoped write/view policies.
- Recorded dry harvest weight in canonical grams, immutable actor/source/timestamps and idempotency keys.
- PostgreSQL append-only `grow_private.harvest_records` with forced tenant RLS, plant and zone foreign keys, and a one-record-per-plant constraint.
- Only plants in the `HARVESTED` state are permitted as harvest sources.
- Bounded historical analytics with observed total, count and per-record average distinct from estimated weight.
- A labeled historic-mean forecast with lower/upper uncertainty bounds only when at least three observed samples exist; insufficient history produces no estimate.
- Adversarial and input-validation unit cases, SQL policy checks, and an app-only CI stage.

## Outstanding before COMPLETE

- Add planned harvest date windows and lifecycle-calendar integration; do not conflate planned and actual harvests.
- Add time-series production analytics and well-defined exports; preserve metric denominators and provenance.
- Review aggregation pagination/limits to avoid misleading truncated totals or intervals and account for sparse/biased samples.
- Fully qualify data persistence, one-plant-one-harvest accounting, cross-tenant RLS, replay, malicious/malformed input and cancellation.
- Run Go formatting, unit/race/vet and PostgreSQL qualification; verify both exact-SHA fast workflows and preserve run/job evidence.
- Verify individual canonical exit criteria and update this document, roadmap and PR only after every gate passes.

Level 2 stays at GROW-V2-10. Level 3 stays at GROW-V2-15. No global Foundry inventory or redundant Genesis full suite is authorized at this step. No production rollout or release implied.
