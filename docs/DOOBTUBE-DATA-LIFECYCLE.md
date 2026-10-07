# DoobTube — data, storage, media-processing and lifecycle architecture

Roadmap step: **DOOBTUBE-3 — Data, storage, media-processing and lifecycle architecture**
Status: **ADOPTED**
Date: 2026-10-06

## 1. Purpose

DOOBTUBE-3 freezes the V1 data model, ownership boundaries, lifecycle/state machines, idempotency semantics, persistence classes and recovery behavior for DoobTube.

This step deliberately **reuses the repository-qualified 420Media / 420Storage / 420 Compute Market architecture**. It does not create a second MediaAsset authority, Storage namespace, transcoding scheduler, livestream authority, Search index authority or payment/compute settlement path.

## 2. Canonical ownership decision

### 2.1 Reuse decision

DoobTube V1 reuses:

- 420Media for MediaAsset/Stream application lifecycle;
- 420Storage / Resource Protocol for canonical object/storage identity and retrievability;
- 420Rights for rights/provenance state;
- 420 Compute Market **through 420Media** for processing-job/provider/funding/entitlement semantics;
- 420Search for rebuildable public discovery projection;
- 420Notifications for opt-in delivery/subscription state.

No DoobTube-owned contract, storage protocol, media registry, compute scheduler or canonical index is introduced by DOOBTUBE-3.

### 2.2 DoobTube-owned data

DoobTube may own only replaceable application state such as:

- route/UI state;
- local view preferences;
- in-memory retry context;
- non-authoritative home-feed composition;
- cached public presentation;
- optional local block/mute presentation preferences;
- app presentation metadata that the owning Media API explicitly permits.

All such data must be disposable/rebuildable without invalidating protocol ownership or Media lifecycle.

## 3. Canonical V1 object model

### DT-DATA-OBJ-001 — MediaAsset

Canonical object class: **MediaAsset**.

DoobTube does not mint a parallel media object ID.

The application consumes the 420Media asset identity and its associated complete Storage object reference.

Required Media/Storage identity fields conceptually include:

- stable Media asset ID;
- owner/creator reference;
- video MIME type;
- visibility;
- Media lifecycle state;
- Media revision;
- provenance reference;
- optional derivative-of Media asset ID;
- complete Storage object identity:
  - object ID;
  - manifest ID;
  - shard index;
  - shard root;
  - size bytes;
  - commitment ID.

Provider/node/service/upload IDs are transport/processing references and do not replace canonical object identity.

### DT-DATA-OBJ-002 — Stream

Canonical object class: **Stream**.

DoobTube uses the Media stream/session authority already anchored to `MediaStreamRegistry420` plus the qualified 420Media livestream service.

Application-visible stream/session data may include:

- session ID;
- canonical stream reference;
- controller presentation;
- protocol/direction;
- safe endpoint/reference metadata;
- desired-live state;
- runtime state;
- reconnect-attempt count;
- bounded failure presentation;
- timestamps.

Raw stream payloads and resolved credentials remain outside DoobTube/Media presentation state.

### DT-DATA-OBJ-003 — Subscription

Canonical object class: **Subscription**.

DoobTube creator-update subscription is a Notifications-owned preference/delivery object.

It is not:

- ownership;
- access entitlement;
- paid membership;
- Rights state;
- creator authority.

### DT-DATA-OBJ-004 — Rights/provenance reference

DoobTube stores/displays references to canonical Rights/Media provenance but never duplicates Rights canonical truth.

### DT-DATA-OBJ-005 — Projection item

Feed/Search cards are rebuildable presentation records derived from qualified public Media projection.

A projection item is never a canonical MediaAsset.

## 4. MediaAsset lifecycle

DoobTube adopts the existing qualified 420Media lifecycle exactly:

```text
DRAFT
  |
  | PrepareUpload + exact plan/precondition verification
  v
PREPARED
  |
  | verified ingest receipt
  v
UPLOADED
  |
  | canonical manifest/readiness verification
  v
READY
  |
  | canonical-aware delete/retirement success
  v
DELETED
```

### DT-LIFE-ASSET-001 — DRAFT

DRAFT means Media has an application asset definition but upload preparation has not successfully completed.

No prepared upload identity may be fabricated locally.

### DT-LIFE-ASSET-002 — PREPARED

PREPARED requires exact verified upload preparation.

The prepared plan must preserve the exact:

- Storage object reference;
- idempotency key;
- preconditions;
- upload identity;
- provider/node/service identity.

A substituted plan fails closed.

### DT-LIFE-ASSET-003 — UPLOADED

