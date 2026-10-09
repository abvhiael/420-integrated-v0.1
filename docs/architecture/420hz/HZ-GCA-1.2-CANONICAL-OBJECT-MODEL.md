# HZ-GCA-1.2 — Canonical object model

Status: **IMPLEMENTED — Level 1 object-model definition**

Canonical parent step: **HZ-GCA-1 — Scope, threat model and authority map**

Machine-readable object model:

`hz/config/gca-object-model-v1.json`

This step freezes the logical object vocabulary for the Generate, Community and Awards expansion while preserving the authority boundaries already fixed by HZ-GCA-1.1. It does not create contracts, deploy addresses, provider integrations, live services or testnet claims.

## Design rules

1. Every 420Hz-owned logical object has exactly one stable ID field.
2. External canonical protocol objects are referenced by their native IDs and never re-hashed into competing canonical identities.
3. Private generation objects are private by default.
4. Derived projections are explicitly rebuildable and non-authoritative.
5. Material semantic changes use explicit revision/version/supersession rather than rewriting immutable history.
6. Awards-domain voting is product voting, not Civic governance voting.
7. No object definition itself grants signing, custody, settlement, identity, rights, governance or arbitration authority.

The object model is logical. Exact storage encoding, public ABI shape and deployment location remain later implementation decisions unless explicitly frozen by a later roadmap step.

## Object classes

### HZ_PRIVATE_APPLICATION

Private, user-scoped application state:

- `GenerationProject`
- `GenerationIntent`
- `GenerationRunBinding`
- `GenerationOutput`
- `GenerationArtifact`
- `ProvenanceDraft`
- `PublishIntent`

These objects coordinate the Generate experience but do not replace 420AI, Compute Market or Creative Protocol canonical state.

### HZ_PUBLIC_APPLICATION

420Hz-specific public/community objects:

- `ArtistFollow`
- `RecordingFavorite`
- `Playlist`
- `PlaylistItem`

These objects may create 420Hz community relationships, but they do not create 420Commons spaces, channels, membership or roles.

### HZ_AWARD_CANONICAL_PRODUCT_DOMAIN

420Hz Awards objects:

- `AwardProgram`
- `AwardSeason`
- `AwardCategory`
- `EligibilityPolicy`
- `AwardNomination`
- `AwardBallot`
- `AwardVote`
- `AwardResult`
- `AwardBadge`

These are canonical only inside the 420Hz Awards product domain. They are explicitly not 420Governance/Civic proposals, ballots or votes.

### EXTERNAL_CANONICAL_REFERENCE

Reference-only objects preserving owning-protocol native identity:

- `CreatorAccountRef`
- `CreatorProfileRef`
- `WorkRef`
- `RecordingRef`
- `LicenseRef`
- `AIJobRef`
- `AIModelVersionRef`
- `AIProviderRef`
- `ComputeRequestRef`
- `ComputeJobRef`
- `StorageObjectRef`
- `PaymentRef`

420Hz may retain these identifiers and display/resolve their owning protocol state. It may not maintain an independently writable duplicate of that state.

### DERIVED_PROJECTION

Rebuildable views:

- `CommunityActivity`
- `ChartSnapshot`

They may be recomputed from authoritative sources and cannot establish rights, payment, identity or Awards truth by themselves.

## Generate object graph

`GenerationProject`
→ one or more `GenerationIntent`
→ one or more `GenerationRunBinding`
→ `AIJobRef` and optional `ComputeRequestRef` / `ComputeJobRef`
→ one or more `GenerationOutput`
→ one or more `GenerationArtifact`
→ `ProvenanceDraft`
→ explicit `PublishIntent`
→ external `WorkRef` / `RecordingRef` only after canonical Creative registration succeeds.

### GenerationProject

Creator workspace. It may retain title/project metadata, a selected output and archive state. It must not duplicate AI jobs, compute jobs, Works or Recordings.

### GenerationIntent

Reviewable local/user intent before canonical 420AI submission. It binds a project, creator account and immutable intent commitment. It may reference source authorization, model version and privacy policy selections.

### GenerationRunBinding

Application binding between one GenerationIntent and the exact canonical execution IDs. The AI job ID is immutable once bound. Compute request/job references may appear only when supplied by the owning protocols. 420Hz may cache observed status but cannot authoritatively mutate AI/Compute lifecycle state.

### GenerationOutput

One returned result/take. Its result commitment and manifest hash are immutable. Human labels, favorite state, review state and storage reference may evolve.

### GenerationArtifact

Typed artifact pointer for a mix, stem, lyric/timing file, artwork or other output. The artifact object commits content but does not replace Storage protocol agreements/proofs.

### ProvenanceDraft

Pre-publication review object assembling disclosure and source/voice authorization references. It remains private until publication policy says otherwise and does not replace the Creative Protocol provenance hash or rights system.

### PublishIntent

Explicit reviewed user handoff into Creative registration. It may later retain returned Work/Recording references but never proves registration merely by existing.

## Community object graph

