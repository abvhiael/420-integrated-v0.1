# 420Gateway operations and recovery runbook

420Gateway is an off-chain application access layer over canonical 420 storage resources. It must never be treated as protocol authority. Canonical storage truth remains chain state plus manifests, placements, commitments and accepted proofs.

This runbook covers production-oriented operation of the gateway service embedded in `node420`.

## 1. Preconditions

Before enabling the gateway, verify:

1. the intended `node420` build and execution environment are qualified;
2. at least one explicit 420Cache or 420Store upstream is configured;
3. the upstream timeout is positive;
4. concurrency and rate-limit values are positive and within supported bounds;
5. retry attempts and retry backoff values are positive and internally valid;
6. non-loopback or wildcard exposure has a valid TLS certificate/key pair;
7. non-loopback or wildcard exposure has explicit allowed Host values;
8. private-resource deployments have an actual `GatewayAccessAuthorizer` integration rather than relying on transport reachability alone.

The gateway must fail startup closed on invalid production boundary configuration.

## 2. Relevant node420 flags

Core service:

- `--gateway`
- `--gateway.listen`
- `--gateway.cache-url`
- `--gateway.cache-token`
- `--gateway.store-url`
- `--gateway.store-token`
- `--gateway.upstream-timeout`

Abuse controls:

- `--gateway.max-concurrent-requests`
- `--gateway.rate-limit-requests`
- `--gateway.rate-limit-window`

TLS and host boundary:

- `--gateway.tls-cert`
- `--gateway.tls-key`
- `--gateway.allowed-hosts`

Readiness:

- `--gateway.degraded-failure-threshold`

Retry/backoff:

- `--gateway.retry-attempts`
- `--gateway.retry-initial-backoff`
- `--gateway.retry-max-backoff`

The production retry defaults are three attempts, 100 ms initial backoff and a 1 second maximum backoff.

## 3. Endpoints

### `/v1/gateway`

Supports `GET` and `HEAD` retrieval using canonical object/shard identity parameters.

Successful responses may include:

- `X-420-Gateway-Tier`
- `X-420-Provider-ID`
- `X-420-Node-ID`
- `ETag`
- `Accept-Ranges: bytes`
- `Content-Range` for partial responses

The gateway revalidates the complete upstream payload against canonical cache/shard identity before serving either full or range data.

### `/healthz`

Process-liveness endpoint.

Use it to answer: “is the gateway HTTP service alive?”

It is intentionally independent from upstream degraded state.

### `/readyz`

Operational readiness endpoint.

Use it to answer: “is the gateway currently ready to receive application traffic?”

Repeated gateway `5xx` outcomes increment the health tracker. When the configured consecutive-failure threshold is reached, readiness becomes degraded and `/readyz` returns `503 Service Unavailable`. A later successful non-5xx gateway response resets the failure streak and restores readiness.

Health/readiness payloads are operational metadata only and are never canonical protocol state.

## 4. Normal startup sequence

1. verify upstream cache/store URLs and credentials;
2. verify TLS certificate/key and allowed hosts for any non-loopback exposure;
3. start `node420` with the intended gateway flags;
4. confirm `/healthz` returns success through the intended Host/TLS boundary;
5. confirm `/readyz` returns success;
6. perform a known canonical retrieval through `/v1/gateway`;
7. verify the returned payload and gateway metadata are expected;
8. only then attach public ingress, DNS, load balancers or application traffic.

Do not interpret a successful TCP connection or `/healthz` response as proof that upstream retrieval is healthy.

## 5. Private access

Private gateway mode requires explicit request metadata and an authorization implementation.

The request boundary uses:

- `X-420-Access-Mode`
- `X-420-Subject`
- `X-420-Session-ID`
- `X-420-Capability`

Private access is default-deny when required fields are missing, malformed, unsupported or rejected by the authorizer.

Never expose a private resource merely because a cache/store upstream is reachable. Transport access and resource authorization are separate boundaries.

## 6. Rate limiting and saturation

The gateway enforces:

- a bounded concurrent-request semaphore;
- per-client fixed-window request limiting based on the socket peer address;
- `429 Too Many Requests` when a rate or concurrency boundary is exceeded;
- `Retry-After` on those rejections.

Forwarding headers are not trusted as the rate-limit identity source.

If sustained legitimate traffic hits these limits, scale intentionally or adjust policy after reviewing capacity. Do not disable the boundary as an incident workaround.

## 7. Retry behavior

Retries are bounded and deterministic.

The gateway retries only:

