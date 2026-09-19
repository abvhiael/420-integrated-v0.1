# 420 Bundler Network — GEN-11 Roadmap

The 420 Bundler Network is the provider-neutral transaction-submission layer for smart-account UserOperations. It accepts signed operations, validates and simulates them, maintains a bounded mempool, constructs bundles for the configured EntryPoint, submits those bundles through execution RPC, and exposes lifecycle/receipt information to 420Wallet and compatible third-party clients.

The Bundler Network is not custody, wallet authorization, consensus, settlement or finality authority. EntryPoint and smart-account validation remain authoritative. A bundler may delay or refuse relay, but it cannot manufacture authorization or prevent a user from selecting another compatible operator.

## GEN-11 status

- **GEN-11.0 — architecture + executable invariant baseline — COMPLETE**
- **GEN-11.1 — core bundler runtime/service scaffold — COMPLETE**
- **GEN-11.2 — canonical UserOperation model + hashing — COMPLETE**
- **GEN-11.3 — public Bundler RPC API — COMPLETE**
- **GEN-11.4 — deterministic validation + simulation engine — COMPLETE**
- **GEN-11.5 — bounded UserOperation mempool — COMPLETE**
- **GEN-11.6 — bundle construction + EntryPoint submission — COMPLETE**
- **GEN-11.7 — gas + fee estimation — COMPLETE**
- **GEN-11.8 — Paymaster integration boundary — COMPLETE**
- **GEN-11.9 — receipts + lifecycle tracking — COMPLETE**
- **GEN-11.10 — multi-bundler propagation — COMPLETE**
- **GEN-11.11 — reputation + anti-abuse controls — COMPLETE**
- **GEN-11.12 — replacement + nonce hardening — COMPLETE**
- **GEN-11.13 — failure isolation + reorg/restart recovery — IN QUALIFICATION**
- GEN-11.14 — persistence + audit trail — pending
- GEN-11.15 — 420Wallet integration + provider fallback — pending
- GEN-11.16 — 420Status + observability integration — pending
- GEN-11.17 — security hardening + hostile dependency isolation — pending
- GEN-11.18 — Genesis ordering/economic policy boundary — pending
- GEN-11.19 — cross-client/operator compatibility — pending
- GEN-11.20 — adversarial qualification, reconciliation + closeout — pending

## GEN-11.0 — architecture + executable invariant baseline

Freeze service identity `420/service/bundler/v1`, define the non-custodial/non-authoritative relay boundary, pin UserOperation identity to chain + EntryPoint + sender + nonce + operation hash, and encode the Genesis invariants in Go tests plus machine-readable configuration.

### Genesis invariants

- **BUNDLER-INV-001** — a bundler is non-custodial and stores no wallet private key, recovery secret or signing authority.
- **BUNDLER-INV-002** — smart-account and EntryPoint validation remain authoritative for UserOperation authorization; bundlers cannot forge or override authorization.
- **BUNDLER-INV-003** — bundlers cannot determine canonical execution, settlement or finality; inclusion/finality must be derived from canonical chain evidence.
- **BUNDLER-INV-004** — every admitted UserOperation is bound to an explicit chain identity and configured EntryPoint.
- **BUNDLER-INV-005** — every admitted operation must pass local validation/simulation against sufficiently current chain state; peer propagation never bypasses local admission.
- **BUNDLER-INV-006** — stale or invalidated simulation evidence cannot remain silently eligible for bundling.
- **BUNDLER-INV-007** — sender/nonce conflicts, duplicate operations and replacements follow deterministic rules and cannot produce ambiguous local admission state.
- **BUNDLER-INV-008** — failed validation, failed simulation or failed submission cannot consume account nonce or mutate canonical smart-account state.
- **BUNDLER-INV-009** — Paymaster sponsorship authority remains with the Paymaster/account-abstraction validation path; bundlers do not grant sponsorship.
- **BUNDLER-INV-010** — one bundler/operator failing cannot block canonical protocol interaction or prevent a wallet from selecting another compatible bundler.
- **BUNDLER-INV-011** — alternative bundler clients/operators are permitted; 420Wallet must not depend on one monopoly relay implementation.
- **BUNDLER-INV-012** — operation lifecycle states are operational evidence only and cannot claim inclusion/finality without matching canonical chain evidence.
- **BUNDLER-INV-013** — restart/recovery cannot fabricate admission, inclusion, receipt or finality; persistent state must be reconstructable against chain evidence.
- **BUNDLER-INV-014** — public health/metrics exported to 420Status remain explicitly noncanonical and cannot authorize or invalidate UserOperations.
- **BUNDLER-INV-015** — peer/operator inputs, RPC dependencies and revert/error payloads are treated as untrusted and bounded.
- **BUNDLER-INV-016** — Genesis ordering and prioritization behavior must be documented and auditable; hidden preferential ordering is outside the Genesis contract.

