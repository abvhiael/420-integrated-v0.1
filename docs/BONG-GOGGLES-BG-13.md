# Bong Goggles BG-13 — Media & Storage Delivery

BG-13 turns the existing Bong Goggles media references into a production media pipeline without creating a second storage or media protocol.

Canonical ownership remains split deliberately:

- `BongGogglesMediaRegistry420` owns the Bong Goggles `mediaRoot -> owner/mediaType/manifestHash/itemCount` registration.
- `BongGogglesSocialObjectRegistry420` binds a social-object version to a valid owner-controlled `mediaRoot`.
- 420Store / Resource Protocol owns canonical storage agreements, commitments, object manifests, placements, proofs and settlement.
- 420Storage is the frozen v1 HTTP/SDK/S3 adapter for upload transport and verified retrieval.
- 420Gateway / 420Cache / 420Repair are operational delivery/acceleration/recovery services and never override canonical state.
- 420Media owns transcoding, recording and other media-workload coordination; raw media, codec payloads and stream secrets stay off-chain.

## Phase roadmap

### BG-13.1 — Bong Goggles media descriptor + canonical resolver — IN PROGRESS

Define the off-chain Bong Goggles media-manifest descriptor referenced by `BongGogglesMediaRegistry420.manifestHash` and implement the resolver/verification boundary.

Required guarantees:

- deterministic versioned descriptor encoding and digest;
- owner, media type and item count must match the canonical Bong Goggles media manifest;
- each media item carries explicit 420Storage object identity rather than a URL or cache key;
- storage references include object ID, storage manifest ID, shard index, shard root, exact byte size and commitment ID;
- original and derivative relationships are explicit;
- descriptor resolution fails closed on missing/tampered/mismatched data;
- no Gateway/provider/cache route is treated as canonical identity;
- no private access/session secret is stored in the descriptor.

### BG-13.2 — upload preparation + ingest bridge

Build the application upload coordinator over the frozen 420Storage `v1` prepare/ingest boundary.

- calculate exact byte length and shard root before upload;
- require canonical agreement/capacity/commitment prerequisites supplied by the owning storage protocol;
- deterministic/idempotent upload requests;
- bounded staging and retry behavior;
- verify upload receipts but keep them explicitly non-authoritative;
- construct the media descriptor only from verified stored object references;
- prepare the `registerManifest` transaction payload only after every descriptor item is complete.

### BG-13.3 — canonical storage placement/seal orchestration

Integrate the application with 420Store manifest/placement state.

- read canonical agreement/commitment/object-manifest state;
- expose transaction intents for required placement/seal operations rather than granting the backend signing authority;
- verify retrievability threshold before a media object is declared delivery-ready;
- preserve provider/node/commitment provenance;
- fail closed on agreement, root, size, placement or proof mismatch.

### BG-13.4 — verified retrieval + Gateway delivery

Build the delivery resolver from Bong Goggles `mediaRoot` to 420Storage object references and Gateway retrieval.

- GET/HEAD and byte-range support;
- exact size + SHA-256 shard-root verification;
- public/private access modes with default-deny private access;
- no forwarding headers promoted to identity;
- Cache/Gateway route failover remains operational metadata;
- stable client-safe delivery envelopes without exposing provider credentials or filesystem paths.

### BG-13.5 — thumbnails, posters and transcodes

Use 420Media jobs for bounded derivative generation.

- operator-controlled codec/profile vocabulary only;
- image thumbnails, video posters/previews and launch-safe video transcodes;
- optional audio waveform/preview derivatives where useful;
- derivative output references stored through 420Store/420Storage;
- derivative items linked to the original item in the Bong Goggles descriptor;
- job/result/SLA provenance retained without exposing raw processing telemetry or secrets.

### BG-13.6 — lifecycle, edits, deletion and privacy

Define application semantics across immutable storage history and mutable social presentation.

- social-object edits may point to a new `mediaRoot`; old historical version bindings remain auditable;
- deleted/removed/hidden social content must stop normal client delivery according to canonical social policy;
- storage deletion/retention is explicit and must not rewrite historical commitments/proofs;
- private media delivery revalidates audience/session authorization at request time;
- expired/superseded derivative references are removed from active delivery without falsifying canonical history.

### BG-13.7 — production delivery closeout

- CDN/cache policy over 420Gateway/420Cache;
- immutable asset caching keyed by verified object identity;
- responsive image/video source selection;
- health, latency, integrity-failure and route-failure metrics;
- structured logs with secret redaction;
- provider-loss/cache-loss/retrieval-failure drills;
- upload/retrieval/transcode load tests;
- operator runbook and launch qualification.

## BG-13 invariants

1. Media bytes, storage shards, decryption keys, push/session credentials and stream secrets never become Bong Goggles chain state.
2. A Bong Goggles `mediaRoot` is valid only when its canonical manifest exists and is owned by the expected profile.
3. A manifest descriptor is accepted only when its digest, owner, media type and item count match canonical registry state.
4. URLs, S3 ETags, cache keys, provider IDs and local filenames are never substituted for 420Storage object identity.
5. Upload receipts and runtime health are evidence only; they do not create canonical storage placement or proof state.
6. Retrieved bytes are not returned as verified media until exact size and shard-root validation succeeds.
7. Private media delivery is default-deny and authorization is revalidated at request time.
8. 420Media operators may process media but cannot gain social, wallet, storage-settlement or protocol authority by doing so.
9. Derivatives never overwrite the identity/history of their original media item.
10. A social-object lifecycle change can remove presentation eligibility without rewriting immutable storage/proof history.

BG-13 is developed on `feature/bong-goggles-bg13-media-storage` after Phase 12 merged to `main` in PR #307.
