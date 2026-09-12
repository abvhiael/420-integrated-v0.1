# Analytics API integration

Analytics APIs should expose versioned metric definitions and values together.

A response should identify at least the metric/version, value/unit, source range, source/finality boundary and generation/freshness context. Consumers should reject unknown metric versions when semantic comparability matters.

Underlying public chain/protocol data should derive from the qualified 420Indexer `/v1` boundary or other explicitly documented public canonical-source adapters.
