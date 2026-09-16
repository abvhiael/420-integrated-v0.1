# ANALYTICS-4.2 — deterministic time-series engine

ANALYTICS-4.2 adds the rebuildable historical-series layer for 420Analytics. The engine consumes already-qualified Analytics snapshots; it does not query node420, re-run protocol decoding, or create new canonical state.

## Contract

- Series are non-canonical and rebuildable.
- Series inputs are validated Analytics snapshots only.
- Metric methodology must match the ANALYTICS-4.1 registry exactly.
- One chain, metric identity, methodology version and unit are permitted per series.
- Query windows are half-open UTC ranges: `[start, end)`.
- Bucket widths are positive whole-second durations.
- Buckets are anchored to the requested series start and are therefore deterministic for the same query contract.
- When multiple observations fall in one bucket, the latest `generatedAt` snapshot wins; equal timestamps use lexical snapshot ID as the deterministic tie-break.
- Missing buckets are emitted explicitly with `gap=true`; the engine never interpolates, forward-fills or invents values.
- A series `snapshotKey` hashes the query contract plus the complete participating observation set, including snapshot identity, metric value/unit/methodology and source provenance.
- Series identity hashes the schema, metric, chain, window, bucket width and snapshot key.

## Fixed-snapshot pagination

Pagination is bound to `snapshotKey`. A cursor contains the fixed snapshot key and next point offset. A cursor from another series rebuild or changed snapshot set fails closed rather than paginating over a moving result set.

The page size is bounded to 500 points. Pagination preserves the exact deterministic point ordering established by the series build.

## Gap semantics

A gap point contains only bucket boundaries and `gap=true`. It carries no snapshot ID, generation time or metric value. Consumers must render missing data as missing data rather than zero.

## Qualification

Tests cover:

1. latest-observation selection inside a bucket;
2. explicit missing buckets with no synthetic values;
3. identical series/snapshot keys regardless of input snapshot order;
4. snapshot-key changes when metric content changes;
5. rejection of pagination cursors from a different fixed snapshot set;
6. methodology drift rejection;
7. non-canonical/rebuildable series invariants.

This phase does not introduce cohorts, rankings, forecasts or anomaly scoring; those remain ANALYTICS-4.3 and ANALYTICS-4.4.
