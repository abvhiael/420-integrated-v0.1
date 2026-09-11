# 420RPC

420RPC is the public RPC gateway and routing layer for 420 Integrated. It sits in front of canonical `node420` execution RPC and, where appropriate, the non-authoritative 420Indexer API. It improves reliability, policy enforcement and developer ergonomics without gaining consensus, execution, signing or finality authority.

## Phase workflow

Each RPC phase is developed on its own branch and pull request. At the end of every phase, the branch is reconciled with current `main`, qualification is rerun, and the phase is merged to `main` before work begins on the next RPC phase.

## RPC-0 — architecture and trust foundation — in progress

RPC-0 establishes the non-negotiable service contract before network routing is implemented:

- package and module layout;
- explicit 420RPC service identity and architecture version;
- expected chain ID pinned to 420;
- canonical execution upstream class separated from derived 420Indexer reads;
- public transport contract requiring TLS (`https`/`wss`);
- Engine API isolation from all public gateway traffic;
- no custody or storage of Wallet signing keys;
- no transaction signing or signed-byte rewriting;
- no independent finality decision-making;
- fail-closed behavior for finalized-state disagreement;
- executable validation of architecture invariants.

### RPC-0 authority boundary

420RPC is ingress infrastructure. It may eventually authenticate, route, load-balance, rate-limit, cache safe reads, expose WebSocket subscriptions, select compatible upstreams, and provide developer-facing helper APIs. None of those capabilities make it authoritative for chain state.

Canonical execution reads come from compatible `node420` execution endpoints. 420Indexer responses are explicitly derived and rebuildable. Consensus/finality remain with the chain. Wallet/user signatures remain with users and Wallet infrastructure. The authenticated Engine API remains a private consensus-to-execution control plane and is never a 420RPC public upstream.

## Roadmap

- **RPC-0** — architecture, authority boundaries, threat model, package layout and qualification contract.
- **RPC-1** — upstream node/provider abstraction and capability discovery.
- **RPC-2** — canonical Ethereum JSON-RPC compatibility and method profiles.
- **RPC-3** — routing, health-aware upstream selection and failover.
- **RPC-4** — chain identity, freshness and finality-safety enforcement.
- **RPC-5** — request validation, method policy and privileged-surface exclusion.
- **RPC-6** — rate limiting, quotas, resource bounds and abuse controls.
- **RPC-7** — WebSocket transport and subscription lifecycle.
- **RPC-8** — 420Indexer-backed enriched/read APIs with explicit derived-state semantics.
- **RPC-9** — authentication, API credentials and Developer Hub integration.
- **RPC-10** — observability, metrics, operational readiness and recovery.
- **RPC-11** — hostile-state/security hardening and fault qualification.
- **RPC-12** — testnet qualification and launch closeout.

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
