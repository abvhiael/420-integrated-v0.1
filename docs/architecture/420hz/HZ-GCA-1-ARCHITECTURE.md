# 420Hz Generate + Community + Awards architecture

Status: **CONSOLIDATED — HZ-GCA-1.1 through HZ-GCA-1.17**

Canonical parent: **HZ-GCA-1 — Scope, threat model and authority map**

Machine-readable consolidation:

`hz/config/gca-architecture-consolidation-v1.json`

This document is the normative architecture entry point for the HZ-GCA-1 architecture phase.

It consolidates the qualified semantics from HZ-GCA-1.1 through HZ-GCA-1.17 without replacing their field-level normative manifests. If this summary and a subordinate machine-readable manifest differ, the subordinate manifest controls its exact field-level policy until the inconsistency is explicitly reconciled and requalified.

## Architecture status

This phase defines architecture, authority, object, privacy, economic, security, interface and recovery semantics.

It does **not** claim:

- live AI generation;
- production provider adapters;
- a 420Hz canonical service ID;
- production endpoints;
- deployed contract addresses;
- live public Awards voting;
- live Charts qualified-play infrastructure;
- live moderation/Arbitration integration;
- testnet or production deployment qualification.

Those belong to later HZ-GCA implementation/testnet/production phases.

## Source-of-truth map

HZ-GCA-1 is decomposed into the following qualified Level-1 work packages:

1. **HZ-GCA-1.1 — Product boundaries**
2. **HZ-GCA-1.2 — Canonical object model**
3. **HZ-GCA-1.3 — Generate lifecycle**
4. **HZ-GCA-1.4 — AI disclosure**
5. **HZ-GCA-1.5 — Provenance**
6. **HZ-GCA-1.6 — Rights & consent**
7. **HZ-GCA-1.7 — Privacy**
8. **HZ-GCA-1.8 — Storage & retention**
9. **HZ-GCA-1.9 — Generation economics**
10. **HZ-GCA-1.10 — Community authority**
11. **HZ-GCA-1.11 — Charts**
12. **HZ-GCA-1.12 — Awards architecture**
13. **HZ-GCA-1.13 — Nomination & voting**
14. **HZ-GCA-1.14 — Moderation & disputes**
15. **HZ-GCA-1.15 — Threat model**
16. **HZ-GCA-1.16 — API/event/interface contracts**
17. **HZ-GCA-1.17 — Failure and recovery**

The exact manifest/document index is maintained in the consolidation manifest and in `docs/architecture/420hz/index.md`.

## Authority ledger

### Wallet / Smart Accounts

**Owner:** Wallet / Smart Accounts.

420Hz consumes qualified actor/session/capability references.

420Hz never:

- receives or stores Wallet private keys/mnemonics;
- treats wallet connection as operation approval;
- broadens Wallet capability scope;
- converts Identity or Community state into Wallet authority.

### 420Identity

**Owner:** 420Identity or an explicitly approved eligibility verifier.

420Hz may consume:

- public profile presentation;
- minimum-disclosure eligibility predicates;
- ballot-scoped nullifier/eligibility references.

420Hz does not mint Identity trust or infer one-person-one-vote from Wallet count.

### 420AI / Compute Market

**Owner:** 420AI + Compute Market for job execution, matching, verification and settlement state.

420Hz may:

- request quotes;
- submit/cancel generation;
- observe lifecycle/result state;
- bind result/provenance references.

420Hz cannot:

- fabricate provider success;
- rewrite matching;
- create provider entitlement;
- bypass verification;
- alter accepted provider/economic/privacy/verification terms during recovery.

### Creative Protocol / 420 Rights

**Owner:** Creative and Rights registries.

Canonical:

- CreatorId;
- WorkId;
- RecordingId;
- publication state;
- rights/license/provenance state.

420Hz references and requests transitions against those owners.

420Hz must never create competing canonical Creative IDs or rewrite Rights through UI/moderation metadata.

### Generate private project domain

**Owner:** 420Hz application product domain.

420Hz is canonical only for its own private application workflow objects:

- GenerationProject;
- GenerationIntent;
- GenerationRunBinding;
- GenerationOutput;
- GenerationArtifact;
- ProvenanceDraft;
- PublishIntent.

