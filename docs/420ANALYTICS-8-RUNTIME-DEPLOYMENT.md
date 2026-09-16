# 420Analytics — ANALYTICS-8 Runtime & Deployment

ANALYTICS-8 turns the qualified derived-data implementation into the deployable `analytics420` service.

## Runtime

Executable: `./analytics/cmd/analytics420`

Default listen address: `:8424`

Mounted routes:

- `GET /health` — process/API health
- `GET /ready` — fail-closed analytics readiness
- `GET /v1/status`
- `GET /v1/capabilities`
- `GET /v1/methodologies`
- `GET /v1/metrics`
- `GET /v1/snapshots`
- `GET /v1/series`
- `GET /v1/forecasts`
- `GET /v1/anomalies`
- `GET /dashboard`
- `/` redirects to `/dashboard`

The runtime never opens node420 RPC. It only constructs the already-qualified 420Indexer API client. Analytics remains non-canonical and rebuildable.

## Configuration

Required:

- `ANALYTICS_INDEXER_URL`

Optional:

- `ANALYTICS_LISTEN_ADDR` (default `:8424`)
- `ANALYTICS_CHAIN_ID` (default `420`)
- `ANALYTICS_STALE_AFTER` (default `2m`)
- `ANALYTICS_INDEXER_TIMEOUT` (default `10s`)
- `ANALYTICS_REFRESH_INTERVAL` (default `15s`)
- `ANALYTICS_SHUTDOWN_TIMEOUT` (default `10s`)

All duration overrides must be positive Go duration strings. Chain ID must be a non-zero uint64.

## Readiness

The runtime catalog starts unready. The refresh service qualifies Indexer health, readiness, chain identity, non-authoritative status and freshness, then reads snapshot provenance. Only a fresh qualified snapshot marks Analytics ready.

If Indexer qualification or snapshot retrieval fails, Analytics fails readiness closed and reports stale status. Existing derived data remains rebuildable and never becomes canonical authority.

## Shutdown

`analytics420` handles SIGINT and SIGTERM with `http.Server.Shutdown` using the configured shutdown timeout. The Indexer refresh loop is bound to the same cancellation context.

## HTTP server bounds

The runtime sets explicit server timeouts:

- read header: 5s
- read: 15s
- write: 30s
- idle: 60s

The ANALYTICS-6.3 API resource controls remain active inside the API handler.

## Container

`analytics/Dockerfile` builds a static `analytics420` binary using Go 1.23 and runs it as a non-root user in Alpine. Port 8424 is exposed.

Example build from repository root:

```sh
docker build -f analytics/Dockerfile -t analytics420 .
```

Example run:

```sh
docker run --rm -p 8424:8424 \
  -e ANALYTICS_INDEXER_URL=http://indexer420:8420 \
  -e ANALYTICS_CHAIN_ID=420 \
  analytics420
```

## Qualification contract

ANALYTICS-8 requires:

1. startup rejects missing Indexer configuration;
2. malformed chain/duration configuration fails closed;
3. operational and API/dashboard routes are mounted;
4. qualified Indexer snapshot transitions readiness to true;
5. failed Indexer qualification transitions readiness to false/stale;
6. runtime uses graceful signal-driven shutdown;
7. container runs the dedicated `analytics420` executable as a non-root user;
8. no direct RPC, ingestion, finality authority, or canonical database is introduced.

ANALYTICS-9 will add live testnet qualification, seeded metric evidence, restart/rebuild/reorg validation and machine-readable evidence against this runtime.
