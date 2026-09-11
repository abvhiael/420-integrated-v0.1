# 420RPC implementation roadmap

420RPC is the public ingress, routing and policy layer for 420 Integrated. It fronts compatible execution RPC providers and selected derived read services without becoming protocol authority.

## Delivery rule

Each numbered RPC phase is developed, reconciled against current `main`, fully qualified, and merged to `main` before the next phase begins. This keeps the infrastructure stack incrementally deployable and prevents later phases from hiding unmerged architectural debt.

## RPC-0 — architecture and trust foundation

Deliverables:

- `420-rpc/` package foundation;
- explicit architecture version and service identity;
- canonical execution and derived-indexer upstream classes;
- chain-ID pinning;
- public TLS transport contract;
- Engine API isolation;
- no signing-key custody;
- no transaction signing or mutation;
- no gateway-owned finality;
- fail-closed finalized disagreement policy;
- executable architecture validation and regression tests;
- documented threat model and authority boundaries.

Exit gate: package builds, architecture tests pass, repository qualification is green, branch is reconciled to `main`, and RPC-0 is merged before RPC-1 starts.

## Remaining phases

- **RPC-1:** upstream node/provider abstraction and capability discovery.
- **RPC-2:** Ethereum JSON-RPC compatibility and method profiles.
- **RPC-3:** routing, upstream health, circuit breaking and failover.
- **RPC-4:** chain identity, freshness and finality safety.
- **RPC-5:** request validation, method policy and privileged-method exclusion.
- **RPC-6:** rate limits, quotas, batch/resource bounds and abuse protection.
- **RPC-7:** WebSocket transport and subscription lifecycle.
- **RPC-8:** enriched/indexer-backed read APIs with explicit derived-state semantics.
- **RPC-9:** authentication, API credentials and Developer Hub integration.
- **RPC-10:** observability, health/readiness, metrics and operational recovery.
- **RPC-11:** hostile-state and security hardening.
- **RPC-12:** testnet qualification and launch closeout.

## Authority rule

420RPC may influence availability and routing but never determines canonical blocks, transaction validity, ownership, balances, protocol state, consensus, safe/finalized checkpoints or governance outcomes. Those remain owned by the chain and the relevant canonical contracts. 420Indexer-backed responses remain rebuildable derived views.
