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
- **RPC-5 — implementation complete:** request validation, method policy and privileged-surface enforcement.

## RPC-5 — request validation and method policy

RPC-5 adds the request firewall in front of RPC-4 safety and RPC-3 routing:

- requires JSON-RPC 2.0 request objects;
- validates request IDs and rejects public notifications by default;
- requires every method to be present in the RPC-2 compatibility catalogue;
- blocks Engine, admin, personal, debug, miner and txpool namespaces before upstream dispatch;
- keeps node-managed account/signing methods excluded;
- requires positional array params on the public surface;
- validates method arity and canonical addresses, hashes, hex quantities, byte strings and block selectors;
- validates transaction call objects, log filters, fee-history percentile arrays, raw signed transaction bytes and supported subscription shapes;
- rejects malformed envelopes with `-32600`, blocked/unknown methods with `-32601`, and invalid params with `-32602`;
- validates batch entries without taking over RPC-6 resource/batch-size policy.

### RPC-5 authority boundary

Policy decides whether 420RPC will forward a syntactically allowed public request. It does not decide whether a transaction is valid, sign transactions, rewrite signed bytes, invent chain state, choose fork choice or decide finality.

## Roadmap

- **RPC-0 — complete:** architecture, authority boundaries, threat model, package layout and qualification contract.
- **RPC-1 — complete:** upstream node/provider abstraction and capability discovery.
- **RPC-2 — complete:** canonical Ethereum JSON-RPC compatibility and method profiles.
- **RPC-3 — complete:** routing, health-aware upstream selection, circuit breaking and failover.
- **RPC-4 — complete:** chain identity, freshness and finality-safety enforcement.
- **RPC-5 — implementation complete:** request validation, method policy and privileged-surface enforcement.
- **RPC-6 — next:** rate limiting, quotas, resource bounds and abuse controls.
- **RPC-7:** WebSocket transport and subscription lifecycle.
- **RPC-8:** 420Indexer-backed enriched/read APIs with explicit derived-state semantics.
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

## Next phase

After RPC-5 is reconciled, fully qualified and merged to `main`, RPC-6 adds rate limiting, quotas, batch/resource bounds and abuse controls.
