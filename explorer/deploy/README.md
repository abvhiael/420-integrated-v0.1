# 420Explorer testnet deployment

EXP-7 packages the qualified `420Explorer` runtime for testnet deployment, smoke qualification, and live-data validation.

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

## EXP-7.1 smoke qualification

Run `explorersmoke` from the image (override the normal entrypoint) or build it locally. The qualifier checks liveness, readiness, status, capabilities, expected chain ID, and qualified provenance headers.

```sh
docker run --rm --entrypoint /usr/local/bin/explorersmoke \
  -e EXPLORER_SMOKE_URL=https://explorer.testnet.example \
  -e EXPLORER_SMOKE_CHAIN_ID=420 \
  420explorer:testnet
```

A successful run emits `"status":"QUALIFIED"`. Any unavailable, stale, degraded, wrong-chain, inconsistent, or provenance-invalid Explorer fails closed.

## EXP-7.2 live-data validation

`explorerlivevalidate` is the stronger end-to-end gate. It requires representative indexed testnet data rather than merely healthy endpoints. A successful validation proves the live Explorer can present:

- process liveness and strict readiness;
- network status and qualified capability metadata;
- a real indexed block and block-detail view;
- a real transaction and receipt;
- a real address view;
- Registry service listing and a concrete service detail;
- asset activity;
- consensus state;
- consistent `420Explorer`/`420Indexer` non-authoritative provenance on every checked response.

The validator discovers a transaction and address from the first log in its sampled block. On a quiet testnet, seed one transaction that emits a log before validation. Alternatively set `EXPLORER_LIVE_TX_HASH` and `EXPLORER_LIVE_ADDRESS` to known indexed samples.

```sh
docker run --rm --entrypoint /usr/local/bin/explorerlivevalidate \
  -e EXPLORER_LIVE_URL=https://explorer.testnet.example \
  -e EXPLORER_EXPECTED_CHAIN_ID=420 \
  420explorer:testnet
```

Optional validation environment:

- `EXPLORER_LIVE_TX_HASH` — known indexed transaction hash when auto-discovery is unavailable.
- `EXPLORER_LIVE_ADDRESS` — known indexed address when auto-discovery is unavailable.
- `EXPLORER_LIVE_TIMEOUT` — per-request timeout, default `10s`.

The command emits a JSON evidence report containing every check plus sampled block, transaction, address, and service identifiers. `passed` must be `true` before EXP-7.2 is considered complete. A testnet with no representative transaction/address/registry data fails closed rather than receiving a false live-validation pass.

### Development compensation transaction activity

Set `EXPLORER_COMPENSATION_INDEXER_URL` to the trusted 420Indexer HTTP origin
serving the authenticated compensation projection for the same chain. The
regular `EXPLORER_INDEXER_URL` continues to supply transaction, receipt, log,
block and finality records. Both origins must track the same canonical chain.

The transaction page reads
`GET /v1/transactions/{hash}/compensation`. Explorer requests only the matching
transaction from the Indexer's `420DevelopmentCompensation` projection and
checks the result against indexed receipt and block provenance. The response
is uncached. It returns an empty event list when the projection has no
matching records and reports unavailable when the upstream is unconfigured,
unreachable or inconsistent with the canonical block. The displayed
confirmation count is relative to the indexed head.
