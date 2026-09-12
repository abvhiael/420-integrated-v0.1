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
- **RPC-8:** 420Indexer-backed enriched/read APIs with explicit derived-state semantics.
- **RPC-9:** authentication, API credentials and Developer Hub integration.
- **RPC-10 — implementation complete:** observability, health/readiness, metrics and operational recovery.

## RPC-10 — observability and recovery

RPC-10 adds a bounded, non-authoritative operational layer:

- separates process liveness from canonical request readiness;
- requires fresh expected-chain observations and at least one RPC-4-safe execution provider for canonical readiness;
- fails canonical readiness on known finality conflict, stale evidence, wrong chain or loss of safe execution providers;
- allows Indexer outage to degrade derived reads without silently affecting canonical Ethereum semantics;
- requires consecutive healthy observations before recovery reopens ingress;
- exposes fixed-name, low-cardinality counters with bounded sample budgets;
- aggregates WebSocket, RPC-6 resource and RPC-9 credential counts without principal identifiers or secret material;
- produces redacted operational snapshots with `canonicalAuthority: false`.

### RPC-10 authority boundary

Operational status explains whether the gateway is currently willing to serve traffic under its safety policy. It does not establish consensus, settlement, ownership, transaction validity, Registry legitimacy, protocol authorization, fork choice or finality.

## Roadmap

- **RPC-0 — complete**
- **RPC-1 — complete**
- **RPC-2 — complete**
- **RPC-3 — complete**
- **RPC-4 — complete**
- **RPC-5 — complete**
- **RPC-6 — complete**
- **RPC-7 — complete**
- **RPC-8 — complete**
- **RPC-9 — complete**
- **RPC-10 — implementation complete:** observability, health/readiness, metrics and operational recovery.
- **RPC-11 — next:** hostile-state/security hardening and fault qualification.
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
9. Unknown, privileged or malformed RPC requests are rejected locally.
10. Batches cannot bypass quotas or concurrency limits.
11. Upstream subscription loss requires resubscription rather than silent stream migration.
12. Derived Indexer resources never satisfy canonical Ethereum JSON-RPC methods.
13. RPC-9 never persists raw bearer secrets.
14. Terminal or expired credentials fail closed.
15. Service credentials grant only explicit off-chain RPC scopes and never protocol authority.
16. Authentication never overrides RPC-5 method exclusions.
17. Process liveness never implies canonical request readiness.
18. Finality conflict, wrong-chain state, stale evidence or loss of safe execution providers fails readiness closed.
19. Recovery hysteresis can delay reopening but can never override RPC-4 safety failure.
20. RPC-10 telemetry never exposes bearer material or principal identifiers and never becomes canonical authority.

## Next phase

After RPC-10 is reconciled, fully qualified and merged to `main`, RPC-11 performs hostile-state and security hardening across the complete RPC surface.
