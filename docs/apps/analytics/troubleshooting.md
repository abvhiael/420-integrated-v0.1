# Analytics troubleshooting

## Metric changed after refresh
Check whether the source window included pre-finality data, reorg repair or backfill.

## Two dashboards disagree
Compare metric definition version, source range, finality policy, filters and units.

## Dashboard is stale
Inspect indexed/finalized height and backend readiness. Do not use stale metrics for time-sensitive decisions.

## Total does not match a single canonical balance/state value
An aggregate may use filters or historical windows. Drill into the metric definition and underlying source records.

## Missing historical range
The Indexer/API may still be rebuilding/backfilling or the metric may not support that range/version.
