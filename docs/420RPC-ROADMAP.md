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

### RPC-9 — authentication, API credentials and Developer Hub integration — complete
Delivered DEVHUB-16-compatible credential authentication, chain/environment/audience binding, RPC scope authorization, timing-safe bearer verification, terminal/expiry handling, bounded credential registry semantics and RPC-6 principal binding.

## RPC-10 — observability, health/readiness, metrics and operational recovery — implementation complete

Delivered:

- explicit separation between process liveness and request readiness;
- fresh chain/environment evidence requirements for canonical readiness;
- readiness dependence on at least one reachable, eligible, non-open-circuit, RPC-4-safe execution provider;
- fail-closed readiness on wrong chain, stale observations, process heartbeat loss, finality conflict or loss of canonical providers;
- independent derived-read readiness requiring a fresh ready 420Indexer provider;
- degraded operation when canonical ingress remains healthy but optional derived reads are unavailable;
- configurable recovery hysteresis requiring consecutive healthy observations before ingress reopens;
- fixed-name, low-cardinality operational counters with bounded sample budget;
- aggregate WebSocket, RPC-6 resource and RPC-9 credential telemetry without bearer secrets or principal identifiers;
- redacted operational snapshots carrying `canonicalAuthority: false`;
- hostile-state tests for stale/wrong-chain/finality-conflict/provider-loss/recovery cases;
- `docs/420RPC-OBSERVABILITY.md` and DEVHUB-17 compatibility guidance.

RPC-10 telemetry describes gateway operational state only. It cannot establish consensus, transaction validity, finality, settlement, ownership, Registry legitimacy, protocol authorization or fork choice.

Exit gate: implementation is complete. Merge requires the exact final head to pass 420RPC, docs and repository-wide qualification and remain reconciled with current `main`.

## Remaining phases

- **RPC-11:** hostile-state and security hardening across RPC-0 through RPC-10.
- **RPC-12:** testnet qualification and launch closeout.

## Authority rule

420RPC may authenticate and authorize off-chain service access, refuse unsafe traffic, expose clearly labeled derived projection data, and report bounded operational telemetry, but it never determines canonical blocks, transaction validity, consensus, safe/finalized checkpoints, fork choice, wallet authority, protocol identity or finality.