UPLOADED means the qualified ingest boundary accepted the exact prepared object and returned a matching receipt.

UPLOADED is **not** canonical readiness.

DoobTube must never display transport acceptance as READY/publication completion.

### DT-LIFE-ASSET-004 — READY

READY requires canonical Storage manifest evidence for the exact object:

- correct API/schema version;
- exact object/manifest identity;
- sealed manifest;
- retrievable state;
- valid shard relationship;
- enough placed shards;
- exact live shard match;
- matching shard root;
- matching byte size;
- matching commitment ID.

### DT-LIFE-ASSET-005 — DELETED

DELETED means successful canonical-aware Media deletion/retirement has removed the asset from Media presentation/projection.

It does **not** mean immutable chain agreements, commitments, manifests, proofs, settlements or audit history were erased.

## 5. Upload preparation and canonical Storage references

### DT-STORAGE-001 — Complete object identity

DoobTube must not construct Storage identity from:

- filename;
- endpoint URL;
- provider ID;
- S3-style ETag;
- local upload ID;
- playback URL.

Only the complete canonical Storage object identity supplied/validated by qualified Media/Storage is authoritative.

### DT-STORAGE-002 — Commitment/precondition binding

Upload preparation must preserve the canonical agreement/capacity/commitment preconditions required by Media.

The precondition commitment must match the Storage object commitment.

### DT-STORAGE-003 — Raw bytes boundary

Raw video/audio bytes remain off-chain.

DoobTube may pass bytes to the exact qualified upload transport endpoint from the Media upload plan.

DoobTube must not persist raw upload bytes in canonical application state.

### DT-STORAGE-004 — Provider transport is not authority

Provider/node/route success is transport evidence only.

Canonical readiness remains Storage/Resource + Media gated.

## 6. Integrity and provenance

### DT-INTEGRITY-001 — Content integrity

The client may compute the upload digest required by qualified Media preparation, but the digest is evidence/input, not alone canonical Storage readiness.

### DT-INTEGRITY-002 — Provenance preservation

Every Media asset requires a provenance reference under the owning Media/Rights architecture.

DoobTube must preserve, not rewrite, provenance references across:

- upload;
- publication;
- derivative presentation;
- Search projection;
- export.

### DT-INTEGRITY-003 — Derivative identity

A derivative is a separate Media asset with:

- its own Media asset ID;
- its own complete Storage object identity;
- a non-self-referential `DerivativeOf` source link;
- preserved owner boundary;
- its own provenance reference.

A derivative never overwrites the source asset identity.

## 7. Transcodes, thumbnails, posters and previews

### DT-DERIV-001 — Processing products are derivatives

Transcodes, thumbnails, posters and previews are treated as derivative/output artifacts associated with the source asset.

DoobTube does not treat a presentation URL as the derivative's canonical identity.

### DT-DERIV-002 — Processing authority

DoobTube does not directly schedule Compute providers in V1.

420Media owns the Media-facing processing integration and binds canonical Compute state where processing uses the Compute Market.

### DT-DERIV-003 — Processing evidence

Where Media exposes processing provenance, DoobTube may retain/display non-secret references such as:

- Media job ID;
- Compute job reference;
- output Media asset/reference;
- processing state;
- verification/evidence reference;
- qualified operator/provider presentation.

DoobTube must not manufacture Compute provider eligibility or settlement evidence.

### DT-DERIV-004 — Failed processing

A failed/unfinished derivative job must not mutate the source asset identity or readiness.

Source playback may continue if independently READY and authorized.

## 8. Processing-job lifecycle

DoobTube adopts a presentation-level processing state model over Media/Compute outcomes:

```text
NOT_REQUIRED
    |
    +--> REQUESTED
          |
          v
       PROCESSING
       /        \
      v          v
   SUCCEEDED   FAILED_RETRYABLE
      |          |
      v          +--> PROCESSING
OUTPUT_PENDING
      |
      | canonical output Storage/Media readiness
      v
OUTPUT_READY
```

Rules:

- REQUESTED/PROCESSING/SUCCEEDED Compute state never makes a derivative READY by itself;
- OUTPUT_READY requires the output's own Media/Storage readiness;
- retry preserves canonical job/output identity where the owning Media/Compute flow requires idempotency;
- terminal failure cannot silently replace the source asset.

## 9. Playback locators and manifests

### DT-PLAYDATA-001 — Playback locator is presentation metadata

A `playback_url` or manifest locator is non-authoritative transport/presentation metadata.

DoobTube does not derive one from a Storage object ID.

