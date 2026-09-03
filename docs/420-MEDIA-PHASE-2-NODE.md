# 420Media Phase 2 — Node Foundation

Status: implementation branch

## Purpose

Phase 2 introduces the off-chain operator runtime that consumes the Phase 1 media protocol. The node is not a blockchain validator and does not transport raw media on-chain. It watches for eligible `MediaJobMarket420` work, accepts only jobs matching the configured operator identity and capabilities, verifies that canonical funding is present, executes an off-chain processor, and commits only output references back to the protocol.

## Runtime boundary

The `media/node` package intentionally uses only Go standard-library dependencies. Ethereum RPC, media engines, transport gateways and production storage are isolated behind interfaces.

Interfaces:
- `ChainAdapter`: pending-job discovery plus accept/refresh/running/result lifecycle calls.
- `Processor`: codec, relay, recording, transcription or inference execution.
- `LeaseStore`: duplicate-execution exclusion for one operator identity.

## Ethereum adapter

`media/node/ethadapter` is the protocol-facing translation boundary. It translates raw `MediaJobMarket420.Status` ordinals into stable node statuses, rejects unknown/malformed jobs, and keeps Solidity representation details outside the worker state machine.

The concrete RPC backend provides:
- standard-library JSON-RPC transport with request/response ID validation and bounded response reads;
- `eth_getLogs` discovery of `JobCreated` events;
- `eth_call` reads of the canonical public `jobs(bytes32)` getter;
- fail-closed static ABI decoding with explicit uint256-to-uint64 overflow rejection;
- a separate `Signer` interface for state-changing transactions so RPC reads never imply access to operator keys;
- ABI selector/topic configuration so deployment artifacts can supply canonical selectors without coupling the worker to an ABI library;
- an atomic file-backed block cursor that advances only after a successful discovery/read pass.

The backend re-reads current job state after event discovery and only returns jobs still in `CREATED`, so historical creation events cannot cause execution of cancelled, accepted, expired, or otherwise transitioned work.

## FFmpeg/GStreamer processor

`media/node/mediaprocessor` provides the first production-oriented implementation of the node `Processor` interface.

The processor:
- maps exact capability IDs to operator-controlled static profiles rather than accepting requester-provided command fragments;
- supports bounded FFmpeg profiles for H.264, H.265, AV1 and VP9 plus AAC/Opus/copy audio and MP4/Matroska/MPEG-TS/WebM containers;
- includes an intentionally narrower GStreamer video pipeline for the same initial video codecs and containers;
- resolves opaque `inputRef` values through a `Resolver`, keeping raw paths, URLs, credentials and stream secrets out of chain-facing state;
- allocates and commits outputs through a `Sink`, returning only an opaque 32-byte result reference to the protocol;
- executes binaries directly through argv with no shell interpolation;
- bounds runtime by both operator `MaxRuntime` and the canonical job deadline;
- aborts partially produced output when execution, commit or validation fails.

The GStreamer graph is deliberately constrained in this increment. Multi-branch audio/video pipelines, live tees and ingress/egress transport elements are deferred to the gateway step rather than exposed as arbitrary requester-controlled pipelines.

## Execution sequence

1. discover `JobCreated` events from the durable cursor;
2. re-read canonical job state;
3. retain only `CREATED` jobs;
4. filter by locally configured capability;
5. reject expired work;
6. acquire an execution lease;
7. submit operator acceptance through the signer boundary;
8. re-read canonical chain state;
9. verify bound operator identity;
10. require `FUNDED` state and non-zero funded amount;
11. mark the job running;
12. resolve the opaque media input reference locally;
13. select the static capability profile;
14. execute FFmpeg or GStreamer under the bounded runtime context;
15. commit the completed media artifact to an opaque output reference;
16. fail closed if the lease is lost, deadline passes, processing fails or the output reference is empty;
17. commit the output reference on-chain.

## Node invariants

- `MEDIA-NODE-INV-001`: a node never processes a job before canonical funding confirmation.
- `MEDIA-NODE-INV-002`: a node never processes work bound to another operator identity.
- `MEDIA-NODE-INV-003`: unsupported capabilities are skipped or rejected before execution.
- `MEDIA-NODE-INV-004`: raw media and stream secrets are not represented in chain-facing runtime state.
- `MEDIA-NODE-INV-005`: duplicate local execution is excluded by a renewable lease.
- `MEDIA-NODE-INV-006`: lease loss is fail-closed before result commitment.
- `MEDIA-NODE-INV-007`: expired work is never newly executed or committed.
- `MEDIA-NODE-INV-008`: Solidity enum ordinals are translated by adapters rather than coupled to node constants.
- `MEDIA-NODE-INV-009`: unknown or malformed contract job representations fail closed before worker execution.
- `MEDIA-NODE-INV-010`: an empty result reference never reaches the Ethereum transaction backend.
- `MEDIA-NODE-INV-011`: RPC read access is separated from transaction-signing authority.
- `MEDIA-NODE-INV-012`: an event cursor advances only after the corresponding log scan and canonical job reads succeed.
- `MEDIA-NODE-INV-013`: historical `JobCreated` logs never bypass current canonical job status.
- `MEDIA-NODE-INV-014`: oversized contract monetary values fail closed rather than truncating into node runtime amounts.
- `MEDIA-NODE-INV-015`: requester-controlled media references never become shell command text or executable pipeline fragments.
- `MEDIA-NODE-INV-016`: only operator-configured capability profiles may select codecs, containers, scale bounds or media engines.
- `MEDIA-NODE-INV-017`: partial or failed media outputs are aborted and never committed as canonical result references.
- `MEDIA-NODE-INV-018`: media execution time cannot exceed the lesser of the operator runtime cap and the canonical job deadline.

## Next Phase 2 increments

1. WHIP/WHEP/WebRTC and SRT/RTMP ingress/egress gateway adapter.
2. persistent/distributed lease backend and crash recovery.
3. health, telemetry and SLA evidence generation.
4. operator CLI/configuration and secure signer implementation.
5. node integration tests against a local Anvil deployment of the 420Media contracts.
