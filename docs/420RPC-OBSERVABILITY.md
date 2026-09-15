# 420RPC RPC-10 observability, readiness and recovery

RPC-10 adds bounded operational telemetry for 420RPC without turning telemetry into protocol authority.

The operating rule is: **observability can explain why 420RPC is willing or unwilling to serve traffic; it cannot decide what is canonical.**

## Liveness and readiness

RPC-10 separates process liveness from request readiness.

- **liveness** means the gateway process heartbeat is fresh enough to be considered alive;
- **canonical readiness** requires fresh gateway observations, the expected chain/environment, no known finality conflict, and at least one fresh RPC-4-safe execution provider that is reachable, eligible and not behind an open circuit;
- **transaction submission readiness** follows canonical readiness because the gateway must never accept submission through a chain-unsafe ingress state;
- **subscription readiness** follows canonical readiness, while established subscriptions remain governed by RPC-7 lifecycle rules;
- **derived-read readiness** additionally requires at least one fresh, ready, eligible 420Indexer provider.

A live process may therefore be `ready: false`. That is expected fail-closed behavior.

## Operational states

The aggregate status uses bounded operational states:

- `healthy` — canonical ingress is ready and at least one derived provider is ready;
- `degraded` — canonical ingress is ready but optional derived service is unavailable, or the gateway is still satisfying recovery hysteresis;
- `unavailable` — canonical ingress is not safe/ready to serve;
- `unknown` — reserved for surfaces that have insufficient evidence before evaluation.

These states are service-health evidence only. They do not prove consensus safety, settlement, ownership, Registry legitimacy, protocol authorization, or finality.

## Recovery hysteresis

RPC-10 does not immediately restore readiness after a failure based on one good probe. `RpcReadinessTracker420` requires a configurable number of consecutive healthy observations before the gateway returns to ready state. The default is two.

Any failed observation during recovery resets the success streak. This limits readiness flapping and prevents a transient single probe from reopening ingress after a wrong-chain, stale, provider-loss, or finality-conflict condition.

Recovery never overrides RPC-4 safety checks. It can delay reopening; it cannot force readiness while the raw safety evaluation is failing.

## Metrics

`RpcMetrics420` exposes fixed-name counters with fixed, low-cardinality dimensions only. Current counter names include:

- `requests_total`
- `requests_rejected_total`
- `upstream_failures_total`
- `auth_failures_total`
- `rate_limits_total`
- `ws_disconnects_total`
- `readiness_transitions_total`

Dimensions are bounded categories such as `read`, `submit`, `subscription`, `derived`, `policy`, `resource`, `auth`, `upstream`, `websocket`, and `readiness`.

Metrics must not use credential IDs, application IDs, addresses, transaction hashes, methods supplied by untrusted callers, request payloads, arbitrary error strings, or upstream URLs as labels. This prevents both secret leakage and unbounded-cardinality memory growth.

The in-memory metric sample budget is bounded and fails closed when exhausted.

## Snapshot surface

`createRpcOperationalSnapshot420` returns a redacted operational view containing:

- selected chain/environment;
- readiness result and reason;
- execution provider counts;
- Indexer provider counts;
- aggregate WebSocket queue/session counts;
- RPC-6 resource-accounting counts;
- count of installed RPC-9 credentials;
- fixed-dimension metrics.

It explicitly reports:

- `containsSecrets: false`
- `containsPrincipalIdentifiers: false`
- `canonicalAuthority: false`

Raw bearer credentials, secret digests, principal IDs, credential IDs, application IDs, request bodies, transaction hashes, addresses and signing material are never part of the operational snapshot contract.

## Developer Hub relationship

RPC-10 is compatible with the DEVHUB-17 operational-status model. Developer Hub or 420Status may consume RPC-10 status as one service-health input, but neither that consumer nor 420RPC status becomes canonical protocol state.

A green RPC status means the tested ingress evidence currently satisfies gateway readiness policy. It does not prove a specific transaction settled, a block finalized, an application is legitimate, or an authorization is valid.

## Recovery workflow

Operators should treat a not-ready gateway as an ingress safety condition:

1. inspect the readiness reason;
2. restore fresh/correct execution-provider observations or resolve the upstream condition;
3. preserve RPC-4 finality and chain-identity fail-closed rules;
4. allow the configured healthy-observation threshold to complete;
5. only then restore request readiness.

Do not bypass readiness by manually rewriting telemetry, marking an unsafe provider healthy, suppressing finality conflicts, or weakening chain-ID checks.

## Invariants

- **RPC-INV-OBS-001** — process liveness never implies request readiness.
- **RPC-INV-OBS-002** — canonical readiness requires a fresh RPC-4-safe execution provider on the expected chain.
- **RPC-INV-OBS-003** — known finality conflict forces canonical readiness false.
- **RPC-INV-OBS-004** — Indexer failure may degrade derived reads without making canonical Ethereum RPC derived from Indexer state.
- **RPC-INV-OBS-005** — recovery requires consecutive healthy observations and cannot override raw safety failure.
- **RPC-INV-OBS-006** — operational metrics use fixed low-cardinality dimensions.
- **RPC-INV-OBS-007** — telemetry budgets are bounded and fail closed on exhaustion.
- **RPC-INV-OBS-008** — operational snapshots contain no bearer secrets or principal identifiers.
- **RPC-INV-OBS-009** — operational status has `canonicalAuthority: false`.
- **RPC-INV-OBS-010** — wrong-chain, stale, provider-loss, and finality-conflict conditions cannot be converted into healthy state by observability code.

## Next

RPC-11 performs hostile-state and security hardening across the complete RPC-0 through RPC-10 surface, including adversarial cross-layer qualification and failure-injection coverage.