- transport failures;
- HTTP `408 Request Timeout`;
- HTTP `425 Too Early`;
- HTTP `429 Too Many Requests`;
- HTTP `5xx` responses.

Ordinary non-transient `4xx` responses fail immediately.

Successful upstream responses still require exact-size and canonical payload integrity validation. Integrity failure is not retried as a transient transport problem.

Request cancellation interrupts both an active upstream request and any retry backoff wait.

## 8. Conditional and range requests

The gateway supports:

- deterministic strong ETags;
- `If-None-Match` and `304 Not Modified`;
- a single byte range in fixed, open-ended or suffix form;
- `206 Partial Content` with exact `Content-Range`;
- `416 Range Not Satisfiable` for malformed, unsupported, multi-range or unsatisfiable requests;
- `HEAD` with the same status/metadata semantics but no response body.

Authorization, routing and full-payload integrity validation occur before conditional/range serving logic can bypass them.

## 9. TLS and Host failures

### Unexpected Host -> `421 Misdirected Request`

Check the actual HTTP Host value against `--gateway.allowed-hosts`. Host matching is explicit and does not trust forwarding headers.

### Non-loopback startup rejection

A non-loopback or wildcard bind without a valid TLS pair and allowed-host policy is an invalid deployment configuration. Fix the deployment boundary instead of weakening it.

### Certificate/key load failure

Treat as startup failure. Repair the certificate/key path, permissions or contents before exposing the service.

## 10. Upstream failure and degraded readiness

If cache/store upstreams begin failing:

1. inspect `/readyz` and the privacy-safe gateway logs/metrics;
2. determine whether failure is isolated to cache, store or both;
3. verify network/TLS/auth reachability to the configured upstreams;
4. verify upstream service health independently;
5. preserve the configured routing order and canonical integrity checks;
6. allow bounded retries to handle transient failures;
7. remove or repair a persistently bad upstream rather than increasing retry counts without cause.

If one source fails and another succeeds, deterministic fallback may keep application retrieval working. This does not make the surviving source canonical authority.

## 11. Integrity failure

If an upstream returns the wrong size or content for the requested canonical shard/cache identity:

1. stop treating that source as trustworthy for the affected data;
2. preserve logs/evidence without recording bearer tokens or private request material;
3. validate the expected canonical manifest/shard identity from chain-backed state;
4. inspect the cache/store provider for corruption, stale placement or configuration mismatch;
5. repair or rehydrate the affected provider/cache through the normal protocol-valid path;
6. do not modify canonical identity to match corrupt local data.

The gateway must never “fix” an integrity mismatch by serving the invalid payload.

## 12. Privacy-safe observability

Gateway request observation is deliberately allowlisted.

Operational logs/metrics may include:

- method;
- public/private access mode;
- response status class/code;
- selected tier;
- range/conditional booleans;
- duration;
- response byte count.

They must not include raw request URLs, object IDs, manifest IDs, shard roots, subjects, session IDs, capabilities, bearer tokens or authorization headers.

Health polling is excluded from ordinary gateway request metrics so probes do not distort application traffic telemetry.

## 13. Graceful shutdown

For planned maintenance:

1. drain or remove external ingress;
2. allow active requests to complete where practical;
3. cancel/stop `node420` normally;
4. let the gateway HTTP service perform context-driven graceful shutdown;
5. verify the listener is closed before changing certificates, upstream configuration or deployment identity.

Cancellation propagates through active upstream requests and retry waits so shutdown is bounded rather than waiting for the full retry schedule.

## 14. Recovery sequence

After an outage or configuration fault:

1. verify the intended binary/configuration and TLS/Host boundary;
2. verify at least one cache/store upstream is configured and reachable;
3. restart `node420` with the intended gateway policy;
4. confirm `/healthz`;
5. confirm `/readyz`;
6. execute a known canonical retrieval;
7. verify conditional/range behavior only after full retrieval is healthy;
8. re-enable public ingress;
9. monitor failure streaks, 5xx rate, 429 rate, latency and response bytes for recurrence.

Do not restore traffic solely because liveness is green while readiness remains degraded.

## 15. SR-7 release qualification

SR-7 is developed as one monolithic phase on PR #289. Intermediate SR-7.x commits are not merged independently.

Before final merge:

1. all SR-7.1 through SR-7.10 implementation and tests must be present;
2. roadmap and this operator runbook must reflect the shipped behavior;
3. PR #289 must remain reconciled with current `main`;
4. the exact final head must pass `node420 Release Gate`;
5. the exact final head must pass `420 Integrated Qualification`;
6. only that exact qualified head may be merged.

An older green run does not qualify a newer documentation or code commit.