- `ArtistFollow`: account → Creative `CreatorId`
- `RecordingFavorite`: account → Creative `RecordingId`
- `Playlist` → ordered `PlaylistItem[]`
- `PlaylistItem` → Creative `RecordingId`
- `CommunityActivity`: derived projection over community source objects
- `ChartSnapshot`: derived versioned snapshot under a later chart methodology

A follow is not 420Commons membership. A favorite is not a qualified play or Awards vote. A chart position is not canonical rights, economic or awards truth.

## Awards object graph

`AwardProgram`
→ `AwardSeason`
→ `AwardCategory`
→ `EligibilityPolicy`
→ `AwardNomination`
→ frozen `AwardBallot`
→ qualified `AwardVote`
→ immutable `AwardResult`
→ permanent `AwardBadge`.

### AwardProgram

Stable parent program. Future policy revisions do not rewrite historical season state.

### AwardSeason

Time-bounded season with explicit eligibility, nomination and voting windows. Once opened/frozen, material policy must be committed rather than silently reinterpreted.

### AwardCategory

Versioned category within one season. It is distinct from Creative `RecordingClass` and Search categories.

### EligibilityPolicy

Versioned rules commitment. It may reference Identity, AI-disclosure and Creative-state requirements but does not duplicate those authorities.

### AwardNomination

One candidate nomination for an artist or Recording under an exact season/category and eligibility snapshot.

### AwardBallot

Frozen candidate set and voting policy commitment.

### AwardVote

Qualified product-domain vote or vote commitment. It may reference Wallet authorization and optional Identity eligibility, but does not store private signing material and is never a Civic vote.

### AwardResult

Immutable finalized result after the relevant later voting/finalization rules are satisfied. Prize settlement is separate and cannot determine whether the award is legitimate.

### AwardBadge

Permanent recognition pointer to exactly one finalized result. It is not automatically a token/NFT.

## ID rules

- 420Hz-owned IDs are logical opaque identifiers.
- A later implementation may encode them as `bytes32`, UUID-like storage keys or another exact representation only if that choice preserves this object model.
- IDs must not expose plaintext prompts, lyrics, wallet secrets or provider credentials.
- Deleted/tombstoned IDs are never silently recycled.
- External canonical IDs retain native owning-protocol representation:
  - Creative `CreatorId`, `WorkId`, `RecordingId`, `LicenseId` remain their native typed IDs.
  - 420AI job/model-version IDs remain 420AI IDs.
  - Compute request/job IDs remain Compute Market IDs.
  - Payment and storage identifiers remain owned by those systems.

## Mutability rules

Every object in the machine-readable manifest declares explicit immutable and mutable fields.

General rule:

- identity, creation provenance and binding edges that define the meaning of an object are immutable;
- presentation metadata and bounded state fields may be mutable where listed;
- immutable history is never changed merely because UI labels, rankings or current policies change;
- material semantic changes use version, revision or supersession edges.

## Cross-model invariants

The machine manifest freezes `HZGCA-OBJ-001` through `HZGCA-OBJ-016`.

The most important consequences are:

- external protocol IDs remain native and reference-only;
- Generate bindings cannot rewrite AI/Compute state;
- PublishIntent cannot fabricate Creative registration;
- community objects cannot create Commons authority;
- derived charts/activities cannot establish canonical rights or awards;
- Awards records are isolated from Civic governance state;
- finalized AwardResult objects are immutable;
- award prize/payment state remains external to award legitimacy.

## Source reconciliation

The object model was reconciled against:

- `docs/architecture/420hz/HZ-GCA-1.1-PRODUCT-BOUNDARIES.md`
- `hz/config/gca-product-boundaries-v1.json`
- `contracts/src/creative/shared/CreativeTypes420.sol`
- `contracts/src/creative/music/WorkRegistry420.sol`
- `contracts/src/creative/music/RecordingRegistry420.sol`
- `contracts/src/ai/AIJobManager.sol`
- `docs/architecture/infrastructure/420ai-compute-infrastructure.md`
- `docs/compute-market/CMP-0.2-CANONICAL-COMPUTE-JOB-SCHEMA.md`
- `docs/420INDEXER.md`
- `docs/420SEARCH-GENESIS-CLOSEOUT.md`

Repository evidence establishes that Creative native IDs are typed `uint256` IDs, AI jobs bind bytes32 AI/compute references, Compute Market owns its own request/job identity, and Indexer/Search are non-authoritative projections. This HZ object model preserves those boundaries rather than flattening them into a duplicate schema.

## HZ-GCA-1.2 exit criteria

HZ-GCA-1.2 is complete when:

- Generate, Community and Awards each have explicit logical object vocabularies;
- every object declares one ID, authority class, visibility, mutability and reference edges;
- external protocol objects are reference-only and preserve native IDs;
- derived projections are explicitly non-authoritative;
- Awards-domain objects are explicitly separate from Civic governance;
- the machine verifier proves required type coverage and object-model invariants;
- no contract ABI, fixed address, deployment or live/testnet claim is invented;
- parent HZ-GCA-1 remains open.

Next work package after qualification:

**HZ-GCA-1.3 — Define Generate lifecycle**
