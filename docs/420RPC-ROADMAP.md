# 420RPC implementation roadmap

420RPC is the public ingress, routing and policy layer for 420 Integrated. It fronts compatible execution RPC providers and selected derived read services without becoming protocol authority.

## Delivery rule

Each numbered RPC phase is developed, reconciled against current `main`, fully qualified, and merged to `main` before the next phase begins.

## Completed phases

### RPC-0 — architecture and trust foundation — complete

Delivered the `420-rpc/` package, service authority boundaries, chain-ID pinning, Engine isolation, non-custodial transaction rules, TLS public transport, threat model and qualification workflow.

### RPC-1 — upstream abstraction and capability discovery — complete

Delivered normalized execution and Indexer provider descriptors, runtime capability discovery, chain binding, reachable-versus-eligible status and fail-closed provider qualification.

### RPC-2 — Ethereum JSON-RPC compatibility and method profiles — complete

Delivered the explicit public Ethereum JSON-RPC method catalogue, metadata/read/submit/subscription profiles, capability requirements, raw signed transaction submission, WebSocket compatibility, and fail-closed exclusion of unknown, signing/account and privileged methods.

### RPC-3 — routing, upstream health, circuit breaking and failover — complete

Delivered deterministic method/transport-aware provider selection, gateway-local circuit breakers, read/metadata failover, no ambiguous signed-transaction replay, and fail-closed routing when no qualified healthy provider exists.

### RPC-4 — chain identity, freshness and finality safety — complete

Delivered chain-observation validation, strict chain identity continuity, freshness and head-lag bounds, safe/finalized evidence requirements, fail-closed same-height checkpoint disagreement, and integration ahead of RPC-3 routing.

### RPC-5 — request validation, method policy and privileged-surface enforcement — complete

Delivered JSON-RPC envelope and parameter validation, public compatibility policy enforcement, privileged namespace exclusion, raw transaction byte checks, subscription-shape checks and stable local policy errors before upstream dispatch.

### RPC-6 — rate limiting, quotas, resource bounds and abuse protection — complete

Delivered weighted method admission, per-client token buckets, batch/count/byte/cost ceilings, per-client/global concurrency leases, bounded tracked-client state and fail-closed resource exhaustion behavior.

## RPC-7 — WebSocket transport and subscription lifecycle — implementation complete

Delivered:

- bounded WebSocket session creation with unique local session IDs;
- heartbeat and idle-expiry tracking;
- per-session and global subscription caps;
- RPC-5 request validation before subscription lifecycle allocation;
- RPC-6 resource admission for subscription setup;
- gateway-local pending subscription IDs;
- explicit binding from each local subscription to one `(upstreamId, upstreamSubscriptionId)` pair;
- upstream-subscription IDs namespaced by provider identity;
- ownership enforcement preventing cross-session unsubscribe;
- exact-bound event delivery to the owning local subscription/session;
- individual event-size bounds;
- per-session queued-message and queued-byte bounds;
- fail-closed session cleanup on backpressure exhaustion;
- full subscription cleanup when sessions close;
- upstream-loss invalidation that forces client resubscription instead of silently claiming gap-free failover;
- lifecycle snapshots and hostile-state regression tests;
- `docs/420RPC-WEBSOCKET.md`.

RPC-7 is a transport/lifecycle boundary only. Subscription events remain upstream evidence and do not become gateway assertions of canonicality or finality. RPC-3 may select a different provider for a new subscription, but existing streams are not silently migrated across providers after upstream loss.

Exit gate: implementation is complete. Merge requires the exact final head to pass 420RPC, docs and repository-wide qualification and remain reconciled with current `main`.

## Remaining phases

- **RPC-8:** enriched/indexer-backed read APIs with explicit derived-state semantics.
- **RPC-9:** authentication, API credentials and Developer Hub integration.
- **RPC-10:** observability, health/readiness, metrics and operational recovery.
- **RPC-11:** hostile-state and security hardening.
- **RPC-12:** testnet qualification and launch closeout.

## Authority rule

420RPC may refuse malformed, unsupported, privileged, over-budget, stale, wrong-chain or unsafe requests/upstreams and may close unhealthy WebSocket sessions, but it never determines canonical blocks, transaction validity, consensus, safe/finalized checkpoints or fork choice. Subscription delivery is transport, not protocol authority.
