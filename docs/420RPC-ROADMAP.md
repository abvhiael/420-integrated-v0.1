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

## RPC-9 — authentication, API credentials and Developer Hub integration — implementation complete

Delivered:

- compatibility with the DEVHUB-16 credential-record lifecycle contract;
- strict `420rpc` audience and chain/environment binding;
- scopes `rpc:read`, `rpc:submit`, `rpc:subscribe`, `rpc:derived` and service-local `rpc:admin`;
- strict Bearer parsing and local SHA-256 digest verification with timing-safe comparison;
- no persistence of raw bearer secret material in the RPC credential registry;
- fail-closed handling for wrong-chain, wrong-environment, wrong-audience, terminal, expired and not-yet-active credentials;
- bounded credential registry capacity and revision/application-binding checks;
- stable authenticated principals and `credential:<credentialId>` client keys for RPC-6 accounting;
- explicit policy-controlled anonymous scopes, defaulting to read-only testnet access;
- method-profile authorization and separate RPC-8 derived-read authorization;
- proof that even `rpc:admin` cannot bypass RPC-5 privileged/unknown-method exclusions;
- hostile-state tests and `docs/420RPC-AUTH.md`.

RPC-9 credentials authenticate off-chain 420RPC service access only. They do not create 420 Identity credentials, wallet signing rights, Registry legitimacy, governance/protocol roles, transaction validity or chain authority.

Exit gate: implementation is complete. Merge requires the exact final head to pass 420RPC, docs and repository-wide qualification and remain reconciled with current `main`.

## Remaining phases

- **RPC-10:** observability, health/readiness, metrics and operational recovery.
- **RPC-11:** hostile-state and security hardening.
- **RPC-12:** testnet qualification and launch closeout.

## Authority rule

420RPC may authenticate and authorize off-chain service access, refuse unsafe traffic, and expose clearly labeled derived projection data, but it never determines canonical blocks, transaction validity, consensus, safe/finalized checkpoints, fork choice, wallet authority or protocol identity.
