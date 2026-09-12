# 420 Search architecture

420 Search consumes the shared 420Indexer `/v1` projection boundary plus Registry-backed public service metadata and supported public protocol projections.

```text
canonical chain/protocols
        |
    420Indexer
        |
       /v1
        |
 search index/ranker
        |
    420 Search UI/API
```

The search-owned index, ranker, snippets, sponsorship metadata and caches are replaceable. Search does not crawl private payloads, become a protocol resolver of last resort or operate an independent canonical chain-ingestion path.

Canonical disputes are resolved by the owning protocol/chain, not by whichever result Search ranks first.
