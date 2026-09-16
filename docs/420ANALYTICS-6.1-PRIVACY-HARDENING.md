# ANALYTICS-6.1 — privacy hardening

ANALYTICS-6.1 turns the frozen 420Analytics privacy exclusions into executable admission controls.

## Protected classes

The following classes are never valid Analytics inputs:

- `private_messenger`
- `private_commons`
- `private_identity`
- `encrypted_resource_payload`
- `raw_attention_telemetry`

The shared `analytics/privacy` admission gate normalizes empty legacy classifications to `public`, explicitly admits `public`, rejects every frozen protected class, and fails closed on unknown classifications.

## Enforcement boundaries

1. **Derived metrics** — every metric created by `model.NewMetric` is stamped `privacyClass=public`. `model.ValidateMetric` invokes the privacy admission gate, so a protected or unknown classification invalidates the metric and prevents it from entering snapshots, time series, predictive layers, or the HTTP API.
2. **Protocol/application projections** — protocol event and object projections carry an optional privacy classification. Admission occurs before counting, lifecycle aggregation, distinct-protocol aggregation, or metric construction. This prevents private protocol material or raw Attention telemetry from being laundered into public aggregate counts.
3. **Cohorts/rankings** — cohort members carry an optional privacy classification. Admission occurs before normalization, grouping, thresholding, ranking, or result-ID construction. Privacy thresholds therefore do not make protected source data admissible; protected data is rejected outright.
4. **Snapshots and downstream derivatives** — snapshots call `ValidateMetric` for every constituent metric. Because time-series and predictive outputs validate their source snapshots/series, the public-only invariant propagates through downstream derived artifacts.

## Qualification

Automated tests prove:

- all five frozen protected classes are rejected;
- unknown classifications fail closed;
- public and legacy-empty classifications remain admissible;
- a protected metric cannot validate or enter a snapshot;
- raw Attention telemetry cannot enter protocol aggregates;
- private Messenger data cannot enter cohort/ranking construction.

420Analytics remains non-canonical and rebuildable. Privacy admission does not create authority over the underlying applications or grant access to protected payloads; it only prevents inadmissible data from entering Analytics.
