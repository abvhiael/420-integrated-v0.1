# Analytics integration examples

## Finalized transaction-count metric
1. Select a documented block/time window.
2. Require the entire source range to be finalized.
3. Count canonical indexed transactions according to the metric version.
4. Return count, unit, range, finality and metric-version metadata.

## Reorg-sensitive live dashboard
Mark the metric as head-based, retain the source head, and recompute affected buckets after Indexer reorg repair.

## Comparing two periods
Use the same metric definition/version, unit, window semantics and finality policy for both periods before calculating change.
