# 420RPC

420RPC is the public RPC gateway and routing layer for 420 Integrated. It sits in front of canonical `node420` execution RPC and, where appropriate, the non-authoritative 420Indexer API. It improves reliability, policy enforcement and developer ergonomics without gaining consensus, execution, signing or finality authority.

## Phase workflow

Each RPC phase is developed on its own branch and pull request. At the end of every phase, the branch is reconciled with current `main`, qualification is rerun, and the phase is merged to `main` before work begins on the next RPC phase.

## RPC-0 — architecture and trust foundation — complete

RPC-0 established the non-negotiable service contract: chain ID 420, Engine isolation, no Wallet-key custody, no transaction signing or mutation, no gateway-owned finality, TLS public transport, explicit derived Indexer semantics and fail-closed finalized disagreement.

## RPC-1 — upstream abstraction and capability discovery — complete

RPC-1 established normalized execution/Indexer provider descriptors, chain-bound runtime capability discovery, reachable-versus-eligible status and fail-closed provider qualification.

## RPC-2 — Ethereum JSON-RPC compatibility and method profiles — complete

RPC-2 established the explicit public Ethereum JSON-RPC compatibility catalogue, capability requirements, raw signed transaction submission, WebSocket subscription compatibility, and fail-closed exclusion of unknown, node-managed signing and privileged methods.

## RPC-3 — routing, health, circuit breaking and failover — implementation complete

RPC-3 converts provider qualification and method compatibility into deterministic routing:

- provider identity composition checks across descriptor, discovery and health state;
- method-aware provider eligibility using the RPC-2 catalogue;
- transport-aware selection for HTTP(S) and WebSocket providers;
- deterministic ordering by circuit health, configured priority and provider ID;
- independent closed/open/half-open circuit state per upstream;
- configurable consecutive-failure threshold and cooldown;
- successful half-open probes restore providers to service;
- failed half-open probes immediately reopen the circuit;
- metadata/read requests may fail over across already-qualified providers;
- `eth_sendRawTransaction` is deliberately not automatically replayed to another upstream after an ambiguous dispatch failure;
- established subscriptions are not transparently failed over; RPC-7 owns subscription lifecycle;
- wrong-chain, ineligible, capability-incompatible and open-circuit providers remain excluded even when no healthy alternative exists.

### RPC-3 authority boundary

Routing changes which compatible provider receives a request; it never makes a provider canonical. Health state is gateway-local operational evidence only. 420RPC does not override transaction validity, chain identity, finality or fork choice in order to preserve availability.

## Roadmap

- **RPC-0 — complete:** architecture, authority boundaries, threat model, package layout and qualification contract.
- **RPC-1 — complete:** upstream node/provider abstraction and capability discovery.
- **RPC-2 — complete:** canonical Ethereum JSON-RPC compatibility and method profiles.
- **RPC-3 — implementation complete:** routing, health-aware upstream selection, circuit breaking and failover.
- **RPC-4 — next:** chain identity, freshness and finality-safety enforcement.
- **RPC-5:** request validation, method policy and privileged-surface exclusion.
- **RPC-6:** rate limiting, quotas, resource bounds and abuse controls.
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
4. Finalized-state disagreement fails closed.
5. Signed transaction bytes are never semantically rewritten.
6. 420RPC never stores Wallet signing keys or signs user transactions.
7. 420Indexer-backed data remains visibly non-authoritative and derived.
8. Public transports require TLS in the deployment contract.
9. Routing, rate limiting, caching and failover never alter chain validity or finality semantics.
10. Capability discovery is evidence about an upstream, not authority over the chain.
11. Unknown or privileged RPC methods are not silently passed through the gateway.
12. Availability pressure never promotes an ineligible, wrong-chain or open-circuit provider.
13. Ambiguous transaction submission failures are not automatically replayed across providers.

## Next phase

After RPC-3 is reconciled, fully qualified and merged to `main`, RPC-4 will add chain identity, freshness and finality-safety enforcement to the routing layer.
