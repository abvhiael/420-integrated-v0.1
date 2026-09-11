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
- **RPC-7:** WebSocket session, subscription lifecycle, backpressure and upstream-loss handling.
- **RPC-8 — implementation complete:** 420Indexer-backed enriched/read APIs with explicit derived-state semantics.

## RPC-8 — derived 420Indexer reads

RPC-8 adds a distinct read surface for indexed and enriched data without changing the canonical Ethereum JSON-RPC path:

- routes only to eligible `indexer-api` upstreams with `derived-read` capability;
- never substitutes execution RPC for a derived resource or Indexer for canonical `eth_*` methods;
- maps the stable 420Indexer v1 resources for status, blocks, transactions, receipts, logs, addresses, asset transfers, protocol events, protocol objects and search;
- chain-scopes every request to chain ID 420;
- validates required path parameters before route construction;
- rejects authoritative, transaction-capable, wrong-chain, unready or capability-incompatible Indexer providers;
- validates projection observation metadata for readiness, chain identity and freshness;
- wraps successful responses with explicit `source: 420Indexer`, `derived: true`, `authoritative: false`, chain ID, upstream ID, indexed head and observation time.

### RPC-8 authority boundary

Indexer-backed data is rebuildable projection state. It can improve discovery, search and historical ergonomics, but it never decides canonical balances, ownership, registrations, settlements, rights, governance outcomes, bridge state, eligibility, transaction validity, fork choice or finality.

## Roadmap

- **RPC-0 — complete:** architecture, authority boundaries, threat model, package layout and qualification contract.
- **RPC-1 — complete:** upstream node/provider abstraction and capability discovery.
- **RPC-2 — complete:** canonical Ethereum JSON-RPC compatibility and method profiles.
- **RPC-3 — complete:** routing, health-aware upstream selection, circuit breaking and failover.
- **RPC-4 — complete:** chain identity, freshness and finality-safety enforcement.
- **RPC-5 — complete:** request validation, method policy and privileged-surface enforcement.
- **RPC-6 — complete:** rate limiting, quotas, batch/resource bounds, concurrency controls and abuse protection.
- **RPC-7 — complete:** WebSocket transport and subscription lifecycle.
- **RPC-8 — implementation complete:** enriched/indexer-backed read APIs with explicit derived-state semantics.
- **RPC-9 — next:** authentication, API credentials and Developer Hub integration.
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
23. Derived Indexer resources never satisfy canonical Ethereum JSON-RPC methods.
24. Every RPC-8 response retains explicit non-authoritative projection provenance.

## Next phase

After RPC-8 is reconciled, fully qualified and merged to `main`, RPC-9 adds authentication, API credentials and Developer Hub integration.
