# 420RPC implementation roadmap

420RPC is the public ingress, routing and policy layer for 420 Integrated. It fronts compatible execution RPC providers and selected derived read services without becoming protocol authority.

## Delivery rule

Each numbered RPC phase is developed, reconciled against current `main`, fully qualified, and merged to `main` before the next phase begins.

## Completed phases

### RPC-0 — architecture and trust foundation — complete

Delivered the `420-rpc/` package, service authority boundaries, chain-ID pinning, Engine isolation, non-custodial transaction rules, TLS public transport, threat model and qualification workflow.

### RPC-1 — upstream abstraction and capability discovery — complete

Delivered normalized execution and Indexer provider descriptors, runtime capability discovery, chain binding, reachable-versus-eligible status and fail-closed provider qualification.

### RPC-2 — Ethereum JSON-RPC compatibility and method profiles — complete

Delivered the explicit public Ethereum JSON-RPC method catalogue, metadata/read/submit/subscription profiles, capability requirements, raw signed transaction submission, WebSocket compatibility, and fail-closed exclusion of unknown, signing/account and privileged methods.

### RPC-3 — routing, upstream health, circuit breaking and failover — complete

Delivered deterministic method/transport-aware provider selection, gateway-local circuit breakers, read/metadata failover, no ambiguous signed-transaction replay, and fail-closed routing when no qualified healthy provider exists.

## RPC-4 — chain identity, freshness and finality safety — implementation complete

Delivered:

- per-provider chain observations containing chain ID, head, safe and finalized checkpoints plus observation time;
- strict chain ID 420 enforcement at the RPC-4 routing boundary;
- rejection of chain identity changes relative to RPC-1 discovery;
- checkpoint hash/height validation and impossible-order rejection;
- configurable observation freshness bounds;
- rejection of future-dated chain evidence;
- configurable maximum head lag from the freshest valid fleet head;
- required safe/finalized checkpoint presence under the default policy;
- fail-closed same-height safe checkpoint disagreement;
- fail-closed same-height finalized checkpoint disagreement;
- safety-filtered integration with RPC-3 routing;
- tests covering wrong-chain, identity-change, stale, lagged, impossible and conflicting provider states;
- operator documentation in `docs/420RPC-CHAIN-SAFETY.md`.

RPC-4 evaluates routing safety only. It does not establish a canonical fork or decide finality. Provider priority cannot break safe/finalized disagreement.

Exit gate: implementation is complete. Merge requires the exact final head to pass 420RPC, docs and repository-wide qualification and remain reconciled with current `main`.

## Remaining phases

- **RPC-5:** request validation, method policy and privileged-method exclusion.
- **RPC-6:** rate limits, quotas, batch/resource bounds and abuse protection.
- **RPC-7:** WebSocket transport and subscription lifecycle.
- **RPC-8:** enriched/indexer-backed read APIs with explicit derived-state semantics.
- **RPC-9:** authentication, API credentials and Developer Hub integration.
- **RPC-10:** observability, health/readiness, metrics and operational recovery.
- **RPC-11:** hostile-state and security hardening.
- **RPC-12:** testnet qualification and launch closeout.

## Authority rule

420RPC may reject stale, wrong-chain, internally impossible or conflicting upstream evidence, but it never determines canonical blocks, transaction validity, consensus, safe/finalized checkpoints or fork choice. If trustworthy upstream evidence is insufficient or conflicting, 420RPC fails closed rather than manufacturing authority.
