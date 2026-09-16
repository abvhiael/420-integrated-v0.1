# ANALYTICS-7.2 — metric presentation

ANALYTICS-7.2 adds qualified metric presentation to the 420Analytics dashboard shell.

## Presentation contract

Cards, charts and metric-table rows expose the same context contract:

- metric identity and label;
- value and unit;
- observation window;
- source (`420Indexer`);
- methodology ID and version.

Only metrics that pass `model.ValidateMetric` and series that pass `timeseries.Validate` are admitted to the dashboard. Invalid or authority-violating derived objects are omitted instead of being rendered as trusted analytics.

## Cards

The dashboard renders a bounded set of qualified metrics as cards. Cards retain metric class, value, unit, window, source and methodology metadata. Dashboard cardinality is independently bounded even when the backing catalog contains more data.

## Charts

Qualified time series are rendered as lightweight server-side SVG line charts. Gaps remain explicit and are counted separately from observed points; the renderer does not interpolate missing observations. Each chart displays unit, source, methodology and full series window.

## Tables

The metric table exposes the same metadata contract as cards and charts so users do not lose provenance or methodology context when moving between presentation modes.

## Authority boundary

Dashboard presentation remains derived, rebuildable and non-canonical. Rendering does not create protocol authority, alter source data, fill missing observations, or bypass the 420Indexer-only projection boundary.

## Qualification

ANALYTICS-7.2 is qualified when tests demonstrate:

- invalid metrics and series are excluded;
- cards, charts and rows retain unit/window/source/methodology context;
- series gaps remain explicit;
- chart and card result counts are bounded;
- the HTTP dashboard adapter uses the live Analytics catalog without changing API authority semantics.
