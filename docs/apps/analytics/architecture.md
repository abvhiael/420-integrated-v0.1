# 420 Analytics architecture

420 Analytics consumes qualified 420Indexer `/v1` projections and supported public protocol/Registry context, then applies versioned aggregation rules.

```text
canonical chain/protocols
        |
    420Indexer
        |
       /v1
        |
 versioned aggregations
        |
 Analytics API/UI
```

The aggregation store, caches and dashboards are replaceable. Analytics must preserve source provenance, metric-definition version and freshness/finality context.

Analytics should not establish an independent canonical ingestion/finality mechanism. Raw protocol decisions stay with the protocol that owns them.
