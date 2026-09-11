# 420RPC implementation roadmap

420RPC is the public ingress, routing and policy layer for 420 Integrated. It fronts compatible execution RPC providers and selected derived read services without becoming protocol authority.

## Delivery rule

Each numbered RPC phase is developed, reconciled against current `main`, fully qualified, and merged to `main` before the next phase begins. This keeps the infrastructure stack incrementally deployable and prevents later phases from hiding unmerged architectural debt.

## RPC-0 — architecture and trust foundation — complete

Delivered the `420-rpc/` package, explicit architecture/service identity, execution-versus-derived upstream classes, chain-ID pinning, TLS public transport, Engine isolation, no key custody/signing/mutation, no gateway finality, fail-closed finalized disagreement, executable architecture tests, threat model and qualification workflow.

RPC-0 was fully qualified and merged before RPC-1 began.

## RPC-1 — upstream node/provider abstraction and capability discovery — in progress

Deliverables:

- normalized upstream descriptors for execution RPC and 420Indexer providers;
- endpoint/transport validation and duplicate-ID rejection;
- expected chain-ID binding;
- enabled/priority provider metadata for later routing;
- transport-neutral execution JSON-RPC requester contract;
- transport-neutral 420Indexer metadata contract;
- execution capability discovery for chain identity, client version, head access, safe/finalized block tags, transaction-submission declaration and subscription transport;
- Indexer discovery for chain identity, service identity, readiness and explicit derived/non-authoritative semantics;
- reachable-versus-eligible distinction;
- fail-closed rejection of wrong-chain, disabled, unreachable or structurally invalid providers;
- eligible-provider filtering by upstream class;
- deterministic hostile-state qualification tests.

Exit gate: the 420RPC package builds, RPC-1 tests pass, docs qualification and repository-wide qualification are green, the branch is reconciled to current `main`, and RPC-1 is merged before RPC-2 begins.

## Remaining phases

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

420RPC may influence availability and routing but never determines canonical blocks, transaction validity, ownership, balances, protocol state, consensus, safe/finalized checkpoints or governance outcomes. Those remain owned by the chain and the relevant canonical contracts. 420Indexer-backed responses remain rebuildable derived views. Capability discovery only determines gateway eligibility; it cannot confer chain authority.
