# 420RPC implementation roadmap

420RPC is the public ingress, routing and policy layer for 420 Integrated. It fronts compatible execution RPC providers and selected derived read services without becoming protocol authority.

## Delivery rule

Each numbered RPC phase is developed, reconciled against current `main`, fully qualified, and merged to `main` before the next phase begins. This keeps the infrastructure stack incrementally deployable and prevents later phases from hiding unmerged architectural debt.

## RPC-0 — architecture and trust foundation — complete

Delivered the `420-rpc/` package, explicit architecture/service identity, execution-versus-derived upstream classes, chain-ID pinning, TLS public transport, Engine isolation, no key custody/signing/mutation, no gateway finality, fail-closed finalized disagreement, executable architecture tests, threat model and qualification workflow.

## RPC-1 — upstream node/provider abstraction and capability discovery — complete

Delivered normalized execution and Indexer provider descriptors, runtime capability discovery, chain binding, reachable-versus-eligible status and fail-closed provider qualification. RPC-1 was fully qualified and merged before RPC-2 began.

## RPC-2 — Ethereum JSON-RPC compatibility and method profiles — in progress

Deliverables:

- explicit public Ethereum JSON-RPC method catalogue;
- metadata, read, submit and subscription profiles;
- per-method transport requirements;
- per-method required upstream capabilities;
- explicit mutation and user-signature semantics;
- canonical wallet/dApp read methods for blocks, transactions, receipts, logs, state, calls and fee helpers;
- raw signed transaction submission via `eth_sendRawTransaction`;
- WebSocket subscription compatibility contract;
- fail-closed unknown-method behavior;
- exclusion of node-managed signing/account methods;
- exclusion of privileged Engine/admin/personal/debug/miner/txpool namespaces;
- intersection of method compatibility with RPC-1 provider discovery;
- deterministic profile and hostile-state tests;
- compatibility documentation for later routing and policy phases.

RPC-2 defines compatibility, not routing. RPC-3 owns provider selection/failover, RPC-4 owns freshness/finality safety, RPC-5 owns request-policy enforcement, and RPC-7 owns subscription lifecycle.

Exit gate: the 420RPC package builds, RPC-2 tests pass, docs qualification and repository-wide qualification are green, the branch is reconciled to current `main`, and RPC-2 is merged before RPC-3 begins.

## Remaining phases

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

420RPC may influence availability, compatibility and routing but never determines canonical blocks, transaction validity, ownership, balances, protocol state, consensus, safe/finalized checkpoints or governance outcomes. Those remain owned by the chain and the relevant canonical contracts. A public method profile is a gateway exposure decision, not protocol authority.
