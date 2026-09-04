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

## Live gateway

`media/node/livegateway` adds the first live ingress/egress control plane for WHIP, WHEP, WebRTC, SRT and RTMP.

The gateway:
- validates protocol/direction/endpoint combinations before a session starts;
- rejects credentials embedded in endpoint URLs;
- keeps credentials as opaque operator-local references;
- tracks session lifecycle as `STARTING -> ACTIVE -> STOPPING -> CLOSED`, with failures recorded explicitly;
- rejects duplicate session IDs and invalid state transitions;
- provides a WHIP/WHEP HTTP negotiation driver using SDP offer/answer exchange;
- applies bearer credentials only after resolving them through a local credential resolver;
- provides direct-process SRT/RTMP launchers using argv without shell interpolation;
- leaves RTP/media bytes inside protocol drivers rather than exposing them to the chain-facing control plane.

The initial generic `webrtc://` protocol registration represents a future direct peer/gateway implementation; WHIP/WHEP are the concrete HTTP-negotiated WebRTC paths in this increment.

## Persistent leases and crash recovery

The file-backed lease store persists `jobId -> ownerId + expiry` records with atomic replacement and restart-safe ownership semantics. Active leases survive process restarts, expired leases may be reclaimed, stale owners cannot renew or delete a newer owner's lease, and corrupt persistent state fails closed rather than being silently reset.

Distributed implementations backed by Redis, etcd, Consul or a database must preserve the same compare-and-swap contract for acquire, renew and release.

## Health, telemetry and SLA evidence

`media/node/telemetry` keeps operational detail off-chain while producing deterministic commitments for `MediaSLA420.report()`.

The telemetry layer:
- tracks secret-free health snapshots for chain connectivity, active/completed/failed jobs and lease-loss counts;
- wraps media processors without exposing command lines, URLs, credentials, SDP, or raw media;
- mirrors SLA timing/availability thresholds in a local evaluator;
- emits a versioned fixed-width evidence record containing only IDs, output references, timestamps, availability basis points and pass/fail outcome;
- hashes the canonical evidence record with SHA-256 into an opaque non-zero `bytes32` commitment accepted by `MediaSLA420`;
- separates evidence generation from reporting authority through an `SLAReporter` interface so telemetry code never receives private keys.

Detailed evidence remains an off-chain audit artifact. Only the outcome and evidence hash are intended for the Phase 1 SLA contract.

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
13. select either a bounded media processor or live transport driver;
14. execute the workload under the bounded runtime context;
15. collect secret-free timing/availability telemetry;
16. evaluate the applicable SLA policy and generate a deterministic evidence commitment;
17. submit only the SLA outcome/evidence hash through an authorized reporter boundary;
18. fail closed on lease loss, deadline expiry, invalid transport state, failed negotiation, processing failure or empty result references;
19. commit only opaque output references on-chain.

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
- `MEDIA-NODE-INV-019`: live transport credentials are never embedded in canonical endpoint URLs or chain-facing session state.
- `MEDIA-NODE-INV-020`: live session identifiers are single-use within a running gateway registry and duplicate starts fail closed.
- `MEDIA-NODE-INV-021`: invalid live-session state transitions fail closed.
- `MEDIA-NODE-INV-022`: WHIP/WHEP negotiation accepts only successful HTTP responses with non-empty SDP answers.
- `MEDIA-NODE-INV-023`: SRT/RTMP endpoint strings are passed as direct argv elements and are never shell-expanded.
- `MEDIA-NODE-INV-024`: active persistent leases survive process restart until released or expired.
- `MEDIA-NODE-INV-025`: an expired lease may be reclaimed, but a stale owner can no longer renew it.
- `MEDIA-NODE-INV-026`: a stale owner cannot delete a replacement owner's lease during release.
- `MEDIA-NODE-INV-027`: corrupt persistent lease state fails closed and is never silently treated as an empty store.
- `MEDIA-NODE-INV-028`: raw telemetry, media paths, transport credentials and SDP never enter SLA evidence commitments.
- `MEDIA-NODE-INV-029`: identical canonical SLA evidence produces an identical non-zero evidence hash.
- `MEDIA-NODE-INV-030`: invalid timestamps, availability values or unknown outcomes fail closed before evidence reporting.
- `MEDIA-NODE-INV-031`: SLA telemetry code never directly owns or receives reporter signing keys.

## Next Phase 2 increments

1. operator CLI/configuration and secure signer implementation.
2. node integration tests against a local Anvil deployment of the 420Media contracts.
3. final Phase 2 hardening: lease-loss cancellation, runner error surfacing, health probes and failure-injection coverage.
