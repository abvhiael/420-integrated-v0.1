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
- **RPC-9 — implementation complete:** authentication, API credentials and Developer Hub integration.

## RPC-9 — authentication and Developer Hub credentials

RPC-9 reuses the DEVHUB-16 off-chain credential lifecycle contract rather than creating a second identity system:

- requires schema `1.0.0`, chain ID 420, matching environment and audience `420rpc`;
- recognizes `rpc:read`, `rpc:submit`, `rpc:subscribe`, `rpc:derived` and service-local `rpc:admin` scopes;
- parses strict Bearer credentials, hashes presented secrets locally and uses timing-safe digest comparison;
- persists credential metadata/digests only, never raw bearer secrets;
- rejects rotated, revoked, expired, future, wrong-chain, wrong-environment and wrong-audience credentials;
- derives stable credential principals and RPC-6 client keys;
- keeps anonymous access policy-controlled, with default read-only testnet access;
- never allows `rpc:admin` to bypass RPC-5 unknown/privileged method exclusions.

### RPC-9 authority boundary

420RPC credentials authenticate the off-chain gateway only. They are not 420 Identity credentials, wallet capabilities, Registry legitimacy, governance roles, protocol permissions or evidence of transaction validity/finality.

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
- **RPC-9 — implementation complete:** authentication, API credentials and Developer Hub integration.
- **RPC-10 — next:** observability, metrics, operational readiness and recovery.
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
9. Unknown, privileged or malformed RPC requests are rejected locally.
10. Batches cannot bypass quotas or concurrency limits.
11. Upstream subscription loss requires resubscription rather than silent stream migration.
12. Derived Indexer resources never satisfy canonical Ethereum JSON-RPC methods.
13. RPC-9 never persists raw bearer secrets.
14. Terminal or expired credentials fail closed.
15. Service credentials grant only explicit off-chain RPC scopes and never protocol authority.
16. Authentication never overrides RPC-5 method exclusions.

## Next phase

After RPC-9 is reconciled, fully qualified and merged to `main`, RPC-10 adds observability, metrics, operational readiness and recovery.