### DT-PLAYDATA-002 — Safe locator validation

Only locators accepted by the qualified Media/client safety policy may be used.

Unsafe scheme/credential-bearing locators fail closed.

### DT-PLAYDATA-003 — Stale locator handling

A stale/failed playback locator changes playback presentation state only.

It does not mutate:

- Media asset ownership;
- READY/DELETED state;
- Rights;
- Storage identity.

The client may request a refreshed locator from Media.

### DT-PLAYDATA-004 — No manifest authority promotion

A playback manifest does not become canonical Storage or Rights authority merely because playback succeeds.

## 10. Visibility and privacy lifecycle

V1 visibility choices remain:

- PRIVATE;
- UNLISTED;
- PUBLIC.

### DT-PRIVDATA-001 — PRIVATE

PRIVATE is default-deny.

Public Search/feed/projection must exclude it.

Protected read behavior requires owning-service authorization; client route state alone is insufficient.

### DT-PRIVDATA-002 — UNLISTED

UNLISTED may be accessed by an authorized/direct reference under owning-service rules but is not public Search/feed discoverable.

A copied URL does not convert UNLISTED to PUBLIC.

### DT-PRIVDATA-003 — PUBLIC

PUBLIC becomes public-discovery eligible only when:

- Media asset is READY;
- visibility is PUBLIC;
- Rights/publication authorization succeeds where required;
- projection provenance/finality rules are satisfied.

### DT-PRIVDATA-004 — Visibility revocation

When an asset becomes ineligible for public presentation:

- DoobTube must stop treating stale Search/feed cache as authorization;
- derived public projections must retract/rebuild according to canonical projection semantics;
- direct access must revalidate against current Media/authorization state.

## 11. Delete and retention lifecycle

### DT-DELETE-001 — Delete requires owning-service success

DoobTube sends an authorized delete/removal request through Media.

No configured canonical-aware deleter means delete is unsupported.

### DT-DELETE-002 — Failure preserves prior state

Delete failure cannot tombstone a still-live asset.

The pre-delete Media state remains authoritative until the owning service confirms deletion/retirement.

### DT-DELETE-003 — Historical retention truth

DoobTube must distinguish:

- removal from Media/public presentation;
- provider object deletion/retirement;
- immutable protocol/audit history.

The UI/export/API must not promise erasure of historical commitments/proofs/settlement records that canonical protocols retain.

## 12. Livestream identity and session lifecycle

### DT-STREAM-001 — Canonical controller

`MediaStreamRegistry420` remains authoritative for stream controller ownership.

A locally persisted controller is not sufficient for create/start/recovery authorization.

### DT-STREAM-002 — Persisted session record

420Media may persist the livestream service record needed for recovery:

- session ID;
- canonical stream reference/spec;
- controller snapshot for comparison;
- runtime state;
- desired-live flag;
- reconnect-attempt count;
- sanitized last-error presentation;
- timestamps.

Resolved credentials and raw media remain outside persistent session state.

### DT-STREAM-003 — Session state machine

DoobTube adopts the qualified Media/gateway lifecycle conceptually:

```text
CREATED
  |
  v
STARTING
  |
  +----> ACTIVE
  |        |
  |        v
  |      STOPPING
  |        |
  |        v
  |      CLOSED
  |
  +----> FAILED
            |
            | bounded retry/recovery + controller revalidation
            v
         STARTING
```

### DT-STREAM-004 — Recovery

On service restart, desired-live sessions may be recovered only after:

- canonical stream authority re-read;
- controller match;
- non-retired state where start/recovery requires it;
- feature flag availability;
- reconnect-attempt bound.

Authorization drift or retirement fails recovery closed.

## 13. Search/index/projection lifecycle

### DT-PROJ-001 — Projection eligibility

Only qualified public-eligible Media records enter public DoobTube discovery.

At minimum, the retained Media boundary requires READY + PUBLIC + live Rights/publication authorization.

### DT-PROJ-002 — Projection provenance

Derived projection state must preserve qualified source provenance/finality sufficient for rebuild/reorg handling.

### DT-PROJ-003 — Reorg behavior

Non-finalized projection data may roll back to a common ancestor and replay canonical input.

A finalized-history conflict fails closed rather than silently rewriting retained finalized projection history.

### DT-PROJ-004 — Deterministic rebuild

Public Search/feed projection is discardable and deterministically rebuildable from canonical approved provenance inputs.

Duplicate canonical block/log provenance must not produce duplicate projection state.

### DT-PROJ-005 — DoobTube feed cache

A DoobTube home-feed cache is a second-order presentation cache over eligible derived data.

