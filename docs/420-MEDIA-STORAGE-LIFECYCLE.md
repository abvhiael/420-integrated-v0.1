# 420Media — 420Storage video upload and media-asset lifecycle

Roadmap step: **MEDIA-AUDIT-4 — 420Storage video upload and media-asset lifecycle**

## Purpose

MEDIA-AUDIT-4 implements the Genesis `video_uploads` foundation without creating a second storage authority.

420Storage is the versioned developer/runtime adapter. Canonical object, agreement, commitment, manifest, placement, proof and settlement state remains owned by 420Store / the Resource Protocol. Raw video bytes remain off-chain.

The Media application therefore owns only its application-facing asset lifecycle and references. A successful developer upload is transport evidence; it is never promoted to canonical storage state.

## Media asset model

The Media-owned `Asset` model records:

- stable Media asset ID;
- creator/owner reference;
- video MIME type;
- complete 420Storage `ObjectRef`;
- canonical GEN-SVC visibility scope;
- provenance reference;
- optional `DerivativeOf` Media asset ID;
- selected upload/provider/node/service identifiers;
- Media lifecycle state and revision.

The object reference remains the full Storage v1 identity:

- `object_id`;
- `manifest_id`;
- `shard_index`;
- `shard_root`;
- `size_bytes`;
- `commitment_id`.

Media never substitutes an endpoint, filename, S3 ETag, provider ID or local upload ID for canonical object identity.

## Lifecycle

```text
DRAFT
  | 420Storage PrepareUpload + exact plan verification
  v
PREPARED
  | verified ingest transport receipt
  v
UPLOADED
  | canonical manifest read:
  | exact object/manifest identity
  | sealed
  | retrievable
  | matching live shard root/size/commitment
  v
READY
  | canonical-aware delete/retirement succeeds
  v
DELETED
```

### DRAFT -> PREPARED

Preparation requires:

- video MIME type;
- complete object identity;
- non-empty Media owner and provenance references;
- valid GEN-SVC visibility;
- non-empty idempotency key;
- agreement, capacity-reservation and commitment preconditions;
- the precondition commitment must equal the object commitment.

The 420Storage upload plan must echo the exact object, idempotency key and preconditions and must identify a provider, node and service. Any substitution fails closed.

### PREPARED -> UPLOADED

The Media coordinator passes the exact prepared plan to an ingest boundary.

The receipt must match:

- API version;
- upload ID;
- full object identity;
- exact byte size;
- shard root;
- provider ID;
- node ID;
- service ID.

An ingest failure leaves the asset PREPARED with the same upload identity so the exact idempotent plan can be retried. Media does not rotate object identity merely to hide a failed provider write.

### UPLOADED -> READY

READY is canonical-state gated.

The canonical manifest reader must return the requested manifest and prove:

- Storage API/schema version v1;
- exact manifest ID and object ID;
- manifest sealed;
- manifest currently retrievable;
- valid data/total shard relationship;
- enough placed shards for the data-shard threshold;
- an exact shard-index match for the Media object;
- matching shard root;
- matching byte size;
- matching commitment ID;
- live shard state.

A Storage read outage preserves UPLOADED state and is retryable. A mismatched canonical object/commitment fails closed.

## Derivative linkage

A derivative remains a separate Media asset with its own complete Storage object identity.

`DerivativeOf` must point to a different existing Media asset ID. Source and derivative must preserve the same owner boundary, and both require provenance references.

This step establishes linkage semantics only. Compute/transcoding job orchestration and canonical Compute integration remain later roadmap work.

## Privacy and presentation

MEDIA-AUDIT-4 accepts the canonical GEN-SVC visibility scopes:

- PUBLIC
- UNLISTED
- FOLLOWERS
- COMMUNITY_ONLY
- PURCHASERS_OR_BACKERS
- PRIVATE
- ORGANIZATION_MEMBERS
- MODERATORS
- ADMINS

Only a READY + PUBLIC asset is eligible for public projection.

UNLISTED may use the public Storage retrieval mode when the application already possesses the object reference, but it is not eligible for public discovery/projection.

Every restricted visibility scope is default-deny and requires explicit subject + session information before Media creates a private 420Storage read request. Authorization remains owned by the relevant later Identity/Rights/application policy boundary; MEDIA-AUDIT-4 does not invent follower/community/purchaser authority.

## Deletion and retention semantics

420Storage v1 does not expose a universal native delete operation in its typed client. S3 DELETE is supported only when an explicit canonical-aware deleter is configured.

Media therefore fails closed:

- no deleter -> delete is unsupported;
- deleter failure -> Media remains in its prior state;
- only successful canonical-aware deletion/retirement changes the Media asset to DELETED.

DELETED means the Media application will no longer present/project the asset. It does not claim that historical chain agreements, commitments, proofs, manifests, settlements or audit evidence were erased. Canonical history remains immutable according to the Resource/Storage architecture.

## Failure recovery

The lifecycle is intentionally retryable without identity mutation:

- Prepare errors do not create PREPARED state.
- Ingest errors preserve PREPARED and the same upload/idempotency identity.
- Canonical manifest read outages preserve UPLOADED.
- A later successful canonical reread may advance the same asset to READY.
- Delete failures preserve the pre-delete state.
- Provider/route information never becomes canonical authority during recovery.

## Authority boundaries

420Media does not:

- mint Storage object identity;
- create or rewrite storage agreements, capacity reservations, commitments, placements or proofs;
- treat an upload receipt as a canonical placement;
- treat provider filesystem state as canonical retrievability;
- weaken private Storage authorization;
- erase immutable canonical history;
- create a second payment/storage settlement authority.

Those operations remain with 420Store/Resource, 420Vault and the qualified Storage runtime.

## Qualification invariants

- **MEDIA-STORAGE-INV-001:** upload preparation requires complete canonical Storage object identity and matching commitment preconditions.
- **MEDIA-STORAGE-INV-002:** a substituted object/upload plan fails closed.
- **MEDIA-STORAGE-INV-003:** ingest receipts must match the exact prepared object/provider/service identity.
- **MEDIA-STORAGE-INV-004:** provider upload success cannot make an asset READY.
- **MEDIA-STORAGE-INV-005:** READY requires sealed + retrievable canonical manifest state and an exact live shard match.
- **MEDIA-STORAGE-INV-006:** canonical read failure preserves retryable UPLOADED state.
- **MEDIA-STORAGE-INV-007:** ingest failure preserves retryable PREPARED state and the same upload identity.
- **MEDIA-STORAGE-INV-008:** public projection is limited to READY + PUBLIC.
- **MEDIA-STORAGE-INV-009:** restricted visibility fails closed without explicit private read subject/session context.
- **MEDIA-STORAGE-INV-010:** derivative linkage cannot self-reference or silently change the owner boundary.
- **MEDIA-STORAGE-INV-011:** deletion requires an explicit canonical-aware deleter.
- **MEDIA-STORAGE-INV-012:** failed deletion never tombstones a still-live Media asset.
- **MEDIA-STORAGE-INV-013:** deleting Media presentation never claims canonical historical Storage evidence was erased.
- **MEDIA-STORAGE-INV-014:** raw media bytes, credentials and private sessions are not stored in the Media asset record.

## Completion boundary

MEDIA-AUDIT-4 is complete when the Media Storage lifecycle, failure/privacy/derivative/delete tests, repository verifier and exact-head Media Level 1 workflow all pass together.

MEDIA-AUDIT-4 is not the documented Level 2 milestone. Broader Media integration qualification remains at MEDIA-AUDIT-5.
