# Bong Goggles BG-12.3 — Canonical Event Adapters & Durable Recovery

BG-12.3 connects the deterministic BG-12.1 projector and BG-12.2 materialized views to the actual Bong Goggles contract event model and adds restart-safe projection persistence.

## Canonical event adapter rules

- adapters consume decoded logs from the deployed canonical Bong Goggles contracts
- event payloads are never treated as sufficient when they omit canonical state required by the read model
- profile create/update/status events hydrate `profile(account)` at the event block
- social-object publish/edit/hide/restore/delete events hydrate `socialObject(objectId)` at the event block
- `FriendRequestAccepted` hydrates `friendRequest(requestId)` because the event does not carry the requester address
- follow/unfollow, block/unblock and mute/unmute transitions reduce directly from their canonical event arguments
- unsupported events fail closed rather than silently producing speculative mutations
- provenance-only events do not duplicate a social-object mutation; the complete hydrated object record remains canonical for projection

## Persistence/recovery guarantees

- the persisted unit is the deterministic canonical event stream plus its checkpoint/state-root envelope
- writes use an atomic temporary-file + rename sequence
- persisted files are schema- and chain-bound
- restart rebuilds the projector from the event stream and verifies the state root, block number and block hash
- an event-stream digest detects tampering/corruption before replay
- recovery checks the persisted head hash against the canonical chain
- on reorg, recovery walks backward to the last matching persisted canonical block, rebuilds from retained events, and persists the rolled-back checkpoint
- no off-chain projection becomes authoritative; canonical chain state remains the source of truth

## Phase-12 integration rule

BG-12.3 is not merged independently. It remains on `feature/bong-goggles-phase12-monolithic` and is extended by BG-12.4 through BG-12.7. The branch is merged only after the entire Phase 12 backend/indexer is qualified.