These objects do not replace 420AI/Compute execution truth or Creative publication truth.

### Storage / Resource Protocol

**Owner:** Resource Protocol / qualified storage provider for storage manifests/availability/integrity as defined by that service.

420Hz retains storage references and privacy/retention policy.

A StorageObjectRef does not imply universal physical-deletion authority.

### Generation economics

**Owner:** canonical 420AI/Compute/Vault/payment state.

420Hz may display/reconcile:

- quotes;
- funding;
- accepted price;
- provider earned/claimable/paid;
- payer refundable/claimable/paid.

420Hz does not invent settlement or refund status.

### Community

**Owner:** 420Hz Community product domain.

Canonical source relations:

- ArtistFollow;
- RecordingFavorite;
- Playlist;
- PlaylistItem.

Derived CommunityActivity is not source authority.

### Charts

**Owner:** 420Hz Charts policy over eligible source state.

A ChartSnapshot is a **derived, deterministic, rebuildable projection**.

Chart rank cannot become:

- Rights authority;
- Identity trust;
- payment authority;
- Awards result authority;
- governance authority.

### Awards

**Owner:** 420Hz Awards product domain.

Canonical Awards objects:

- AwardProgram;
- AwardSeason;
- AwardCategory;
- EligibilityPolicy;
- AwardNomination;
- AwardBallot;
- AwardVote;
- AwardResult;
- AwardBadge.

AwardVote is product-domain voting only and is distinct from Chart, Community and Civic/Governance voting.

### Moderation

**Owner:** 420Hz application moderation domain.

Moderation owns:

- reports;
- hide/lock/suspend;
- block/mute;
- decisions;
- appeals;
- restore;
- Awards challenge intake/status.

Moderation cannot rewrite Creative/Rights/Identity/Wallet/payment/governance truth.

### Arbitration

**Owner:** 420Arbitration when explicitly adopted.

420Hz consumes only bounded finalized ruling references through explicitly allowlisted application remedies.

A ruling is not ambient authority.

### Indexer / Search / Analytics / Notifications

These remain derived or delivery surfaces.

They may not authorize protected state transitions or override canonical source truth.

## Authoritative vs derived state

### Authoritative

Authoritative source state includes:

- Wallet/SmartAccount authorization;
- Identity eligibility source state;
- AI/Compute job/match/verification/settlement state;
- Creative publication IDs/state;
- Rights/license/provenance state;
- 420Hz private Generate project state;
- 420Hz Community source relations;
- 420Hz Awards product-domain state;
- 420Hz moderation application-enforcement state;
- storage manifests/integrity state under the owning provider/protocol.

### Derived

Derived state includes:

- ChartSnapshot ranking;
- Indexer projection;
- Search ranking/discovery;
- Analytics aggregate;
- Notification delivery state.

**Derived state cannot authorize protected writes or override authoritative state.**

## Canonical object model

### Generate

- GenerationProject
- GenerationIntent
- GenerationRunBinding
- GenerationOutput
- GenerationArtifact
- ProvenanceDraft
- PublishIntent

### Community

- ArtistFollow
- RecordingFavorite
- Playlist
- PlaylistItem
- CommunityActivity (derived)

### Charts

- ChartSnapshot (derived)

### Awards

- AwardProgram
- AwardSeason
- AwardCategory
- EligibilityPolicy
- AwardNomination
- AwardBallot
- AwardVote
- AwardResult
- AwardBadge

Native external IDs such as CreatorId, WorkId, RecordingId, AI job/model/provider references, Compute request/job IDs, Storage references and payment references remain externally canonical.

## Generate lifecycle

Product lifecycle:

`DRAFT → QUOTED → SUBMITTED → RUNNING → SUCCEEDED → REVIEWED → REGISTERED → PUBLISHED`

Exact-run terminal states:

- FAILED
- CANCELLED

Key separation:

- SUCCEEDED does not imply REVIEWED;
- REVIEWED does not imply REGISTERED;
- REGISTERED does not imply PUBLISHED;
- FAILED/CANCELLED do not imply refund paid.

Retry creates a new intent/run unless canonical recovery explicitly resumes the same operation.

## AI disclosure

Frozen disclosure classes:

- HUMAN
- AI_ASSISTED
- AI_GENERATED
- AI_DERIVATIVE