It may be deleted/rebuilt at any time and cannot widen visibility.

## 14. Subscription persistence

### DT-SUBDATA-001 — Notification-owned durable preference

Creator-update subscription durability belongs to the qualified Notifications integration, not a DoobTube-only browser flag.

Local optimistic UI may exist only while clearly pending confirmation.

### DT-SUBDATA-002 — Delivery state is non-canonical

Delivery receipts, retries and notification history do not mutate Media state.

## 15. Persistence classes

DoobTube/Media data is divided into four persistence classes.

### Class A — Canonical protocol/service state

Examples:

- Wallet/Smart Account authority;
- Media stream/controller contract state;
- Rights state;
- Storage object/manifest/commitment state;
- Compute/Pay canonical evidence.

Rule: must be read/revalidated from the owning authority.

### Class B — Durable Media application state

Examples:

- Media asset lifecycle/revision;
- upload preparation identity;
- livestream desired/runtime recovery record;
- Media moderation history;
- canonical dependency references retained by Media.

Rule: durable, restart-safe, but not promoted beyond Media's authority class.

### Class C — Rebuildable derived state

Examples:

- Search projections;
- feed indexes;
- public discovery cache;
- recommendation/ranking presentation.

Rule: disposable/rebuildable; never authorization.

### Class D — Ephemeral client state

Examples:

- selected file;
- in-memory upload retry context;
- pending UI action;
- route state;
- playback UI state.

Rule: must not be the sole copy of canonical or durable authority-bearing state.

## 16. Idempotency model

### DT-IDEMP-001 — Upload prepare

Upload preparation uses a stable non-empty idempotency key bound to the exact request/object/preconditions.

Retry after a transport/preparation failure reuses the same identity when the original request is being retried.

### DT-IDEMP-002 — Upload identity

Provider failure must not cause DoobTube to silently rotate object identity merely to appear successful.

### DT-IDEMP-003 — API mutations

Later DOOBTUBE-5 API mutations must use the stable Media/API replay-safe idempotency convention where supported.

A repeated idempotency key with a different semantic payload must fail rather than execute as a new action.

### DT-IDEMP-004 — Livestream actions

Create/start/stop retry behavior must preserve the Media service's duplicate/session/state-transition rules.

An ambiguous start/stop failure requires status revalidation before retry.

### DT-IDEMP-005 — Processing/settlement

DoobTube does not implement independent Pay/Compute idempotency.

420Media's canonical adapter/replay protections remain authoritative.

### DT-IDEMP-006 — Projection replay

Replayed canonical projection inputs must not duplicate Search/feed output.

## 17. Recovery model

### DT-REC-001 — Prepare failure

No PREPARED state is created if upload preparation fails.

### DT-REC-002 — Ingest failure

Asset remains PREPARED and the same prepared/upload identity remains retryable.

### DT-REC-003 — Storage canonical-read failure

Asset remains UPLOADED.

A later successful canonical reread may advance the same asset to READY.

### DT-REC-004 — Processing interruption

Processing remains pending/failed according to Media/Compute state.

DoobTube must not force derivative READY or mint replacement authority.

### DT-REC-005 — Playback failure

Refresh playback locator/presentation state; do not mutate asset authority.

### DT-REC-006 — Livestream restart

Recover only persisted desired-live sessions, subject to fresh canonical controller/feature/retry checks.

### DT-REC-007 — Search/index corruption

Discard derived projection and deterministically rebuild.

### DT-REC-008 — Delete failure

Preserve prior Media asset state.

### DT-REC-009 — App/client restart

Ephemeral DoobTube state may be lost.

The application reconstructs from Media/owning services and must not require local browser state to recover canonical ownership/lifecycle.

## 18. Schemas frozen by DOOBTUBE-3

These are logical V1 schema contracts; exact wire structs belong to DOOBTUBE-5.

### 18.1 MediaAssetView

```text
MediaAssetView
- media_asset_id
- owner_ref
- optional creator_profile_ref
- mime_type
- visibility
- media_state
- revision
- provenance_ref
- optional derivative_of
- storage_object_ref
- optional playback_locator
- optional presentation_metadata
- current_authority/projection status
```

`storage_object_ref` is the complete qualified Storage identity, never a URL alias.

### 18.2 StorageObjectRef

```text
StorageObjectRef
- object_id
- manifest_id
- shard_index
- shard_root
- size_bytes
- commitment_id
```

### 18.3 UploadRetryContext