## Phase acceptance

GEN-11.0 is complete when the service boundary, invariant catalogue, UserOperation identity requirements, provider-neutrality requirements and machine-readable Genesis configuration are committed and the repository qualification workflows pass on the exact branch head.

GEN-11.0 is fully qualified on exact head `d9853d5d0d1f13950d47e8e8cfe1262a4e32929d` with 420 Integrated Qualification #4138, 420Docs Qualification #1848 and Solidity Contracts #2608 all passing.

## GEN-11.1 — core bundler runtime/service scaffold

Implemented the first production runtime under `bundler/runtime` and entrypoint `bundler/cmd/bundler420`.

The runtime is configured with an explicit chain ID, execution-RPC endpoint and EntryPoint address. Startup qualification fails closed unless the execution dependency reports the configured chain, deployed bytecode exists at the configured EntryPoint and the latest block timestamp is sufficiently recent. A process can therefore be live while still refusing readiness when it is connected to the wrong network, an undeployed/misconfigured EntryPoint, a stale execution endpoint or an unavailable dependency.

Public runtime probes expose only `/healthz` and `/readyz` at this phase. Both identify the service as noncanonical; health explicitly reports that the Bundler is non-custodial and has no wallet-authorization authority. Readiness records the qualified chain, EntryPoint and observed execution-head time but does not claim inclusion or finality.

The execution probe uses bounded JSON-RPC responses and supports `eth_chainId`, `eth_getCode` and `eth_getBlockByNumber` for startup qualification. Configuration reuses the repository's hardened public-target validation boundary so unsafe literal loopback/private RPC targets fail closed. Graceful SIGINT/SIGTERM shutdown and bounded HTTP server timeouts are wired into the production command.

Required environment:

- `BUNDLER_CHAIN_ID`
- `BUNDLER_EXECUTION_RPC`
- `BUNDLER_ENTRY_POINT`

Optional environment:

- `BUNDLER_LISTEN_ADDR` (default `:8423`)
- `BUNDLER_REQUEST_TIMEOUT` (default `5s`)
- `BUNDLER_MAX_HEAD_AGE` (default `2m`)

GEN-11.1 is complete when all repository qualification workflows pass on one exact head containing this runtime scaffold.


## GEN-11.2 — canonical UserOperation model + hashing

Added `bundler/userop` as the canonical Bundler-side representation of `PackedUserOperation420`.

The model mirrors `IEntryPoint420.sol` and the Wallet RPC envelope exactly:

- `sender`
- `nonce`
- `initCode`
- `callData`
- `accountGasLimits`
- `preVerificationGas`
- `gasFees`
- `paymasterAndData`
- `signature`

RPC quantities are parsed fail-closed as canonical 0x-prefixed uint256 values. Addresses, bytes32 fields and dynamic byte fields are length/hex validated before admission.

`Hash()` mirrors `EntryPoint420.getUserOpHash()`: it binds `USER_OPERATION_DOMAIN = keccak256("420/ENTRY_POINT/USER_OPERATION/V1")`, chain ID, EntryPoint, sender, nonce, keccak256(initCode), keccak256(callData), account gas limits, pre-verification gas, gas fees and keccak256(paymasterAndData) using Solidity `abi.encode` word layout. Signature bytes are intentionally excluded because the account signs the resulting canonical hash.

