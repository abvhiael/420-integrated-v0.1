# ANALYTICS-6.3 — abuse and resource controls

ANALYTICS-6.3 bounds the public 420Analytics HTTP surface so expensive or malformed read requests cannot turn the non-authoritative analytics service into an unbounded resource consumer.

## Genesis controls

The HTTP API now enforces:

- response item limits (`default=100`, `max=500`)
- one-year maximum requested series window
- 2 KiB maximum encoded query string
- bounded query parameter cardinality and value size
- bounded `metricId` length
- rejection of unknown and duplicate query parameters
- 100,000-item maximum catalog scan cardinality
- 4 MiB maximum serialized JSON response
- a two-second request context deadline
- an injectable rate-limit hook with `429 Too Many Requests` and `Retry-After` support

The default rate limiter is permissive so policy remains an operational deployment concern. A deployment may inject identity-, network-, tenant-, or gateway-aware quotas without changing API semantics or granting Analytics any protocol authority.

## Failure behavior

Malformed or over-broad client requests fail with `400`. Rate-limited requests fail with `429`. Server-side catalog or response-size resource exhaustion fails closed with `503` rather than returning a partial response that could be mistaken for a complete analytics result.

All JSON responses remain `Cache-Control: no-store`. Analytics remains read-only, non-canonical and rebuildable.

## Qualification

Automated tests prove:

1. the rate-limit hook rejects and emits `Retry-After` deterministically;
2. unknown, duplicate, oversized and over-cardinality query inputs fail closed;
3. catalog scans cannot exceed the Genesis cardinality ceiling;
4. serialized responses cannot exceed the Genesis byte ceiling;
5. every guarded request receives a bounded execution context;
6. `/v1/capabilities` exposes the active resource ceilings and rate-limit-hook support.

ANALYTICS-6.3 does not add protocol writes, canonical state, custody, settlement, finality authority or independent chain ingestion.
