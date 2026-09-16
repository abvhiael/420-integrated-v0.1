# ANALYTICS-7.1 — Dashboard shell

ANALYTICS-7.1 introduces the first user-facing 420Analytics dashboard surface without changing Analytics authority or data ownership. The dashboard is a presentation shell over the existing read-only Analytics service boundaries.

## Shell contract

The shell provides:

- a network overview with chain ID, indexed height, safe height, finality depth, indexed timestamp and explicit freshness state;
- stable navigation anchors for Network, Validators, Protocols, Economics and Predictive analytics;
- bounded window presets of 1h, 24h, 7d, 30d and 90d;
- a bounded metric-ID filter control;
- direct methodology access through `/v1/methodologies`;
- API navigation for status, metrics and series;
- responsive and keyboard-accessible HTML with explicit loading/missing-value placeholders;
- an always-visible non-canonical Analytics label.

The shell does not introduce a frontend framework, canonical state, protocol writes, independent chain reads or hidden data joins. Metric cards, charts and tables are intentionally deferred to ANALYTICS-7.2. Provenance/finality/freshness and predictive trust presentation are expanded in ANALYTICS-7.3.

## Runtime boundary

`analytics/dashboard` owns the HTML shell and its presentation model. `analytics/httpapi.Server.DashboardHandler()` adapts the existing Analytics catalog status into the dashboard view model. The final `analytics420` runtime will mount this handler during ANALYTICS-8, keeping dashboard presentation separate from API abuse/resource middleware and preserving the existing API contract.

## Qualification

Tests verify that the shell renders the required navigation, network overview, bounded window filters, methodology link, non-canonical label, stale/missing-state presentation and live catalog status adapter.
