# 420RPC implementation roadmap

420RPC is the public ingress, routing and policy layer for 420 Integrated. It fronts compatible execution RPC providers and selected derived read services without becoming protocol authority.

## Delivery rule

Each numbered RPC phase is developed, reconciled against current `main`, fully qualified, and merged to `main` before the next phase begins.

## Completed phases

### RPC-0 — architecture and trust foundation — complete
Delivered package structure, authority boundaries, chain-ID pinning, Engine isolation, non-custodial transaction rules, TLS public transport, threat model and qualification workflow.

### RPC-1 — upstream abstraction and capability discovery — complete
Delivered normalized execution/Indexer descriptors, runtime capability discovery, chain binding and fail-closed provider qualification.

### RPC-2 — Ethereum JSON-RPC compatibility and method profiles — complete
Delivered explicit public method catalogue, method profiles, capability requirements and privileged/unknown-method exclusion.

### RPC-3 — routing, health, circuit breaking and failover — complete
Delivered deterministic provider selection, circuit breakers, safe read failover and no ambiguous signed-transaction replay.

### RPC-4 — chain identity, freshness and finality safety — complete
Delivered chain observations, freshness/head-lag bounds and fail-closed safe/finalized disagreement handling.

### RPC-5 — request validation and privileged-surface enforcement — complete
Delivered JSON-RPC envelope/parameter validation and local rejection of malformed, unknown or privileged requests.

### RPC-6 — resource controls — complete
Delivered weighted admission, token buckets, batch/byte/cost bounds, concurrency leases and bounded client accounting.

### RPC-7 — WebSocket lifecycle — complete
Delivered bounded sessions, subscription ownership/upstream binding, heartbeat cleanup, backpressure limits and explicit resubscription after upstream loss.

### RPC-8 — 420Indexer-derived reads — complete
Delivered an explicit non-authoritative derived-read surface with provider eligibility, chain/freshness checks, route validation and provenance envelopes.

### RPC-9 — authentication and Developer Hub integration — complete
Delivered DEVHUB-16-compatible credentials, strict audience/chain/environment binding, scoped authorization and stable RPC-6 client identities.

### RPC-10 — observability and operational recovery — complete
Delivered liveness/readiness separation, fail-closed canonical readiness, independent derived-read health, recovery hysteresis, bounded metrics and redacted operational snapshots.

## RPC-11 — hostile-state and security hardening — implementation complete

Delivered:

- a cross-layer ingress security gate spanning RPC-5, RPC-9 and RPC-6;
- bounded JSON depth, total node count, aggregate string/key bytes and object-key count;
- fail-closed handling for non-finite/non-JSON values;
- rejection of prototype-pollution keys before downstream JavaScript processing;
- rejection of unexpected top-level JSON-RPC envelope keys;
- proof that structural and authorization failures occur before RPC-6 state/quota mutation;
- atomic mixed-scope batch authorization;
- proof that `rpc:admin` cannot bypass Engine/admin/debug/signing exclusions;
- authenticated client-key binding through successful admission and lease release;
- preservation of RPC-6 resource rejection semantics through the security gate;
- hostile-state regression coverage and `docs/420RPC-SECURITY-HARDENING.md`.

RPC-11 is a gateway defense layer only. It cannot establish consensus, finality, transaction validity, ownership, Registry legitimacy, wallet authority, governance state or fork choice.

Exit gate: implementation is complete. Merge requires exact-head 420RPC, docs and repository-wide qualification plus reconciliation with current `main`.

## Remaining phase

- **RPC-12:** public testnet qualification and 420RPC launch closeout.

## Authority rule

420RPC may authenticate and authorize off-chain service access, reject hostile traffic, refuse unsafe upstreams, expose clearly labeled derived projection data and report bounded operational telemetry, but it never determines canonical blocks, transaction validity, consensus, safe/finalized checkpoints, fork choice, wallet authority, protocol identity or finality.
