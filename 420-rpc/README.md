# 420RPC

420RPC is the public RPC gateway and routing layer for 420 Integrated. It sits in front of canonical `node420` execution RPC and, where appropriate, the non-authoritative 420Indexer API. It improves reliability, policy enforcement and developer ergonomics without gaining consensus, execution, signing or finality authority.

## Phase workflow

Each RPC phase is developed on its own branch and pull request. At the end of every phase, the branch is reconciled with current `main`, qualification is rerun, and the phase is merged to `main` before work begins on the next RPC phase.

## Completed phases

- **RPC-0:** architecture, authority boundaries, threat model, package layout and qualification contract.
- **RPC-1:** upstream node/provider abstraction and runtime capability discovery.
- **RPC-2:** explicit Ethereum JSON-RPC compatibility and method profiles.
- **RPC-3:** deterministic routing, health-aware selection, circuit breaking and safe failover.
- **RPC-4 — implementation complete:** chain identity, freshness and finality-safety enforcement.

## RPC-4 — chain identity, freshness and finality safety

RPC-4 adds a chain-safety gate before RPC-3 routing:

- chain observations bind provider ID, chain ID, head, safe and finalized checkpoints;
- chain ID remains pinned to 420 and changes relative to RPC-1 discovery are rejected;
- malformed or internally impossible checkpoint ordering fails closed;
- observations have a bounded age and future-dated evidence is rejected;
- providers that fall too far behind the freshest valid fleet head are removed from routing;
- required safe and finalized evidence must be present;
- same-height safe hash disagreement fails closed across the fleet;
- same-height finalized hash disagreement fails closed across the fleet;
- provider priority never resolves a finality disagreement;
- only providers that pass RPC-4 safety are handed to RPC-3 health/method/transport routing.

### RPC-4 authority boundary

420RPC does not decide which fork is canonical and does not create safe or finalized checkpoints. RPC-4 evaluates whether upstream evidence is mutually consistent and fresh enough to route. If eligible providers disagree at the same safe/finalized height, the gateway refuses to select a winner.

## Roadmap

- **RPC-0 — complete:** architecture, authority boundaries, threat model, package layout and qualification contract.
- **RPC-1 — complete:** upstream node/provider abstraction and capability discovery.
- **RPC-2 — complete:** canonical Ethereum JSON-RPC compatibility and method profiles.
- **RPC-3 — complete:** routing, health-aware upstream selection, circuit breaking and failover.
- **RPC-4 — implementation complete:** chain identity, freshness and finality-safety enforcement.
- **RPC-5 — next:** request validation, method policy and privileged-surface exclusion.
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
4. Safe/finalized same-height disagreement fails closed.
5. Signed transaction bytes are never semantically rewritten.
6. 420RPC never stores Wallet signing keys or signs user transactions.
7. 420Indexer-backed data remains visibly non-authoritative and derived.
8. Public transports require TLS in the deployment contract.
9. Routing, rate limiting, caching and failover never alter chain validity or finality semantics.
10. Capability discovery and chain observations are evidence about upstreams, not authority over the chain.
11. Unknown or privileged RPC methods are not silently passed through the gateway.
12. Availability pressure never promotes an ineligible, wrong-chain, stale or open-circuit provider.
13. Ambiguous transaction submission failures are not automatically replayed across providers.
14. Provider priority never resolves safe/finalized disagreement.

## Next phase

After RPC-4 is reconciled, fully qualified and merged to `main`, RPC-5 adds request validation and public method-policy enforcement.
