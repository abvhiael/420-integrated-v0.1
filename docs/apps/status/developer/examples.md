# Examples

A safe status aggregator reads role-specific readiness, compares Indexer/RPC/finality freshness, records an incident with evidence when thresholds fail, publishes the degraded state, and marks recovery only after canonical state and documented exit criteria agree.
