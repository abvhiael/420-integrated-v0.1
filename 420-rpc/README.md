# 420RPC

420RPC is the public RPC gateway and routing layer for 420 Integrated. It sits in front of canonical `node420` execution RPC and, where appropriate, the non-authoritative 420Indexer API. It improves reliability, policy enforcement and developer ergonomics without gaining consensus, execution, signing or finality authority.

## Phase workflow

Each RPC phase is developed on its own branch and pull request. At the end of every phase, the branch is reconciled with current `main`, qualification is rerun, and the phase is merged to `main` before work begins on the next RPC phase.

## RPC-0 — architecture and trust foundation — complete

RPC-0 established the non-negotiable service contract: chain ID 420, Engine isolation, no Wallet-key custody, no transaction signing or mutation, no gateway-owned finality, TLS public transport, explicit derived Indexer semantics and fail-closed finalized disagreement.

## RPC-1 — upstream abstraction and capability discovery — in progress

RPC-1 turns the RPC-0 upstream concepts into runtime provider contracts:

- normalized execution-RPC and 420Indexer descriptors;
- endpoint/transport consistency validation;
- chain-ID pinning and duplicate-provider rejection;
- enabled/priority metadata for later routing phases;
- transport-neutral JSON-RPC requester interface;
- transport-neutral Indexer metadata reader interface;
- runtime execution discovery for chain identity, client version, head reads, safe/finalized tags, transaction-submission eligibility and subscription transport;
- runtime 420Indexer discovery for chain identity, readiness and explicit non-authoritative/derived semantics;
- wrong-chain, disabled, unreachable or misdeclared upstreams fail closed and never enter the eligible provider pool;
- capability reports remain observations used by later routing logic rather than a new source of protocol authority.

### RPC-1 authority boundary

Discovery can determine whether an endpoint is suitable for 420RPC routing. It cannot make an endpoint canonical. Execution state remains canonical only because it comes from compatible `node420` execution on the intended chain. 420Indexer remains rebuildable derived state. Provider priority and eligibility affect gateway routing only; they do not affect fork choice, finality or transaction validity.

## Roadmap

- **RPC-0 — complete:** architecture, authority boundaries, threat model, package layout and qualification contract.
- **RPC-1 — in progress:** upstream node/provider abstraction and capability discovery.
- **RPC-2:** canonical Ethereum JSON-RPC compatibility and method profiles.
- **RPC-3:** routing, health-aware upstream selection and failover.
- **RPC-4:** chain identity, freshness and finality-safety enforcement.
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

## Next phase

After RPC-1 is reconciled, qualified and merged, RPC-2 will define canonical Ethereum JSON-RPC compatibility and explicit method profiles.
