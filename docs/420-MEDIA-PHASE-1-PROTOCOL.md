# 420Media Protocol — Phase 1

## Scope

Phase 1 establishes the on-chain coordination primitives for decentralized media workloads. It intentionally does **not** put video/audio bytes, stream keys, HLS/WebRTC segments, codec payloads, or edge-routing data on-chain.

### Contracts

- `MediaCapabilityRegistry420` — governance-controlled capability vocabulary and deprecation.
- `MediaOperatorRegistry420` — operator identity, settlement account, stake/compute references, lifecycle, and advertised capabilities.
- `MediaSLA420` — versioned service policies plus authorized evidence attestations.
- `MediaStreamRegistry420` — canonical stream identity, controller, creator treasury, metadata, and provenance reference.
- `MediaJobMarket420` — bounded media workload lifecycle.
- `MediaSettlement420` — non-custodial funding/settlement coordination against external vault and payout adapters.

## On-chain / off-chain boundary

### On-chain

- canonical stream and operator identifiers;
- capability declarations;
- job request hashes/references;
- accepted operator binding;
- maximum spend and funding references;
- SLA policy and evidence hashes;
- result/output references;
- release/refund state and settlement references.

### Off-chain

- RTMP, SRT, WHIP/WHEP, WebRTC, HLS/DASH;
- raw video/audio and temporary segments;
- FFmpeg/GPU transcoding;
- edge/CDN routing and cache state;
- AI inference payloads;
- recordings and media objects (storage protocols may anchor their proofs separately);
- network telemetry used to produce SLA evidence.

## Job lifecycle

```text
CREATED
  | operator accepts advertised active capability
  v
ACCEPTED
  | approved vault adapter confirms funding terms
  v
FUNDED
  | accepted operator starts
  v
RUNNING
  | accepted operator commits output reference
  v
RESULT_COMMITTED
  | SLA attestation / requester approval (no-SLA jobs)
  +--------------------------+
  | pass                     | fail
  v                          v
VERIFIED                   FAILED
  | payout adapter            | payout adapter
  v                          v
SETTLED                    REFUNDED
```

A funded job may also become `EXPIRED`, which forces the settlement record to `REFUNDABLE`.

## Phase 1 invariants

1. **MEDIA-INV-001 — no direct custody:** media settlement contracts reject native-value custody; value movement belongs to approved vault/payout adapters.
2. **MEDIA-INV-002 — accepted operator precedes funding:** a funding record cannot be created until an operational operator has accepted the job.
3. **MEDIA-INV-003 — beneficiary binding:** payer, operator ID, beneficiary and maximum amount are verified against canonical job/operator state before funding is recorded.
4. **MEDIA-INV-004 — capability fail-closed:** deactivated capabilities make operators non-operational for new jobs.
5. **MEDIA-INV-005 — operator authority isolation:** only the accepted operator account may start work or commit a result.
6. **MEDIA-INV-006 — SLA evidence isolation:** only governance-authorized reporters may submit SLA evidence; each job receives at most one Phase-1 attestation.
7. **MEDIA-INV-007 — failed SLA cannot release:** failed SLA resolution creates a refundable, not claimable, settlement.
8. **MEDIA-INV-008 — canonical recipient:** payout cannot redirect a successful job away from the settlement account bound at funding.
9. **MEDIA-INV-009 — stream controller isolation:** stream metadata, provenance, treasury and lifecycle are controller-authorized.
10. **MEDIA-INV-010 — secrets stay off-chain:** stream keys and ingest credentials are never protocol state.

## Capability model

Phase 1 seeds identifiers for H.264/H.265/AV1/VP9 transcoding, live relay, WebRTC, recording, transcription and video inference. The registry itself remains extensible so later codecs and workloads do not require upgrading every operator/job contract.

`computeProviderRef` in `MediaOperatorRegistry420` is deliberately included as a compatibility bridge to the existing 420AI/compute architecture. Phase 1 does not merge the two markets; it preserves a clean route to a later canonical `420 Compute Market` without granting the media registry independent compute authority.

## Settlement model

`MediaSettlement420` is a state coordinator, not a treasury. Governance binds three single-assignment dependencies:

- `jobMarket` — canonical media job state;
- `vaultAdapter` — proves/binds funding held elsewhere;
- `payoutAdapter` — executes an already-authorized release/refund through canonical settlement infrastructure.

Funding is accepted only when the supplied payer, operator, beneficiary and amount match `MediaJobMarket420.settlementTerms(jobId)`.

## Phase 2 handoff

The future `420media` node/gateway can consume these contracts for discovery and settlement while implementing ingest, transcoding, relay, WebRTC, health telemetry, failover and edge delivery off-chain. The node must not require a contract upgrade to introduce additional codecs: new capabilities are registered by ID and advertised by operators.
