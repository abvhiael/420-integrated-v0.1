# Analytics security

- Treat charts and dashboards as derived evidence, not canonical authority.
- Verify network, source window and freshness.
- Prefer metrics with documented definitions and reproducible source rules.
- Do not infer an individual's private behavior from protected/non-indexable data.
- Never provide private keys, recovery secrets or passkey material to Analytics.
- Treat pre-finality metrics as revisable.
- If source data is stale, wrong-chain or inconsistent, mark the metric degraded rather than silently presenting it as current.

Analytics must not expose private Messenger payloads, encrypted Resource content, private Identity fields or raw private Attention telemetry.
