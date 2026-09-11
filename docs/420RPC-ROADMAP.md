# 420RPC implementation roadmap

420RPC is the public ingress, routing and policy layer for 420 Integrated. It fronts compatible execution RPC providers and selected derived read services without becoming protocol authority.

## Delivery rule

Each numbered RPC phase is developed, reconciled against current `main`, fully qualified, and merged to `main` before the next phase begins. This keeps the infrastructure stack incrementally deployable and prevents later phases from hiding unmerged architectural debt.

## RPC-0 — architecture and trust foundation — complete

Delivered the `420-rpc/` package, explicit architecture/service identity, execution-versus-derived upstream classes, chain-ID pinning, TLS public transport, Engine isolation, no key custody/signing/mutation, no gateway finality, fail-closed finalized disagreement, executable architecture tests, threat model and qualification workflow.

## RPC-1 — upstream node/provider abstraction and capability discovery — complete

Delivered normalized execution and Indexer provider descriptors, runtime capability discovery, chain binding, reachable-versus-eligible status and fail-closed provider qualification.

## RPC-2 — Ethereum JSON-RPC compatibility and method profiles — complete

Delivered the explicit public Ethereum JSON-RPC method catalogue, metadata/read/submit/subscription profiles, per-method capability requirements, raw signed transaction submission, WebSocket compatibility, and fail-closed exclusion of unknown, signing/account and privileged methods.

## RPC-3 — routing, upstream health, circuit breaking and failover — implementation complete

Delivered:

- deterministic provider composition from RPC-1 descriptor/discovery evidence plus gateway-local health state;
- fail-closed descriptor/discovery/health identity validation;
- RPC-2 method-aware candidate filtering;
- HTTP(S) versus WebSocket transport-aware provider selection;
- deterministic candidate ordering by circuit state, configured priority and provider ID;
- independent closed/open/half-open circuit breakers;
- positive-integer failure-threshold and cooldown validation;
- threshold-based circuit opening and cooldown-based half-open probing;
- success recovery and immediate half-open failure reopening;
- read/metadata failover to the next prequalified candidate;
- no automatic cross-provider replay for `eth_sendRawTransaction` after ambiguous dispatch;
- no transparent established-subscription failover before RPC-7 owns subscription lifecycle;
- hostile-state tests covering ineligible providers, missing capabilities, open circuits, transport mismatch, identity mismatch and unsupported methods;
- operator-facing routing/failover documentation.

RPC-3 owns provider selection and availability behavior only. RPC-4 will add chain freshness and finality-safety constraints; RPC-5 adds request policy; RPC-7 owns subscription lifecycle.

Exit gate: implementation is complete. Merge requires the exact final head to pass 420RPC, docs and repository-wide qualification and remain reconciled with current `main`.

## Remaining phases

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

420RPC may influence availability, compatibility and routing but never determines canonical blocks, transaction validity, ownership, balances, protocol state, consensus, safe/finalized checkpoints or governance outcomes. Circuit state is local gateway operational state, not chain state. If every eligible provider is unhealthy, unavailable or unsafe, 420RPC fails closed rather than manufacturing authority or routing to an invalid provider.
