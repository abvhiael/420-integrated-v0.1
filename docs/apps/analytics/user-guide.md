# 420 Analytics user guide

Analytics presents network and ecosystem activity as charts, counters, distributions and time series.

## Read the metric definition
A number is only meaningful with its definition. Check unit, aggregation window, inclusion/exclusion rules and source/finality boundary.

## Compare like with like
Do not compare a finalized 24-hour metric with a head-based real-time metric as if they were identical datasets.

## Drill down
Where possible, use Explorer links or source references to inspect underlying blocks, transactions, logs or registered protocol objects.

## Revisions
Derived aggregates may change while their source range is pre-finality or while an indexer completes reorg repair/backfill. Finalized-source metrics should stabilize once their full source window is finalized.
