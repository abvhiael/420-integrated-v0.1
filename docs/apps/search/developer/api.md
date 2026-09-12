# Search API integration

A Search API should return typed results with stable identifiers, result domain, display fields, provenance and freshness/finality context.

Consumers must distinguish exact-resolution results from relevance-ranked discovery results. Do not use rank as authorization input.

Underlying chain/public protocol projections should derive from qualified 420Indexer `/v1` data and registered service sources. Pagination and ranking tokens are presentation mechanisms and should be treated as opaque.
