# 420 Explorer architecture

420 Explorer is a replaceable presentation client over the qualified 420Indexer `/v1` API. It does not run an independent canonical ingestion pipeline and must not become a consensus, execution, finality or Registry authority.

```text
fourtwentyd + node420
        |
   canonical chain
        |
    420Indexer
        |
      /v1
        |
   420 Explorer
```

The Indexer preserves canonical provenance, historical Registry-backed decoder context and head/safe/finalized cursors. Explorer adds navigation, formatting and cross-links.

Failure is contained: an Explorer or Indexer outage may degrade observation, but must not prevent direct Wallet/RPC/contract use.

See [420Indexer infrastructure](../../architecture/infrastructure/420indexer.md).