The package includes an internal legacy Keccak-256 implementation with the standard empty-input test vector so canonical hashing does not introduce a new runtime dependency. Tests also prove that every hash-bound field, chain identity and EntryPoint mutation changes the digest, while signature mutation does not.

GEN-11.2 is complete when all repository qualification workflows pass on one exact head containing this model and hash implementation.


## GEN-11.3 — public Bundler RPC API

Added the public JSON-RPC 2.0 boundary in `bundler/rpcapi` and mounted it on the production Bundler service root while preserving `/healthz` and `/readyz`.

Genesis RPC vocabulary established in this phase:

- `eth_supportedEntryPoints`
- `eth_sendUserOperation`
- `eth_getUserOperationReceipt`
- `eth_estimateUserOperationGas`

Requests are POST-only, bounded to 1 MiB, require JSON-RPC 2.0 envelopes, scalar request IDs, strict method names and method-specific parameter shapes. UserOperation payloads pass through the GEN-11.2 canonical parser before reaching any backend. EntryPoint addresses and UserOperation hashes are validated and normalized at the API boundary.

The API returns standard JSON-RPC parse/request/method/parameter/internal error codes and supports Bundler-specific backend errors without leaking arbitrary dependency failures. Unknown receipts can be represented as an explicit successful `result: null`.

GEN-11.3 intentionally does not fabricate later-phase behavior. The production boundary backend exposes the configured EntryPoint immediately, while admission returns `-32500` until the validation/mempool path exists, gas estimation returns `-32504` until GEN-11.7, and receipt tracking returns `-32505` until GEN-11.9. Later phases replace those backend methods without changing the public transport contract.

GEN-11.3 is complete when all repository qualification workflows pass on one exact head containing this RPC boundary.


## GEN-11.4 — deterministic validation + simulation engine

Added `bundler/simulation` and wired it into the production `eth_sendUserOperation` boundary ahead of GEN-11.5 mempool admission.

The engine first re-validates the GEN-11.2 canonical UserOperation and derives the exact local `EntryPoint420.getUserOpHash()` equivalent. It then simulates the canonical `handleOp(PackedUserOperation420)` call using the same selector and ABI tuple layout already used by 420Wallet.

Simulation is pinned to immutable execution evidence rather than a moving `latest` reference: the simulator reads the current execution block number/hash/timestamp, then performs `eth_call` against that exact block tag. Successful evidence records chain ID, EntryPoint, UserOperation hash, block number, block hash and observed block time. Missing, stale, future-dated or malformed snapshot evidence fails closed.

A reverted `eth_call`, malformed `handleOp` result, or a valid simulation whose returned execution-success flag is false rejects the operation. Simulation does not mutate canonical chain state and its evidence is explicitly admission evidence rather than finality evidence.

The public RPC boundary now runs this validation/simulation gate before any future admission. A failed simulation returns Bundler error `-32502`. A successful simulation still returns `-32500` because GEN-11.5 mempool admission is not yet implemented; GEN-11.4 deliberately cannot pretend an operation was accepted.

GEN-11.4 is complete when all repository qualification workflows pass on one exact head containing the deterministic simulator and production RPC gate.


## GEN-11.5 — bounded UserOperation mempool

Added `bundler/mempool` and wired successful GEN-11.4 validation/simulation into actual local admission.

The Genesis mempool is explicitly bounded and in-memory:

- total operation capacity defaults to `4096`
- per-sender capacity defaults to `16`
- operation TTL defaults to `10m`
- expired entries are pruned before admission, lookup and snapshot operations

Runtime overrides:

- `BUNDLER_MEMPOOL_MAX_OPERATIONS`
- `BUNDLER_MEMPOOL_MAX_PER_SENDER`
- `BUNDLER_MEMPOOL_TTL`

