# ANALYTICS-7.3 — trust presentation

ANALYTICS-7.3 makes the trust state of 420Analytics outputs visible in the dashboard rather than leaving provenance and non-authoritative semantics implicit.

## User-visible trust contract

Observed metrics expose:

- qualified `420Indexer` source identity
- chain ID
- indexed height
- safe height
- indexed timestamp
- freshness/staleness state
- safe/finality context
- explicit `canonical: false`
- explicit `rebuildable: true`

Time-series views expose explicit gap counts. Missing observations remain visible as missing data and are never interpolated into apparently observed facts.

Forecast and anomaly outputs are shown separately from observed metrics. Each predictive item exposes its model ID/version, generation time, source-series ID, snapshot key, item count, and explicit `predictive: true`, `canonical: false`, and `rebuildable: true` semantics.

Malformed metrics, series, forecasts, and anomaly sets fail closed and are not rendered as trusted dashboard data.

## Finality terminology

420Analytics does not create an independent finality authority. The dashboard reports qualified Indexer `safeHeight` context. A metric whose indexed height is at or below the supplied safe height is labeled `safe/finalized-context`; otherwise it is labeled `nonfinalized`.

## Qualification

ANALYTICS-7.3 is qualified when tests prove:

1. provenance and safe-height context are rendered from validated metrics;
2. stale status is visible;
3. explicit time-series gaps are surfaced;
4. predictive outputs are visibly separated and labeled non-canonical;
5. malformed predictive outputs do not render;
6. existing dashboard and API qualification remains green.
