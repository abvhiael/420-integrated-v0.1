# 420RPC

420RPC is the public RPC gateway and routing layer for 420 Integrated. It sits in front of canonical `node420` execution RPC and, where appropriate, the non-authoritative 420Indexer API. It improves reliability, policy enforcement and developer ergonomics without gaining consensus, execution, signing or finality authority.

## Phase workflow

Each RPC phase is developed on its own branch and pull request. At the end of every phase, the branch is reconciled with current `main`, qualification is rerun, and the phase is merged to `main` before work begins on the next RPC phase.

## RPC-0 — architecture and trust foundation — complete

RPC-0 established the non-negotiable service contract: chain ID 420, Engine isolation, no Wallet-key custody, no transaction signing or mutation, no gateway-owned finality, TLS public transport, explicit derived Indexer semantics and fail-closed finalized disagreement.

## RPC-1 — upstream abstraction and capability discovery — complete

RPC-1 established normalized execution/Indexer provider descriptors, chain-bound runtime capability discovery, reachable-versus-eligible status and fail-closed provider qualification.

## RPC-2 — Ethereum JSON-RPC compatibility and method profiles — in progress

RPC-2 defines an explicit public compatibility catalogue rather than blindly proxying whatever methods an upstream happens to expose:

- metadata profile for `web3_clientVersion`, `net_version` and `eth_chainId`;
- canonical read profile covering blocks, transactions, receipts, logs, balances, code, storage, calls and fee estimation;
- raw signed transaction submission through `eth_sendRawTransaction` only;
- WebSocket-only `eth_subscribe` / `eth_unsubscribe` compatibility;
- per-method transport, capability, mutation and user-signature metadata;
- method eligibility intersected with RPC-1 discovered upstream capabilities;
- unknown methods fail closed instead of being transparently proxied;
- node-managed signing/account methods such as `eth_sendTransaction`, `eth_sign` and `eth_accounts` are excluded;
- privileged `engine_`, `admin_`, `personal_`, `debug_`, `miner_` and `txpool_` namespaces are outside the public surface;
- deterministic profile and hostile-state qualification tests.

### RPC-2 authority boundary

The method catalogue defines what the gateway is willing to serve. It does not decide transaction validity, fork choice, finality or canonical state. `eth_sendRawTransaction` forwards already-signed bytes to an eligible execution provider; 420RPC never signs or rewrites them. RPC-4 and RPC-5 will later add freshness/finality safety and request-policy enforcement around this compatibility contract.

## Roadmap

- **RPC-0 — complete:** architecture, authority boundaries, threat model, package layout and qualification contract.
- **RPC-1 — complete:** upstream node/provider abstraction and capability discovery.
- **RPC-2 — in progress:** canonical Ethereum JSON-RPC compatibility and method profiles.
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
11. Unknown or privileged RPC methods are not silently passed through the gateway.

## Next phase

After RPC-2 is reconciled, qualified and merged, RPC-3 will implement routing, health-aware upstream selection, circuit breaking and failover.