Every admitted entry retains the exact `PackedUserOperation420`, canonical UserOperation hash, GEN-11.4 simulation evidence, admission time and expiry time. Admission independently recomputes the canonical hash from the evidence chain ID + EntryPoint + operation and rejects mismatched evidence.

Duplicate submission of the exact same UserOperation hash is idempotent and does not consume additional capacity. A different hash using an already-admitted sender+nonce is rejected deterministically with Bundler error `-32503`; GEN-11.5 does not perform fee-based replacement because replacement/nonce hardening is reserved for GEN-11.12. Capacity exhaustion or sender quota exhaustion maps to `-32506`.

Snapshots are deterministic: admission time is primary ordering and canonical hash is the tie-breaker. This gives GEN-11.6 bundle construction a stable candidate surface without yet defining economic prioritization.

`eth_sendUserOperation` now returns the canonical UserOperation hash only after local validation/simulation succeeds and the operation is actually admitted (or is an idempotent duplicate already present). Failed simulation, nonce conflict or capacity rejection never returns an acceptance hash.

GEN-11.5 is complete when all repository qualification workflows pass on one exact head containing the bounded mempool and production admission wiring.


## GEN-11.6 — bundle construction + EntryPoint submission

Added `bundler/bundle` and wired a production submission loop into `bundler420`.

The current canonical `EntryPoint420` exposes `handleOp(PackedUserOperation420)` rather than a multi-operation `handleOps` ABI. GEN-11.6 therefore defines a **bundle** as a deterministic bounded local selection of mempool candidates that are processed in stable snapshot order and submitted as individual EntryPoint transactions. It does not invent an unsupported atomic batch contract call.

Before any candidate is submitted, the builder reruns the GEN-11.4 validator/simulator against current chain state. Candidates whose simulation evidence is no longer valid are never submitted. Successful revalidation must reproduce the same canonical UserOperation hash already stored in the mempool.

The execution submitter encodes the exact `handleOp` ABI already shared with simulation and submits through `eth_sendTransaction` from a configured operator account. The Bundler stores no operator private key or wallet signing authority; transaction signing remains with the configured execution-node/operator account.

Required GEN-11.6 environment:

- `BUNDLER_SUBMITTER` — nonzero operator transaction sender address

Optional GEN-11.6 environment:

- `BUNDLER_BUNDLE_MAX_OPERATIONS` — maximum candidates selected per cycle, default `16`
- `BUNDLER_BUNDLE_INTERVAL` — submission cadence, default `2s`

A successful execution-RPC submission yields an operational transaction hash and removes that UserOperation from the active mempool so it cannot be submitted repeatedly. RPC submission failure leaves the operation in the mempool for a later revalidation/retry cycle. Revalidation failure removes the candidate from current admission state. Neither condition is represented as canonical inclusion or finality; receipt/lifecycle evidence remains GEN-11.9 work.

The builder preserves GEN-11.5 deterministic snapshot order, truncates selection to the configured per-cycle bound, records selected/submitted/rejected/failed counts, and emits only operational logs.

GEN-11.6 is complete when all repository qualification workflows pass on one exact head containing deterministic bundle selection, current-state revalidation, EntryPoint transaction submission and the production submission loop.


## GEN-11.7 — gas + fee estimation

Added `bundler/gasestimation` and replaced the GEN-11.3 placeholder response for `eth_estimateUserOperationGas`.

The estimator uses the same canonical `EntryPoint420.handleOp(PackedUserOperation420)` ABI as simulation/submission and asks the configured execution RPC for a bounded `eth_estimateGas` result. Because standard `eth_estimateGas` exposes only a full transaction estimate—not separate account-abstraction verification and execution phases—the Bundler does not fabricate a verifier benchmark.

Genesis estimation semantics are therefore explicit:

- `preVerificationGas` is computed locally from the encoded `handleOp` calldata using the intrinsic transaction floor plus zero/nonzero calldata byte costs, then raised to the client-supplied value if that value is already larger.
- `verificationGasLimit` preserves the high 128-bit verification component already supplied in `accountGasLimits`; if none was supplied, it remains `0x0` rather than inventing a measurement the node did not provide.
- `callGasLimit` preserves the supplied low 128-bit call component but is raised to at least the execution node's full `eth_estimateGas` result, giving a conservative execution envelope.

