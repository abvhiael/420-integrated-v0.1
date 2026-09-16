# ANALYTICS-9 — testnet qualification

ANALYTICS-9 qualifies the deployed `analytics420` runtime against a live 420Indexer-backed testnet service without granting Analytics any canonical authority.

## Qualification surfaces

The live validator is `analytics/cmd/analyticslivevalidate` and requires `ANALYTICS_LIVE_URL` to point at the deployed Analytics service. `ANALYTICS_LIVE_TIMEOUT` optionally overrides the default 15 second HTTP timeout.

The validator emits a machine-readable JSON report with schema `420-analytics-testnet-qualification-v1` and exits non-zero when any required check fails.

The static qualification contract is recorded at `testnet/public-services/analytics/qualification.json`.

## Required live checks

A qualifying runtime must expose:

- healthy `/health` service identity for `420Analytics` API v1;
- ready `/ready` state;
- non-stale, non-canonical `/v1/status` with a non-zero chain/indexed height and `safeHeight <= indexedHeight`;
- `/v1/capabilities` declaring `canonical=false` and `rebuildable=true`;
- the four seeded network metrics: `network.indexed_height`, `network.safe_height`, `network.finality_depth`, and `network.projection_lag`;
- 420Indexer provenance plus methodology ID/version on seeded metrics;
- at least one qualified derived snapshot with 420Indexer provenance;
- the registered methodology catalog.

## Restart and rebuild evidence

Runtime qualification tests construct a fresh Analytics catalog from the same qualified Indexer snapshot after a simulated process restart. The rebuilt metric set and content-bound snapshot identity must match the first build exactly. This demonstrates that Analytics state is disposable and rebuildable rather than canonical.

## Reorg and safe-head evidence

A same-slot non-safe projection whose Indexer head hash changes is reconciled by replacement, not duplication. The replacement snapshot must carry the new head hash and non-regressing safe height. A safe-height regression is rejected and readiness fails closed.

These tests exercise Analytics reconciliation only. Analytics does not perform independent chain ingestion, fork choice, finality calculation, or node RPC access.

## Evidence state

Repository qualification proves the validator contract and deterministic restart/rebuild/reorg behavior. `testnet/public-services/analytics/readiness.json` intentionally keeps `liveTestnetEvidence=false` until `analyticslivevalidate` is run against an actual deployed testnet endpoint and its JSON output is retained as release evidence.

Example execution:

```sh
ANALYTICS_LIVE_URL=https://analytics.testnet.example \
  go run ./analytics/cmd/analyticslivevalidate > analytics-9-evidence.json
```

A successful report must contain `"passed": true`.
