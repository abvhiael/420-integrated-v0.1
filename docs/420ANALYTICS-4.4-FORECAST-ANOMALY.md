# ANALYTICS-4.4 — forecast and anomaly layer

ANALYTICS-4.4 adds explicitly predictive, non-canonical analytics outputs on top of qualified observed time-series data.

## Forecast contract

- forecasts bind to one immutable source-series ID and snapshot key;
- model ID, model version and human-readable model description are mandatory;
- forecast points must occur strictly after the observed series window and within the declared positive horizon;
- forecast values must be finite numeric text;
- optional lower/upper intervals must be complete, ordered and contain the forecast value;
- optional confidence values are bounded to `[0,1]`;
- forecasts are always `canonical=false`, `rebuildable=true`, `predictive=true`;
- content-addressed forecast IDs bind source series, snapshot key, model, horizon, generated time and every forecast point.

## Anomaly contract

- anomaly sets bind to one immutable source-series ID and snapshot key;
- each anomaly must point to an actual observed source-series point by timestamp, snapshot ID and observed value;
- anomaly scores must be finite and non-negative;
- anomalies are strictly time ordered;
- severity is explicit metadata and cannot turn the anomaly into canonical protocol state;
- anomaly sets are always `canonical=false`, `rebuildable=true`, `predictive=true`;
- content-addressed anomaly IDs bind source series, snapshot key, model, generated time and every anomaly record.

## Safety boundary

Forecast and anomaly classes are prohibited from being reused as observed metric provenance. Predictive output therefore cannot recursively become measured fact inside 420Analytics. Canonical protocol/accounting/validator/governance authority remains outside Analytics.

## Qualification

The phase is qualified when tests demonstrate source-series binding, observed/predictive separation, horizon enforcement, finite-score validation, anomaly-to-observation binding and stable content-addressed identity while repository qualification remains green.