The RPC path rejects unsupported EntryPoints and maps execution-provider estimation failures to Bundler error `-32504` without leaking arbitrary dependency detail. Responses remain canonical hexadecimal quantities.

The estimator reuses the hardened public execution-RPC URL boundary and bounded 1 MiB response handling. When configured, `BUNDLER_SUBMITTER` is supplied as the transaction sender for estimation so node-side behavior matches the production submission path.

GEN-11.7 does not set fee-market policy or mutate the operation's `gasFees`; fee ordering/economic policy remains separate from estimation and is addressed later in the Genesis ordering/policy phases.

GEN-11.7 is complete when all repository qualification workflows pass on one exact head containing execution-backed gas estimation and the public RPC integration.


## GEN-11.8 — Paymaster integration boundary

Added `bundler/paymaster` as a strict, non-authoritative sponsorship-envelope boundary ahead of EntryPoint simulation.

The Bundler mirrors the canonical `PaymasterData420.V1` ABI enough to reject malformed or incorrectly bound `paymasterAndData` before spending execution-RPC resources. The boundary validates:

- version `1`
- nonzero paymaster address
- nonzero EntryPoint address
- chain binding to the configured Bundler chain
- EntryPoint binding to the configured canonical EntryPoint
- nonzero policy ID
- canonical `uint48` validity fields with `validUntil > validAfter`
- current-time validity window
- nonzero `uint128` maximum sponsored cost
- nonzero authorization ID
- canonical dynamic-bytes offset/length/padding
- sponsor data bounded to 4096 bytes

An empty `paymasterAndData` remains valid and is treated as an unsponsored UserOperation.

GEN-11.8 does **not** decide whether a sponsor grants funding. It does not select a Paymaster, create policy, mint authorization, override account validation or mark an operation sponsored. After this structural/binding gate, the existing GEN-11.4 `handleOp` simulation remains authoritative for the actual EntryPoint + Paymaster validation path. The canonical `EntryPoint420` invokes `validatePaymasterUserOp`, enforces Paymaster validation data, verifies the sponsorship ceiling/deposit/reservation rules and remains the only execution authority for sponsorship acceptance.

This preserves BUNDLER-INV-009: sponsorship authority remains with the Paymaster/account-abstraction validation path; the Bundler only rejects envelopes that are structurally impossible or bound to the wrong chain/EntryPoint/time window.

GEN-11.8 is complete when all repository qualification workflows pass on one exact head containing the strict paymaster boundary and simulation integration.


## GEN-11.9 — receipts + lifecycle tracking

Added `bundler/lifecycle` and connected successful GEN-11.6 submission evidence to the public `eth_getUserOperationReceipt` boundary.

Lifecycle tracking begins only after the execution RPC accepts a transaction submission. The Bundler records the canonical UserOperation hash, transaction hash, configured EntryPoint and submission time in an in-memory operational store. A conflicting transaction binding for the same UserOperation hash fails closed.

Receipt reconciliation does not treat a transaction hash as inclusion. The Bundler queries `eth_getTransactionReceipt` for the recorded transaction and requires all of the following before returning a positive UserOperation receipt:

- a successful transaction receipt (`status == 0x1`)
- canonical transaction and block hashes
- a canonical block-number quantity
- exactly one log from the configured EntryPoint
- the canonical `UserOperationHandled` event topic
- indexed UserOperation hash equal to the requested hash
- well-formed indexed sender/nonce-key topics
- canonical event data containing sequence + boolean execution outcome

No matching event returns `result: null`; duplicate matching events fail closed as ambiguous evidence. A reverted EntryPoint transaction is not represented as successful inclusion.

A positive GEN-11.9 receipt exposes the UserOperation hash, EntryPoint, transaction hash, block hash, block number, execution-success flag and operational lifecycle value `included`.

