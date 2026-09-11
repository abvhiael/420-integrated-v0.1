# 420RPC

420RPC is the public RPC gateway and routing layer for 420 Integrated. It sits in front of canonical `node420` execution RPC and, where appropriate, the non-authoritative 420Indexer API. It improves reliability, policy enforcement and developer ergonomics without gaining consensus, execution, signing or finality authority.

## Phase workflow

Each RPC phase is developed on its own branch and pull request. At the end of every phase, the branch is reconciled with current `main`, qualification is rerun, and the phase is merged to `main` before work begins on the next RPC phase.

## Completed phases

- **RPC-0:** architecture, authority boundaries, threat model, package layout and qualification contract.
- **RPC-1:** upstream node/provider abstraction and runtime capability discovery.
- **RPC-2:** explicit Ethereum JSON-RPC compatibility and method profiles.
- **RPC-3:** deterministic routing, health-aware selection, circuit breaking and safe failover.
- **RPC-4:** chain identity, freshness and finality-safety enforcement.
- **RPC-5:** request validation, method policy and privileged-surface enforcement.
- **RPC-6:** weighted rate limits, quotas, batch/resource bounds, concurrency controls and abuse protection.
- **RPC-7 — implementation complete:** WebSocket session, subscription lifecycle, backpressure and upstream-loss handling.

## RPC-7 — WebSocket transport and subscription lifecycle

RPC-7 adds bounded state around the RPC-2/RPC-5 WebSocket subscription surface:

- creates bounded gateway-local WebSocket sessions;
- requires `eth_subscribe` setup to pass RPC-5 and RPC-6 before lifecycle allocation;
- allocates local pending subscription IDs and explicitly binds them to `(upstreamId, upstreamSubscriptionId)` after upstream acceptance;
- namespaces upstream subscription IDs by provider identity;
- prevents cross-session unsubscribe;
- enforces per-session and global subscription limits;
- bounds individual event size, queued event count and queued bytes;
- closes and cleans a session when backpressure capacity is exhausted;
- tracks heartbeats and idle expiry;
- cleans all subscription state when a session closes;
- invalidates subscriptions on upstream loss and requires client resubscription rather than claiming silent gap-free failover.

### RPC-7 authority boundary

WebSocket delivery is transport only. Subscription events are upstream evidence; 420RPC does not convert them into canonicality or finality claims. RPC-3 may route a new subscription to another eligible upstream, but RPC-7 never silently migrates an existing stream across providers while hiding a possible event gap.

## Roadmap

- **RPC-0 — complete:** architecture, authority boundaries, threat model, package layout and qualification contract.
- **RPC-1 — complete:** upstream node/provider abstraction and capability discovery.
- **RPC-2 — complete:** canonical Ethereum JSON-RPC compatibility and method profiles.
- **RPC-3 — complete:** routing, health-aware upstream selection, circuit breaking and failover.
- **RPC-4 — complete:** chain identity, freshness and finality-safety enforcement.
- **RPC-5 — complete:** request validation, method policy and privileged-surface enforcement.
- **RPC-6 — complete:** rate limiting, quotas, batch/resource bounds, concurrency controls and abuse protection.
- **RPC-7 — implementation complete:** WebSocket transport and subscription lifecycle.
- **RPC-8 — next:** 420Indexer-backed enriched/read APIs with explicit derived-state semantics.
- **RPC-9:** authentication, API credentials and Developer Hub integration.
- **RPC-10:** observability, metrics, operational readiness and recovery.
- **RPC-11:** hostile-state/security hardening and fault qualification.
- **RPC-12:** testnet qualification and launch closeout.

## Core invariants

1. 420RPC never becomes consensus or execution authority.
2. Engine API methods and credentials never cross the public gateway boundary.
3. Wrong-chain upstreams are rejected, not routed.
4. Safe/finalized same-height disagreement fails closed.
5. Signed transaction bytes are never semantically rewritten.
6. 420RPC never stores Wallet signing keys or signs user transactions.
7. 420Indexer-backed data remains visibly non-authoritative and derived.
8. Public transports require TLS in the deployment contract.
9. Routing, rate limiting, caching and failover never alter chain validity or finality semantics.
10. Capability discovery and chain observations are evidence about upstreams, not authority over the chain.
11. Unknown, privileged or malformed RPC requests are rejected locally instead of being transparently proxied.
12. Availability pressure never promotes an ineligible, wrong-chain, stale or open-circuit provider.
13. Ambiguous transaction submission failures are not automatically replayed across providers.
14. Provider priority never resolves safe/finalized disagreement.
15. Request-policy acceptance never implies execution validity.
16. Batches are charged by aggregate work and cannot bypass quotas or concurrency limits.
17. Resource exhaustion fails closed rather than disabling safety or policy checks.
18. RPC-6 client accounting identity is not authentication authority.
19. One WebSocket session cannot control another session's subscription state.
20. Subscription queues are bounded; backpressure exhaustion fails closed.
21. Upstream subscription loss requires resubscription rather than silent stream migration.
22. Subscription delivery never becomes a finality or canonicality assertion by 420RPC.

## Next phase

After RPC-7 is reconciled, fully qualified and merged to `main`, RPC-8 adds 420Indexer-backed enriched/read APIs with explicit derived-state semantics.
