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

### RPC-11 — hostile-state and security hardening — complete
Delivered cross-layer ingress ordering, bounded JSON structural inspection, prototype-pollution and envelope-smuggling rejection, authorization-before-admission, atomic batch scope enforcement and hostile-state qualification.

### RPC-12 — public testnet qualification and launch closeout — implementation complete

Delivered:

- an explicit testnet environment contract pinned to chain ID `420`, expected genesis, HTTPS/WSS public endpoints and named execution/Indexer providers;
- TLS-only public-origin validation with embedded-credential rejection;
- exact release identity requirements for 420RPC, `node420`, 420Indexer, descriptor manifest and compiled artifacts;
- a representative Ethereum JSON-RPC compatibility witness set spanning metadata, reads, logs, calls, estimation, fee history, raw transaction submission and subscriptions;
- fail-closed requirements for canonical and derived provider evidence plus RPC-10 traffic-admitting readiness;
- live deployment evidence flags for HTTP/WSS smoke, transaction submission, derived reads, auth, resource controls, safe failover, wrong-chain rejection, finality conflict, WebSocket upstream loss, recovery hysteresis and telemetry redaction;
- `buildRpc12CloseoutReport420`, which emits explicit `go` or `no-go` with blockers;
- closeout records that retain public origins rather than secret-bearing endpoint URLs and remain `authoritative: false` / `launchAuthority: false`;
- hostile/missing-evidence regression tests and `docs/420RPC-TESTNET-CLOSEOUT.md`.

A synthetic CI fixture can prove the closeout aggregator's logic. It is not live deployment evidence and does not by itself authorize a public testnet launch.

Exit gate: RPC-12 implementation is complete. Merge requires exact-head 420RPC, docs and repository-wide qualification plus reconciliation with current `main`.

## Roadmap closeout

With RPC-12 merged, the planned **RPC-0 through RPC-12 implementation roadmap is complete**. Remaining work belongs to deployment and broader genesis-infrastructure qualification: deploy the selected release candidate, collect live RPC-12 evidence, qualify the remaining infrastructure services, then make the separate public-testnet launch decision.

## Authority rule

420RPC may authenticate and authorize off-chain service access, reject hostile traffic, refuse unsafe upstreams, expose clearly labeled derived projection data, report bounded operational telemetry and aggregate deployment evidence, but it never determines canonical blocks, transaction validity, consensus, safe/finalized checkpoints, fork choice, wallet authority, protocol identity, governance approval or finality.
