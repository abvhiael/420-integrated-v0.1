# 420RPC

420RPC is the public RPC gateway and routing layer for 420 Integrated. It sits in front of canonical `node420` execution RPC and, where appropriate, the non-authoritative 420Indexer API. It improves reliability, policy enforcement and developer ergonomics without gaining consensus, execution, signing or finality authority.

## Phase workflow

Each RPC phase is developed on its own branch and pull request. At the end of every phase, the branch is reconciled with current `main`, qualification is rerun, and the phase is merged to `main` before work begins on the next RPC phase.

## Completed implementation phases

- **RPC-0:** architecture, authority boundaries, threat model, package layout and qualification contract.
- **RPC-1:** explicit upstream abstraction and capability discovery.
- **RPC-2:** Ethereum JSON-RPC compatibility and method profiles.
- **RPC-3:** deterministic routing, circuit breaking and safe failover.
- **RPC-4:** chain identity, freshness and finality safety.
- **RPC-5:** request validation and privileged-surface enforcement.
- **RPC-6:** weighted quotas, batch/resource bounds and concurrency controls.
- **RPC-7:** WebSocket session and subscription lifecycle.
- **RPC-8:** explicit non-authoritative 420Indexer-derived reads.
- **RPC-9:** authentication, API credentials and Developer Hub integration.
- **RPC-10:** observability, readiness, metrics and operational recovery.
- **RPC-11:** hostile-state and cross-layer security hardening.
- **RPC-12 — implementation complete:** public testnet qualification and launch closeout contract.

## RPC-12 — testnet qualification and closeout

RPC-12 adds a fail-closed release-candidate evidence aggregator for deployed public-testnet candidates. It pins chain ID `420`, expected genesis, HTTPS/WSS public origins, canonical execution-provider identities and 420Indexer-provider identities.

A candidate can emit `go` only when exact RPC/node/indexer revisions and artifact digests are present, RPC-10 readiness is traffic-admitting, canonical and derived providers are witnessed, the representative Ethereum compatibility surface is exercised, and live smoke/failure/recovery evidence covers HTTP, WSS, raw transaction submission, derived reads, auth, resource controls, safe failover, wrong-chain rejection, finality conflict, WebSocket upstream loss, readiness recovery and telemetry redaction.

CI contains a synthetic passing fixture to prove the closeout logic. That fixture does **not** claim a live testnet has already been deployed. Real public-testnet launch evidence must still be collected against the deployed release candidate.

### RPC-12 authority boundary

The closeout report is operator evidence only. It is always `authoritative: false` and `launchAuthority: false`. 420RPC still cannot establish consensus, finality, transaction validity, fork choice, wallet authority, Registry legitimacy or governance approval.

## Roadmap status

**RPC-0 through RPC-12 implementation is complete.**

The next ecosystem step is not another 420RPC implementation phase. It is deployment/infrastructure qualification alongside the remaining genesis infrastructure, followed by public testnet deployment and live evidence collection.

## Core invariants

1. 420RPC never becomes consensus or execution authority.
2. Engine API methods and credentials never cross the public gateway boundary.
3. Wrong-chain upstreams are rejected, not routed.
4. Safe/finalized disagreement fails closed.
5. Signed transaction bytes are never semantically rewritten.
6. 420RPC never stores Wallet signing keys or signs user transactions.
7. 420Indexer-backed data remains visibly non-authoritative and derived.
8. Unknown, privileged or malformed requests are rejected locally.
9. Batches cannot bypass quotas, authorization or concurrency limits.
10. Upstream subscription loss requires resubscription rather than silent migration.
11. Authentication never overrides RPC-5 method exclusions.
12. Process liveness never implies canonical readiness.
13. Telemetry never exposes bearer material or principal identifiers.
14. Malformed structure and authorization failures occur before stateful RPC-6 admission.
15. Prototype-pollution object keys and envelope-smuggling keys fail closed.
16. Public HTTP and WebSocket endpoints require TLS for launch qualification.
17. RPC-12 cannot emit `go` with missing release identity, chain/genesis mismatch, missing compatibility witnesses or unproven failure/recovery drills.
18. RPC-12 closeout never becomes launch or protocol authority.
