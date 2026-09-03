# 420Media Phase 2 — Node Foundation

Status: implementation branch

## Purpose

Phase 2 introduces the off-chain operator runtime that consumes the Phase 1 media protocol. The node is not a blockchain validator and does not transport raw media on-chain. It watches for eligible `MediaJobMarket420` work, accepts only jobs matching the configured operator identity and capabilities, verifies that canonical funding is present, executes an off-chain processor, and commits only output references back to the protocol.

## Initial runtime boundary

The `media/node` package intentionally uses only Go standard-library dependencies. Ethereum RPC bindings, FFmpeg/GStreamer/WebRTC adapters and production storage are isolated behind interfaces and are subsequent Phase 2 increments.

Interfaces:
- `ChainAdapter`: pending-job discovery plus accept/refresh/running/result lifecycle calls.
- `Processor`: codec, relay, recording, transcription or inference execution.
- `LeaseStore`: duplicate-execution exclusion for one operator identity.

## Execution sequence

1. discover `CREATED` jobs;
2. filter by locally configured capability;
3. reject expired work;
4. acquire an execution lease;
5. submit operator acceptance;
6. re-read canonical chain state;
7. verify bound operator identity;
8. require `FUNDED` state and non-zero funded amount;
9. mark the job running;
10. execute the processor off-chain;
11. fail closed if the lease is lost, the deadline passes, or output is empty;
12. commit the output reference.

## Node invariants

- `MEDIA-NODE-INV-001`: a node never processes a job before canonical funding confirmation.
- `MEDIA-NODE-INV-002`: a node never processes work bound to another operator identity.
- `MEDIA-NODE-INV-003`: unsupported capabilities are skipped or rejected before execution.
- `MEDIA-NODE-INV-004`: raw media and stream secrets are not represented in chain-facing runtime state.
- `MEDIA-NODE-INV-005`: duplicate local execution is excluded by a renewable lease.
- `MEDIA-NODE-INV-006`: lease loss is fail-closed before result commitment.
- `MEDIA-NODE-INV-007`: expired work is never newly executed or committed.
- `MEDIA-NODE-INV-008`: Solidity enum ordinals are translated by adapters rather than coupled to node constants.

## Next Phase 2 increments

1. Ethereum JSON-RPC/event adapter for the Phase 1 contracts.
2. FFmpeg/GStreamer worker adapter for H.264/H.265/AV1 transcoding and recording.
3. WHIP/WHEP/WebRTC and SRT/RTMP ingress/egress gateway adapter.
4. persistent/distributed lease backend and crash recovery.
5. health, telemetry and SLA evidence generation.
6. operator CLI/configuration and secure signer integration.
7. node integration tests against a local Anvil deployment of the 420Media contracts.