GEN-11.9 intentionally does not claim finality. `included` means canonical receipt/event evidence currently exists at a specific block. Finality/reorg recovery remains governed by later GEN-11 phases, preserving BUNDLER-INV-003, BUNDLER-INV-012 and BUNDLER-INV-013.

The submission recorder is attached to the bundle builder before active mempool removal, so a successfully submitted operation is not silently discarded without lifecycle evidence. If lifecycle evidence cannot be recorded, the operation remains in the active pool and the cycle reports failure rather than fabricating a successful tracked submission.

GEN-11.9 is complete when all repository qualification workflows pass on one exact head containing submission tracking, canonical receipt/event reconciliation and the public receipt RPC implementation.


## GEN-11.10 — multi-bundler propagation

Added `bundler/peer` and wired provider-neutral peer propagation into the production Bundler runtime.

Each Bundler may be configured with up to 32 peer base URLs through:

- `BUNDLER_PEERS` — comma-separated peer base URLs

Outbound propagation occurs only after a UserOperation has passed the local GEN-11.4/11.8 validation path and has been admitted to the local GEN-11.5 mempool. Exact duplicate local submissions are not repropagated.

Peer transport uses a separate internal protocol endpoint:

- `POST /peer/v1/user-operation`

The peer envelope binds:

- chain ID
- configured EntryPoint
- canonical UserOperation hash
- full signed `PackedUserOperation420`

An inbound peer operation never bypasses local admission. The receiving Bundler independently:

1. validates the peer chain and EntryPoint domain;
2. canonicalizes the UserOperation;
3. recomputes the canonical UserOperation hash locally;
4. reruns the full local validation/simulation path, including the GEN-11.8 Paymaster boundary;
5. applies the local bounded mempool conflict/capacity rules.

Only after those checks does the receiving Bundler return HTTP `202 Accepted`.

Peer-received UserOperations are deliberately **not rebroadcast**. This creates a one-hop propagation primitive for Genesis and prevents propagation loops/amplification while multi-peer topology remains operator-configurable. A wallet or originating Bundler may independently submit to multiple compatible operators.

Outbound propagation is bounded and concurrent rather than serial: all configured peers are contacted in parallel under the request context and configured HTTP timeout. One failing or unavailable peer cannot block use of another peer. Propagation is best-effort; failure by every configured peer does not revoke or invalidate the already-completed local admission.

Peer inputs are bounded to 1 MiB, peer count is capped at 32, configured URLs reuse the hardened external-target URL validation boundary, and response bodies are drained only through a small bounded reader.

This phase preserves the core Genesis invariants:

- BUNDLER-INV-005 — peer propagation never bypasses local validation/simulation.
- BUNDLER-INV-010 — one Bundler/operator failure cannot prevent use of another compatible operator.
- BUNDLER-INV-011 — alternative Bundler clients/operators remain permitted.
- BUNDLER-INV-015 — peer inputs and dependencies remain untrusted and bounded.

GEN-11.10 intentionally does not introduce peer reputation, quotas, bans or abuse scoring; those controls belong to GEN-11.11.

GEN-11.10 is complete when all repository qualification workflows pass on one exact head containing bounded peer ingress, best-effort outbound fan-out and independent local revalidation at every receiving Bundler.


## GEN-11.11 — reputation + anti-abuse controls

Added `bundler/reputation` and connected it to the GEN-11.10 peer-ingress boundary.

The Genesis reputation layer is deliberately operational and temporary. It does not create protocol identity, stake authority, permanent bans, execution authorization, consensus weight or canonical reputation. Its only purpose is to bound resource consumption by hostile or malfunctioning peer traffic before that traffic can repeatedly consume simulation and mempool resources.

The guard maintains bounded in-memory accounting for:

- the actual transport source IP derived from `RemoteAddr`
- the UserOperation sender address

Forwarded client headers are not trusted as peer identity.

For each accounting window the guard enforces:

- maximum requests per transport source
- maximum requests per UserOperation sender across sources
- maximum validation/admission failures per transport source
- temporary source backoff after abuse thresholds are reached
- a hard cap on remembered source/sender records with oldest-entry eviction
- automatic pruning and expiry of inactive reputation state