Classification is explicit and versioned.

Unknown/unresolved classification cannot silently default to HUMAN for publication.

## Provenance

Generation provenance links:

- project/intent/run/output;
- Wallet/account;
- AI job/model/provider;
- Compute references;
- request/result/result-manifest commitments;
- disclosure class;
- source Creative/Rights references;
- consent references where required;
- artifacts/storage refs;
- Creative handoff and final published provenance.

Private prompts/reference audio remain off-chain/private unless deliberately published.

## Rights and consent

Critical boundaries:

- AI transformation permission is distinct from training permission;
- upload possession is not proof of derivative rights;
- reference/master/stem/sample/AI-transform permissions are checked against canonical Rights/License authority;
- synthetic voice/persona claims require qualified explicit consent/authorization evidence;
- contributor credit is distinct from economic rights, source authorization and voice/persona consent.

## Privacy

Classes:

- PUBLIC
- UNLISTED
- PRIVATE
- SECRET

Generate drafts, prompts, lyrics, reference audio, raw outputs, stems and raw consent evidence are PRIVATE by default.

Wallet private keys, provider credentials, bearer/session tokens and decryption credentials are SECRET.

Search/Indexer/Analytics/Notifications do not receive private payloads merely because a reference or commitment exists.

## Storage and retention

Storage policy distinguishes:

- temporary provider/runtime retention;
- private project/artifact retention;
- public published artifacts/provenance;
- dispute/evidence holds;
- deletion/tombstone state.

Deletion/tombstone state beats stale replicas, backups and projections.

Integrity mismatch fails closed.

Restoration reapplies current privacy/retention/deletion state before content becomes readable.

## Generation economics

Economic states remain distinct:

- estimate;
- quote;
- payer max;
- funded amount;
- accepted price;
- provider earned;
- provider claimable;
- provider paid;
- payer refundable;
- payer refund claimable;
- payer refund paid.

No hidden 420Hz surcharge exists in this phase.

Retries cannot duplicate charges or provider entitlement.

## Community

Community owns only its explicit source relations.

Important separations:

- favorite is not play;
- follow is not AwardVote;
- playlist visibility cannot widen source Recording visibility;
- PRIVATE/UNLISTED Community data cannot enter public discovery/Charts.

## Charts

Initial chart families:

- TOP_RECORDINGS
- TRENDING_RECORDINGS
- NEW_RECORDINGS
- TOP_ARTISTS
- COMMUNITY_FAVORITES

RAW_PLAY is distinct from QUALIFIED_PLAY.

V1 chart scoring uses qualified playback/listener evidence only; Community signals have zero positive v1 score weight.

Charts remain deterministic, versioned and rebuildable.

## Awards

Initial Awards architecture is versioned per season.

The initial category framework is configurable, not a permanent global hard-coded list.

Season/policy/category state freezes before participation.

Ballot candidate set/policy freezes before voting.

AwardResult is immutable product-domain history.

AwardBadge is recognition metadata and is not automatically an NFT/token.

A valid award may have zero prize.

## Nomination and voting

Supported nomination modes:

- OPEN_SUBMISSION
- CURATED_SUBMISSION
- COMMUNITY_THRESHOLD

Supported voter modes:

- WALLET_ONE_ACCOUNT_ONE_VOTE
- IDENTITY_UNIQUE_ONE_VOTE
- JURY_ONE_MEMBER_ONE_VOTE

Wallet-only voting never claims one-person-one-vote.

Unique-human voting requires qualified minimum-disclosure eligibility.

Supported quorum:

- MIN_VALID_VOTES
- MIN_PARTICIPATION_BPS

Supported winner rules:

- PLURALITY
- MIN_SHARE_BPS

Supported ties:

- CO_WINNERS
- NO_WINNER
- RUNOFF_REQUIRED

Finalization is deterministic and single-use.

## Moderation and disputes

Application vocabulary:

- REPORT
- HIDE
- LOCK
- SUSPEND
- BLOCK
- MUTE
- MODERATOR_DECISION
- APPEAL
- RESTORE

Reports are allegations, not findings.

Rights disputes may cause temporary application holds but cannot rewrite canonical Rights.

Awards challenges cannot hand-edit tallies/winners.