```text
UploadRetryContext
- idempotency_key
- exact_prepare_request
- selected_file_handle/in-memory file
- optional exact_upload_plan
- current_asset_id
- current_media_state
```

This is ephemeral DoobTube client state unless later runtime architecture explicitly places durable idempotency state in the service.

### 18.4 ProcessingView

```text
ProcessingView
- media_job_id
- source_media_asset_id
- role/type
- processing_state
- optional compute_job_ref
- optional output_media_asset_id
- optional verification/evidence_ref
- retryability
```

### 18.5 LivestreamView

```text
LivestreamView
- session_id
- stream_ref
- controller_ref
- state
- desired_live
- reconnect_attempts
- sanitized_last_error
- created_at
- updated_at
- optional started_at
- optional ended_at
```

### 18.6 ProjectionView

```text
ProjectionView
- source_media_asset_id
- public presentation fields
- source provenance/finality
- projection revision/cursor
- ranking/presentation metadata
```

Ranking/presentation metadata is non-authoritative.

## 19. Data that must never be persisted as DoobTube authority

- private keys;
- seed phrases;
- mnemonics;
- recovery secrets;
- raw media bytes as canonical app state;
- resolved livestream secrets/keys;
- private Storage sessions as public/cache state;
- unverified provider filesystem state;
- Search ranking as canonical status;
- playback URL as object identity;
- local Wallet address as proof of Media ownership;
- app-local moderation flag as a canonical Rights or Arbitration ruling.

## 20. Cross-lifecycle invariants

- **DT-LIFE-INV-001:** DoobTube reuses 420Media asset/stream lifecycle; no parallel canonical media lifecycle exists.
- **DT-LIFE-INV-002:** complete Storage object identity is preserved; URLs/provider IDs never substitute for it.
- **DT-LIFE-INV-003:** PREPARED/UPLOADED transport state never equals READY.
- **DT-LIFE-INV-004:** READY requires canonical sealed/retrievable Storage evidence.
- **DT-LIFE-INV-005:** derivatives are separate assets and cannot overwrite/self-reference the source.
- **DT-LIFE-INV-006:** Compute completion alone cannot make derivative output READY.
- **DT-LIFE-INV-007:** playback locators/manifests are presentation metadata, not canonical authority.
- **DT-LIFE-INV-008:** public projection cannot widen PRIVATE/UNLISTED visibility.
- **DT-LIFE-INV-009:** deletion failure preserves prior state and deletion never claims immutable history erasure.
- **DT-LIFE-INV-010:** persisted livestream recovery revalidates canonical controller authority.
- **DT-LIFE-INV-011:** Search/feed projections are rebuildable and reorg-aware.
- **DT-LIFE-INV-012:** retries preserve idempotent request/object identity instead of hiding failure through identity mutation.
- **DT-LIFE-INV-013:** DoobTube client/browser state is never the sole durable authority for lifecycle recovery.
- **DT-LIFE-INV-014:** raw media and credentials remain outside canonical DoobTube application state.

## 21. Deferred implementation details

DOOBTUBE-3 freezes architecture, not runtime implementation.

Deferred:

- exact HTTP wire schema and endpoint layout — DOOBTUBE-5;
- concrete database technology/migrations — DOOBTUBE-5;
- actual media-processing workers/codec profiles — DOOBTUBE-6;
- live playback/CDN/provider integration — DOOBTUBE-6;
- concrete browser persistence decisions — DOOBTUBE-7 subject to this document;
- end-to-end cross-service qualification — DOOBTUBE-8;
- full abuse/security closeout — DOOBTUBE-9;
- production storage/backup/restore/retention runbooks — DOOBTUBE-10/12/13.

These deferrals do not leave the canonical ownership/lifecycle/idempotency/recovery model undefined.

## 22. Exit decision

DOOBTUBE-3 is satisfied when:

1. media asset identity and ownership are explicit;
2. upload preparation and canonical Storage reference semantics are explicit;
3. integrity/provenance handling is explicit;
4. transcode/thumbnail/poster/preview ownership is explicit;
5. playback locator/manifest authority is explicit;
6. lifecycle/delete/privacy semantics are explicit;
7. stream/session identity and recovery are explicit;
8. processing-job ownership/state is explicit;
9. rebuildable projection/reorg behavior is explicit;
10. persistence classes are explicit;
11. schemas are frozen at the logical V1 level;
12. idempotency/recovery rules are explicit;
13. reuse of 420Media/Storage/Compute is explicit;
14. the DoobTube verifier qualifies these invariants on the exact implementation SHA.

**Next canonical roadmap step: DOOBTUBE-4 — Contracts and protocol adapters.**
