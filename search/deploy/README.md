# 420Search runtime deployment — SEARCH-8

`search420` is the genesis 420Search runtime. It serves the versioned Search API at `/v1/*` and the embedded 420Search web application at `/` from one process.

## Authority boundary

420Search is a rebuildable discovery projection, not canonical protocol authority. The runtime:

- requires a qualified 420Indexer HTTP endpoint;
- never connects directly to node420 JSON-RPC;
- never owns chain ingestion, finality or reorg processing;
- fails closed when the Indexer is wrong-chain, stale, not ready or violates the non-authoritative consumer contract;
- exposes only the frozen public Search domains;
- does not index private Messenger, private Commons, private Identity, encrypted Resource payloads or raw Attention telemetry.

## Environment

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `SEARCH_INDEXER_URL` | yes | — | Qualified 420Indexer base URL. |
| `SEARCH_LISTEN_ADDR` | no | `:8421` | HTTP listen address. |
| `SEARCH_CHAIN_ID` | no | `420` | Required chain ID. |
| `SEARCH_STALE_AFTER` | no | `2m` | Maximum accepted Indexer head age. |
| `SEARCH_INDEXER_TIMEOUT` | no | `10s` | Timeout for Indexer HTTP calls. |
| `SEARCH_SHUTDOWN_TIMEOUT` | no | `10s` | Graceful shutdown deadline. |
| `SEARCH_PUBLIC_COMMONS_VISIBILITY` | no | `public` | Comma-separated canonical public Commons visibility values admitted to Search. |

`SEARCH_INDEXER_URL` must be an HTTP(S) URL for 420Indexer. There is intentionally no `SEARCH_RPC_URL` or node420 endpoint.

## Endpoints

- `/v1/search`
- `/v1/suggest`
- `/v1/resolve`
- `/v1/capabilities`
- `/v1/health`
- `/v1/readiness`
- `/v1/status`
- `/` embedded 420Search UI

Health/readiness/status are Search operational views derived from the qualified Indexer consumer boundary. They are not consensus or canonical chain authority.

## Container

Build from the repository root:

```sh
docker build -f search/deploy/Dockerfile -t 420search:search-8 .
```

Run:

```sh
docker run --rm -p 8421:8421 \
  -e SEARCH_INDEXER_URL=http://indexer420:8420 \
  -e SEARCH_CHAIN_ID=420 \
  420search:search-8
```

The process logs one JSON startup record that states the chain requirement and explicitly records `canonicalAuthority:false` and `directRpc:false`.

## Production expectations

Run behind the ecosystem ingress/TLS layer. Apply external request-rate controls in addition to SEARCH-6.3's in-process admission hooks. Probe `/v1/health` for liveness and `/v1/readiness` for traffic admission. Do not route production traffic when readiness is `503`.

The Search database/index, when introduced by deployment infrastructure, is disposable/rebuildable state. Operators must never treat Search storage as a source of canonical protocol truth.
