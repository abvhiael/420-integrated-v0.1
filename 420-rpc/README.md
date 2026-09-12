# 420RPC

420RPC is the public RPC gateway and routing layer for 420 Integrated. It sits in front of canonical `node420` execution RPC and, where appropriate, the non-authoritative 420Indexer API. It improves reliability, policy enforcement and developer ergonomics without gaining consensus, execution, signing or finality authority.

## Phase workflow

Each RPC phase is developed on its own branch and pull request. At the end of every phase, the branch is reconciled with current `main`, qualification is rerun, and the phase is merged to `main` before work begins on the next RPC phase.

## Completed phases

- **RPC-0:** architecture, authority boundaries, threat model, package layout and qualification contract.
- **RPC-1:** explicit upstream abstraction and capability discovery.
- **RPC-2:** Ethereum JSON-RPC compatibility and method profiles.
- **RPC-3:** deterministic routing, circuit breaking and safe failover.
- **RPC-4:** chain identity, freshness and finality safety.
- **RPC-5:** request validation and privileged-surface enforcement.
- **RPC-6:** weighted quotas, batch/resource bounds and concurrency controls.
- **RPC-7:** WebSocket session and subscription lifecycle.
- **RPC-8:** explicit non-authoritative 420Indexer-derived reads.
- **RPC-9:** authentication, API credentials and Developer Hub integration.
- **RPC-10:** observability, readiness, metrics and operational recovery.
- **RPC-11 — implementation complete:** hostile-state and cross-layer security hardening.

## RPC-11 — hostile-state security hardening

RPC-11 adds a single hardened ingress order across the existing layers:

1. bounded JSON structural inspection;
2. strict top-level JSON-RPC envelope shape;
3. RPC-5 request/method/parameter validation;
4. RPC-9 scope authorization;
5. RPC-6 quota/cost/concurrency admission;
6. RPC-4/RPC-3 safety-aware routing and transport handling.

Structural hardening bounds nesting depth, JSON node count, aggregate string/key bytes and object-key count. It rejects non-JSON/non-finite values, prototype-pollution keys (`__proto__`, `prototype`, `constructor`) and unexpected top-level request keys before stateful admission.

Cross-layer hostile tests prove that malformed or unauthorized traffic cannot consume RPC-6 quota/client state, mixed-scope batches fail atomically, `rpc:admin` cannot bypass privileged-method exclusions, and accepted requests are accounted to the stable RPC-9 client key and release leases cleanly.

### RPC-11 authority boundary

Security hardening can reject unsafe traffic. It cannot establish chain truth, finality, transaction validity, fork choice, wallet authority, Registry legitimacy or protocol authorization.

## Roadmap

- **RPC-0 through RPC-10 — complete**
- **RPC-11 — implementation complete:** hostile-state/security hardening and fault qualification.
- **RPC-12 — next:** testnet qualification and launch closeout.

## Core invariants

1. 420RPC never becomes consensus or execution authority.
2. Engine API methods and credentials never cross the public gateway boundary.
3. Wrong-chain upstreams are rejected, not routed.
4. Safe/finalized disagreement fails closed.
5. Signed transaction bytes are never semantically rewritten.
6. 420RPC never stores Wallet signing keys or signs user transactions.
7. 420Indexer-backed data remains visibly non-authoritative and derived.
8. Unknown, privileged or malformed requests are rejected locally.
9. Batches cannot bypass quotas, authorization or concurrency limits.
10. Upstream subscription loss requires resubscription rather than silent migration.
11. Authentication never overrides RPC-5 method exclusions.
12. Process liveness never implies canonical readiness.
13. Telemetry never exposes bearer material or principal identifiers.
14. Malformed structure and authorization failures occur before stateful RPC-6 admission.
15. Prototype-pollution object keys and envelope-smuggling keys fail closed.
16. RPC-11 hardening never creates canonical authority.

## Next phase

After RPC-11 is reconciled, fully qualified and merged to `main`, RPC-12 performs testnet qualification and launch closeout.