Production defaults:

- `BUNDLER_REPUTATION_WINDOW=1m`
- `BUNDLER_REPUTATION_MAX_REQUESTS_PER_SOURCE=120`
- `BUNDLER_REPUTATION_MAX_FAILURES_PER_SOURCE=20`
- `BUNDLER_REPUTATION_MAX_REQUESTS_PER_SENDER=60`
- `BUNDLER_REPUTATION_BACKOFF=5m`
- `BUNDLER_REPUTATION_MAX_ENTRIES=8192`

All values are configurable and startup fails closed for invalid combinations, including a failure threshold greater than the source-request limit.

Peer requests accrue failure reputation when they present an invalid chain/EntryPoint domain, malformed UserOperation, canonical hash mismatch, failed local validation/simulation or deterministic sender/nonce conflict. Local mempool capacity exhaustion is not treated as peer misconduct.

Once a source is in backoff, further peer ingress from that source returns HTTP `429 Too Many Requests` before simulation or mempool admission. Per-sender quota exhaustion likewise returns HTTP 429. Penalties expire automatically; GEN-11.11 does not create a permanent blacklist.

The guard does not relax any GEN-11.10 rule. Every non-rate-limited peer operation still passes canonical hash verification, local GEN-11.4/11.8 validation and the local GEN-11.5 mempool rules. A good reputation cannot bypass validation, and a bad reputation cannot alter canonical account or chain state.

This preserves BUNDLER-INV-005, BUNDLER-INV-010, BUNDLER-INV-011 and BUNDLER-INV-015 while ensuring the multi-bundler network has a bounded operational response to malformed floods and repeated invalid submissions.

GEN-11.11 is complete when all repository qualification workflows pass on one exact head containing bounded reputation state, source/sender quotas, temporary backoff and peer-ingress integration.


## GEN-11.12 — replacement + nonce hardening

GEN-11.12 upgrades the bounded mempool from conflict-only sender/nonce handling to deterministic replacement.

UserOperation identity remains the full canonical sender + uint256 nonce + UserOperation hash. The Bundler never collapses or truncates the nonce before conflict detection, so independent nonce lanes encoded in the high 192 bits remain distinct.

For two different UserOperation hashes with the same sender and exact nonce, the later operation is admitted only as an explicit replacement when its execution-relevant `maxFeePerGas` is sufficiently higher than the currently admitted operation.

The replacement fee is derived from the same field used by the canonical `EntryPoint420` cost calculation:

- `maxFeePerGas = uint128(uint256(userOp.gasFees))`
- equivalently, the low 128 bits of `gasFees`

Genesis does not invent an independent priority-fee rule because the current EntryPoint contract does not use the high 128 bits when calculating maximum or actual UserOperation gas cost.

Default replacement rule:

- `BUNDLER_REPLACEMENT_BUMP_BPS=1000`
- replacement requires at least a 10% increase in `maxFeePerGas`
- integer rounding is upward
- every replacement must increase the fee by at least one wei, including a zero/tiny-fee incumbent

The bump is configurable up to 10,000 basis points. Invalid settings fail startup through mempool configuration validation.

A successful replacement is atomic under the mempool lock:

- the old hash is removed
- the new hash, operation and fresh simulation evidence replace it
- total mempool size does not increase
- per-sender occupancy does not increase
- the sender+nonce index points only to the new hash
- the original admission timestamp is preserved
- the original expiry timestamp is preserved

Preserving admission/expiry prevents replacement from refreshing TTL or gaining a queue-position advantage. Bundle selection therefore remains stable under fee replacement until GEN-11.18 defines the explicit Genesis ordering/economic policy boundary.

An insufficient bump returns deterministic Bundler error `-32503` with `replacement fee bump insufficient`. Peer propagation treats an underpriced replacement as a deterministic sender/nonce conflict and may count repeated abuse against the GEN-11.11 temporary source reputation boundary.

