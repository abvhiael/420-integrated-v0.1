# 420Explorer testnet deployment

EXP-7.1 packages the qualified `420Explorer` runtime for testnet deployment and provides an independent HTTP smoke qualifier.

## Runtime contract

`420Explorer` remains a presentation-only consumer of the qualified `420Indexer /v1` API. The container has no node420 RPC setting, ingestion loop, checkpoint store, reorg engine, or canonical-authority role.

Required environment:

- `EXPLORER_INDEXER_URL` — qualified 420Indexer base URL.

Optional runtime environment:

- `EXPLORER_LISTEN_ADDR` — defaults to `:8420`.
- `EXPLORER_CHAIN_ID` — defaults to `420`.
- `EXPLORER_STALE_AFTER` — defaults to `2m`.
- `EXPLORER_INDEXER_TIMEOUT` — defaults to `10s`.
- `EXPLORER_SHUTDOWN_TIMEOUT` — defaults to `10s`.

Build from the repository root:

```sh
docker build -f explorer/deploy/Dockerfile -t 420explorer:testnet .
```

Run against a testnet Indexer:

```sh
docker run --rm -p 8420:8420 \
  -e EXPLORER_INDEXER_URL=https://indexer.testnet.example \
  -e EXPLORER_CHAIN_ID=420 \
  420explorer:testnet
```

## Live smoke qualification

Run `explorersmoke` from the image (override the normal entrypoint) or build it locally. The qualifier requires all of the following to pass over the live HTTP surface:

- `/v1/health` reports Explorer process liveness.
- `/v1/ready` is ready and reports the expected chain.
- `/v1/status` is ready and reports the expected chain.
- `/v1/capabilities` advertises the qualified read-only surface.
- every checked response declares `420Explorer`, `420Indexer`, `canonicalAuthority=false`, and `QUALIFIED_INDEXER_API_CONSUMER` provenance headers.

Example:

```sh
docker run --rm --entrypoint /usr/local/bin/explorersmoke \
  -e EXPLORER_SMOKE_URL=https://explorer.testnet.example \
  -e EXPLORER_SMOKE_CHAIN_ID=420 \
  420explorer:testnet
```

A successful run emits a JSON record with `"status":"QUALIFIED"`. Any unavailable, stale, degraded, wrong-chain, inconsistent, or provenance-invalid Explorer fails closed with a non-zero exit code.
