# 420RPC RPC-12 — public testnet qualification and launch closeout

RPC-12 is the final planned 420RPC implementation phase. It defines the evidence required to call a deployed 420RPC release candidate suitable for public testnet traffic without changing the gateway's authority boundary.

## Important distinction

The RPC-12 code and CI suite can prove that the qualification contract is internally consistent and fail closed when evidence is missing. They cannot manufacture live deployment evidence. A synthetic CI fixture returning `decision: "go"` proves the aggregator logic only; it is not itself authorization to launch a public testnet endpoint.

## Environment contract

The candidate must pin:

- chain ID `420`;
- environment `testnet`;
- the exact expected 32-byte genesis hash;
- a public HTTPS JSON-RPC endpoint;
- a public WSS endpoint;
- one or more explicitly named canonical execution providers;
- one or more explicitly named 420Indexer providers.

Public endpoints must use TLS and must not embed username/password credentials. Closeout records retain origins only, not secret-bearing URLs.

## Required release identity

A closeout candidate must provide exact identifiers for:

- the 420RPC revision;
- the `node420` revision/release;
- the 420Indexer revision/release;
- the descriptor-manifest digest;
- the compiled-artifacts digest.

Missing or malformed release identity is a `no-go` blocker.

## Live compatibility witnesses

RPC-12 requires deployed evidence for the core public surface:

- `web3_clientVersion`
- `eth_chainId`
- `eth_blockNumber`
- `eth_getBlockByNumber`
- `eth_getBalance`
- `eth_getLogs`
- `eth_call`
- `eth_estimateGas`
- `eth_feeHistory`
- `eth_sendRawTransaction`
- `eth_subscribe`
- `eth_unsubscribe`

This is a representative launch witness set, not a replacement for the RPC-2 method catalogue.

## Required deployment checks

The deployed release candidate must retain evidence that all of the following passed:

1. HTTPS JSON-RPC smoke.
2. WSS connection/subscription smoke.
3. Signed raw-transaction submission smoke without byte rewriting.
4. 420Indexer-derived read smoke with non-authoritative provenance.
5. RPC-9 credential and scope enforcement smoke.
6. RPC-6 rate/resource-limit smoke.
7. Safe read failover drill.
8. Wrong-chain upstream rejection drill.
9. Finality-conflict fail-closed drill.
10. WebSocket upstream-loss invalidation/resubscription drill.
11. Readiness recovery/hysteresis drill.
12. Telemetry-redaction verification.

The candidate must also be traffic-admitting under RPC-10 readiness with at least one qualified canonical execution provider and at least one qualified derived/indexer provider.

## Closeout report

`buildRpc12CloseoutReport420` aggregates the pinned environment and deployment evidence. Any missing, malformed or contradictory evidence produces `decision: "no-go"` and explicit blockers. Only a blocker-free evidence set produces `decision: "go"`.

Every report remains explicitly:

- `authoritative: false`
- `launchAuthority: false`

The report is release evidence for operators. It does not determine consensus, finality, fork choice, transaction validity, wallet authority, Registry legitimacy, governance approval or whether the broader 420 Integrated public testnet is authorized to launch.

## Evidence retention checklist

For an actual public-testnet candidate, retain outside secret-bearing logs:

- exact RPC/node/indexer revisions;
- chain ID and genesis hash;
- public HTTPS/WSS origins;
- canonical and derived provider identities/counts;
- exact compatibility-method witness results;
- raw-transaction submission transaction hash or sanitized witness identifier;
- subscription witness and upstream-loss recovery result;
- wrong-chain and finality-conflict injected-failure results;
- auth/scope and resource-control results;
- readiness failure/recovery sequence;
- telemetry-redaction result;
- descriptor-manifest and compiled-artifact digests;
- final `go`/`no-go` report and blockers.

Never commit bearer credentials, Wallet keys, raw private subscription payloads, secret-bearing endpoints or other authentication material.