Arbitration is optional/explicit only and is consumed through bounded allowlisted application remedies.

## Threat model

The threat model covers:

- prompt/tool injection;
- provider/result spoofing;
- malicious media/metadata;
- unsafe URLs/HTML;
- unauthorized reference audio;
- unconsented voice/persona;
- derivative-rights bypass;
- private prompt/draft leakage;
- secret/provider-token leakage;
- resource exhaustion;
- Wallet/session replay;
- economic confusion;
- storage mismatch/resurrection;
- stale/reorged derived state;
- Community replay/privacy bypass;
- Chart manipulation;
- collusive nominations;
- vote stuffing/Sybil voting;
- Awards result tampering;
- moderation abuse;
- evidence leakage;
- Arbitration authority escalation;
- provider/operator compromise;
- cross-component confused-deputy abuse.

The security rule is consistent throughout: dependency/provider/UI state never gains authority simply because the owning source is unavailable.

## API / event / interface contracts

Logical envelopes are versioned and idempotent.

Authority-bearing mutations bind:

- actor;
- domain;
- resource;
- idempotency key;
- material payload.

Eligible PUBLIC reads may remain anonymous.

Events describe facts/observations and are not ambient authority.

Repository-defined service identities are reused where available; HZ-GCA-1 does not invent a 420Hz canonical service identity.

## Failure and recovery

The recovery rule is:

**reconcile canonical/source authority before retrying any action that could create spend, entitlement, publication, vote, moderation or remedy effects.**

Partial output never implies verified success, publication or settlement.

Restart recovery restores higher-authority source state before lower-authority projections.

Durable idempotency/replay state survives restart.

Degraded mode disables/limits the affected feature rather than guessing authority.

## Cross-domain separations

The architecture explicitly preserves all of the following:

- AI transformation permission ≠ training permission;
- Generate success ≠ Creative registration/publication;
- raw play ≠ qualified play;
- Community relation ≠ Chart credit;
- Chart rank ≠ Awards eligibility/result;
- AwardVote ≠ Chart, Community or Civic vote;
- moderation enforcement ≠ Rights/Identity/Wallet/payment/governance authority;
- Arbitration ruling ≠ ambient cross-domain execution;
- Notification/Search/Indexer/Analytics ≠ canonical source authority;
- partial output ≠ verified success/publication/settlement;
- payer refundable/claimable/paid ≠ provider earned/claimable/paid.

## Authority duplication check

As of HZ-GCA-1.18 consolidation:

**Unresolved authority duplication: NONE.**

The master architecture assigns each authoritative domain to one owning source and keeps 420Hz orchestration/presentation roles bounded.

Any later implementation that creates a second canonical source for Wallet authority, Identity, Creative IDs, Rights, Compute settlement, storage identity, Community relations, Awards state, or Governance would violate this phase and require explicit architecture requalification.

## Deferred runtime work

Still intentionally deferred:

- live generation/provider adapters;
- production media/worker isolation;
- live storage/provider qualification;
- live unique-human voter verifier;
- live qualified-play/anti-bot pipeline;
- live moderation/Arbitration adapters;
- public-testnet restart/reorg/recovery evidence;
- production endpoints/deployments/addresses.

## Consolidation rule

This document is the human-readable architecture entry point.

The subordinate HZ-GCA-1.1 through HZ-GCA-1.17 machine-readable manifests remain authoritative for exact field-level policy.

HZ-GCA-1.18 does not loosen, replace or reinterpret qualified subordinate requirements.

## HZ-GCA-1.18 exit criteria

HZ-GCA-1.18 is complete when:

- one normative master architecture summarizes HZ-GCA-1.1 through HZ-GCA-1.17;
- the complete source-of-truth index is machine-readable;
- the architecture index exposes all subordinate work packages;
- authority and derived-state boundaries are explicit;
- object/lifecycle/privacy/storage/economics/Community/Charts/Awards/moderation/security/API/recovery semantics are cross-linked;
- no unresolved authority duplication remains;
- targeted exact-head consolidation verifier passes;
- no runtime service, endpoint, address, ABI, deployment or testnet state is invented;
- parent HZ-GCA-1 remains open.

Next canonical work package:

**HZ-GCA-1.19 — Phase-1 adversarial review**
