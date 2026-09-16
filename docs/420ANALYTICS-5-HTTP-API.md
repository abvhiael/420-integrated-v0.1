# ANALYTICS-5 — Analytics HTTP API

ANALYTICS-5 exposes the qualified 420Analytics read model over a bounded, versioned HTTP API without creating protocol authority.

## Endpoints

- `GET /health`
- `GET /ready`
- `GET /v1/status`
- `GET /v1/capabilities`
- `GET /v1/methodologies`
- `GET /v1/metrics`
- `GET /v1/snapshots`
- `GET /v1/series`
- `GET /v1/forecasts`
- `GET /v1/anomalies`

All responses are read-only derived analytics. `420Analytics` remains non-canonical and rebuildable.

## Bounds

List endpoints default to 100 results and reject limits outside `1..500`. Series time windows must provide both `start` and `end`, use RFC3339 timestamps, have `start < end`, and may span at most one year. These API-level bounds are intentionally conservative; ANALYTICS-6.3 adds broader abuse and resource controls.

## Trust semantics

`/v1/status` forcibly reports `canonical:false` even if a backing catalog is misconfigured. `/v1/capabilities` exposes the non-canonical/rebuildable contract and supported resources. Forecast and anomaly responses are explicitly labeled `predictive:true` and `canonical:false`, preserving the ANALYTICS-4.4 separation between observed facts and predictive outputs.

Invalid objects from backing catalogs are not emitted by validated metric, snapshot, series, forecast, or anomaly endpoints. Methodologies are sourced from the frozen versioned registry established in ANALYTICS-4.1.

## Qualification

Tests cover health and capability identity, readiness failure with HTTP 503, forced non-canonical status, limit bounds, series-window bounds, explicit predictive labels, and constructor failure on a missing catalog.