Every candidate replacement still has to pass the complete local validation/simulation path before the mempool considers replacement. Fee improvement therefore cannot bypass account authorization, Paymaster validation, chain/EntryPoint binding or simulation freshness.

This preserves BUNDLER-INV-006 and BUNDLER-INV-007: stale evidence cannot silently remain eligible, and sender/nonce conflicts/replacements produce one unambiguous active mempool entry.

GEN-11.12 is complete when all repository qualification workflows pass on one exact head containing atomic fee-bumped replacement, full-nonce conflict identity, queue/TTL preservation and deterministic public/peer rejection semantics.


## GEN-11.13 — failure isolation + reorg/restart recovery

GEN-11.13 hardens the Bundler around the two places where operational failure can otherwise create ambiguous or unsafe behavior: the transition from a locally valid UserOperation to an accepted execution transaction, and the transition from an observed transaction receipt to a currently canonical inclusion.

### Submission failure isolation

The lifecycle store now supports an explicit submission-intent state.

Before the Bundler calls the execution RPC, it records a pending submission intent containing:

- canonical UserOperation hash
- configured EntryPoint
- submission start time

The bundle builder consults lifecycle state before every send. If the same UserOperation is already pending or has a recorded transaction, the active mempool copy is removed from submission eligibility and is not blindly sent again.

If the execution RPC call fails, the pending intent is aborted and the UserOperation remains eligible for a later revalidation/retry cycle.

If the execution RPC accepts a transaction, the Bundler completes the intent with the returned transaction hash. The completion must match the original EntryPoint and cannot predate the recorded intent.

Most importantly, if the execution RPC accepted the transaction but lifecycle completion then fails, the operation is removed from the active mempool and reported as operationally failed rather than retained for automatic resubmission. This closes the GEN-11.9 ambiguity where an already-sent operation could otherwise be retransmitted after a recorder fault.

### Reorg-aware receipt reconciliation

`eth_getUserOperationReceipt` no longer trusts a transaction receipt's block hash in isolation.

After obtaining a receipt, the lifecycle tracker independently queries:

- `eth_getBlockByNumber(receipt.blockNumber, false)`

The receipt is treated as currently included only when the canonical block returned for that height has exactly the same block hash as the transaction receipt.

If:

- the block no longer exists,
- the canonical block hash differs,
- or the canonical block response is malformed,

the Bundler does not claim current inclusion. A block-hash mismatch is treated as reorg/orphan evidence and the receipt result downgrades to not currently included rather than fabricating finality.

The existing `UserOperationHandled` topic/hash/EntryPoint/event validation still applies after the canonical-block check.

### Restart reconstruction boundary

The lifecycle store now exposes validated recovery snapshots containing:

- unresolved pending submission intents
- completed submission bindings

Recovery restore is fail-closed. It rejects malformed hashes, invalid EntryPoints, zero timestamps, duplicate records, and any UserOperation represented simultaneously as pending and submitted.

This gives a restarted Bundler a deterministic state-reconstruction primitive while preserving the phase boundary: **GEN-11.13 defines what state must be reconstructed and how it is validated; GEN-11.14 supplies durable persistence and the audit trail that automatically feeds this recovery surface.**

Recovered pending/submitted state is operational evidence only. It does not claim inclusion or finality and does not bypass canonical receipt reconciliation.

This phase directly strengthens:

- **BUNDLER-INV-003** — finality remains chain-derived.
- **BUNDLER-INV-008** — dependency/recorder failures cannot justify unsafe local state mutation or blind resend.
- **BUNDLER-INV-012** — lifecycle evidence remains operational until matched to canonical chain evidence.
- **BUNDLER-INV-013** — restart/recovery state is reconstructable and cannot fabricate admission/inclusion/finality.
- **BUNDLER-INV-015** — malformed recovery and RPC evidence fails closed.

GEN-11.13 is complete when all repository qualification workflows pass on one exact head containing submission-intent isolation, duplicate-send suppression, canonical-block reorg checking and validated recovery snapshot/restore primitives.
