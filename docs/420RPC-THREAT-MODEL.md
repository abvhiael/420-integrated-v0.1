# 420RPC RPC-0 threat model

420RPC is exposed to untrusted network clients and must assume hostile requests, hostile or misconfigured upstreams, partial outages, replayed traffic, and attempts to cross trust boundaries. RPC-0 fixes the authority model before transport implementation begins.

## Protected assets

420RPC must protect network identity, canonical execution semantics, signed transaction bytes, public/private trust boundaries, upstream credentials, availability, and the distinction between canonical execution data and derived 420Indexer data.

420RPC does not own validator keys, Wallet signing keys, consensus fork choice, canonical contract state, governance authority or Engine JWT authority.

## Trust boundaries

### Public client boundary

HTTP(S) and WebSocket clients are untrusted. Later phases must bound request size, batch size, method access, concurrency, subscriptions, historical ranges and execution time.

### Execution upstream boundary

`node420` execution RPC is the source for canonical execution reads and transaction submission. Every upstream must prove the expected chain identity before becoming routable.

### 420Indexer boundary

420Indexer provides derived, rebuildable projections. Its responses may improve search/history ergonomics but must never be relabeled as canonical execution or finality authority.

### Engine boundary

The authenticated Engine API between `fourtwentyd` and `node420` is outside the 420RPC public routing graph. Engine endpoints, methods and JWT credentials must never be accepted as public upstream capability.

## Primary threats

- wrong-chain upstream substitution;
- DNS/provider compromise that returns a different chain;
- Engine/admin/debug namespace exposure;
- mutation of signed transaction bytes;
- gateway-side custody or signing of user transactions;
- fabricated receipts or finality labels;
- stale or divergent upstreams presented as healthy;
- finalized-state disagreement hidden by load balancing;
- derived Indexer data presented as canonical state;
- request amplification and resource-exhaustion attacks;
- cache poisoning or caching mutable head-state without freshness semantics;
- credential leakage between public API keys, Engine JWT, Wallet keys or operator secrets;
- failover across testnet/mainnet or incompatible service versions;
- availability pressure causing the gateway to fail open.

## RPC-0 mitigations

The executable architecture contract requires chain ID 420, TLS-protected public transport declarations, at least one canonical execution upstream, non-authoritative Indexer classification, no Engine exposure, no Wallet-key storage, no transaction signing, no signed-byte rewriting, no gateway-owned finality, and fail-closed finalized disagreement.

These are architecture invariants rather than optional deployment preferences. Later RPC phases may add capabilities only if these boundaries remain true.

## Failure principle

When 420RPC cannot prove that an upstream is compatible with the intended network or cannot safely distinguish canonical/finalized state, the correct behavior is to reject or degrade the affected request. Availability does not justify inventing chain truth.
