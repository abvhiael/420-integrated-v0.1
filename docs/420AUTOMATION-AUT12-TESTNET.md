# 420Automation AUT-12 — public testnet qualification and launch closeout

AUT-12 is the final planned 420Automation implementation phase. It defines the evidence required to call a deployed Automation release candidate suitable for public-testnet use without changing Automation's authority boundary.

## Important distinction

AUT-12 code and CI can prove that the closeout contract is internally consistent and fails closed when evidence is absent or contradictory. They cannot manufacture live deployment evidence.

A synthetic fixture that produces `decision: "go"` proves the aggregator logic only. It does not authorize public-testnet launch and does not prove that any deployed worker, job, trigger, RPC path or Oracle path actually operated correctly.

## Environment contract

The candidate must pin:

- chain ID `420`;
- environment `testnet`;
- the exact expected 32-byte genesis hash;
- a public HTTPS Automation service endpoint;
- one or more explicitly named 420RPC providers;
- one or more explicitly named 420Oracle providers.

The public Automation endpoint must use TLS and must not embed credentials. Closeout records retain the origin only, not secret-bearing URLs.

## Required release identity

A closeout candidate must provide exact identifiers for:

- the 420Automation revision;
- the `node420` revision/release;
- the 420RPC revision/release;
- the 420Oracle revision/release;
- the descriptor-manifest digest;
- the compiled-artifacts digest.

Missing or malformed release identity is a `no-go` blocker.

## Live service evidence

The deployed candidate must prove all of the following against the pinned testnet identity:

- observed chain ID equals `420`;
- observed genesis hash equals the configured testnet genesis;
- Automation readiness is traffic-admitting;
- the scheduler is ready;
- at least one live AUT-7 worker is present;
- at least one registered Automation job is present.

A process merely being alive is insufficient.

## Trigger compatibility witnesses

AUT-12 requires a deployed compatibility witness for every supported trigger class:

- time;
- block;
- event;
- Oracle;
- manual.

The witness proves only that the deployed release can recognize and process the trigger path under the normal AUT-1 through AUT-11 boundaries. It does not grant the trigger execution authority.

## Cross-service compatibility

The candidate must retain successful compatibility evidence for:

1. the authenticated Automation API;
2. 420RPC chain/read/submission integration;
3. 420Oracle automation-feed integration;
4. Developer Hub scoped service credentials.

Compatibility evidence must preserve the existing authority split. In particular, RPC, Oracle and Developer Hub service identity cannot create a job, alter an immutable execution envelope, create canonical truth or bypass target-protocol authorization.

## Required live execution and failure drills

The deployed release candidate must retain evidence that all of the following passed:

1. live registered-job execution by a qualified worker;
2. worker lease failover without concurrent ownership;
3. replay suppression for an already-consumed occurrence;
4. ambiguous-submission recovery without speculative replay;
5. wrong-chain rejection;
6. finalized-chain conflict fail-closed behavior;
7. hostile/spoofed observation rejection;
8. resource/quota abuse rejection;
9. credential/scope isolation;
10. readiness failure and hysteresis-based recovery;
11. telemetry and diagnostic secret redaction.

A happy-path execution alone is insufficient for closeout.

## Closeout report

`buildAutomation12CloseoutReport420` aggregates the pinned environment and deployment evidence. Any missing, malformed or contradictory evidence produces `decision: "no-go"` plus explicit blockers. Only a blocker-free evidence set produces `decision: "go"`.

Every report remains explicitly:

- `authoritative: false`
- `launchAuthority: false`

The report is release evidence for operators. It does not determine consensus, canonical chain state, finality, Oracle truth, transaction validity, wallet authority, Registry legitimacy, governance approval or whether the broader 420 Integrated public testnet is authorized to launch.

## Evidence retention checklist

For an actual public-testnet candidate, retain outside secret-bearing logs:

- exact Automation/node/RPC/Oracle revisions;
- chain ID and genesis hash;
- public Automation origin;
- named RPC and Oracle providers;
- live worker count and registered-job count;
- all five trigger-class compatibility witnesses;
- authenticated API, RPC, Oracle and Developer Hub compatibility results;
- sanitized live-job execution witness;
- lease failover result;
- replay-suppression result;
- ambiguous-submission recovery result;
- wrong-chain and finality-conflict injected-failure results;
- hostile-observation and resource-abuse results;
- auth/scope isolation result;
- readiness failure/recovery sequence;
- telemetry-redaction result;
- descriptor-manifest and compiled-artifact digests;
- final `go`/`no-go` report and blockers.

Never commit bearer credentials, Wallet/user keys, worker private keys, raw secret-bearing provider payloads, secret-bearing endpoints or other authentication material.
