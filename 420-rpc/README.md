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
- **RPC-6 — implementation complete:** weighted rate limits, quotas, batch/resource bounds, concurrency controls and abuse protection.

## RPC-6 — resource admission and abuse protection

RPC-6 adds a bounded admission layer after RPC-5 validation and before chain-safety/routing work:

- enforces independent single-request and batch byte ceilings;
- caps batch entry count and aggregate weighted cost;
- gives expensive methods higher admission cost than cheap metadata/read methods;
- charges every batch entry so batching cannot bypass quotas;
- enforces per-client and global concurrency using explicit admission leases;
- uses a per-client token bucket with deterministic refill and `retryAfterMs` guidance;
- bounds the number of tracked client identities;
- evicts only idle client state and never evicts an active lease to preserve availability;
- rejects malformed/blocked RPC-5 requests before quota is consumed;
- keeps client identity accounting separate from RPC-9 authentication semantics.

### RPC-6 authority boundary

Admission controls gateway resource use only. Passing RPC-6 does not make a transaction valid, create canonical state, decide safe/finalized checkpoints or fork choice, authorize a user, or alter signed bytes. Resource pressure never promotes an otherwise unsafe or ineligible provider.

## Roadmap

- **RPC-0 — complete:** architecture, authority boundaries, threat model, package layout and qualification contract.
- **RPC-1 — complete:** upstream node/provider abstraction and capability discovery.
- **RPC-2 — complete:** canonical Ethereum JSON-RPC compatibility and method profiles.
- **RPC-3 — complete:** routing, health-aware upstream selection, circuit breaking and failover.
- **RPC-4 — complete:** chain identity, freshness and finality-safety enforcement.
- **RPC-5 — complete:** request validation, method policy and privileged-surface enforcement.
- **RPC-6 — implementation complete:** rate limiting, quotas, batch/resource bounds, concurrency controls and abuse protection.
- **RPC-7 — next:** WebSocket transport and subscription lifecycle.
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
16. Batches are charged by aggregate work and cannot bypass quotas or concurrency limits.
17. Resource exhaustion fails closed rather than disabling safety or policy checks.
18. RPC-6 client accounting identity is not authentication authority.

## Next phase

After RPC-6 is reconciled, fully qualified and merged to `main`, RPC-7 adds WebSocket transport and subscription lifecycle management.
