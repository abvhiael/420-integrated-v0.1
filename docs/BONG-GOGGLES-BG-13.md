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

### BG-13.1 — Bong Goggles media descriptor + canonical resolver — COMPLETE AND QUALIFIED

Implemented a deterministic versioned descriptor referenced by `BongGogglesMediaRegistry420.manifestHash`, exact owner/type/count/digest verification against canonical registry state, complete 420Storage object identity per item, derivative linkage, duplicate/tamper rejection, and a canonical-first manifest resolver. URLs, route metadata, credentials, tokens and session fields are rejected from the descriptor.

### BG-13.2 — upload preparation + ingest bridge — COMPLETE AND QUALIFIED

Implemented the application upload coordinator over the frozen 420Storage `v1` prepare/ingest boundary:

- translation from a verified Bong Goggles descriptor item to the exact 420Storage v1 object DTO;
- required agreement, capacity-reservation and commitment preconditions;
- fail-closed commitment matching between the storage precondition and descriptor object;
- deterministic descriptor/item-bound idempotency keys;
- prepare-plan validation so storage cannot silently change idempotency or commitment binding;
- ingest-receipt verification over upload ID, complete object identity, exact size and shard root;
- upload results explicitly marked non-authoritative presentation evidence;
- callback boundary that delegates bounded staging, byte hashing, running-provider discovery and sink delivery to the existing 420Storage coordinator rather than duplicating that protocol logic.

### BG-13.3 — canonical storage placement/seal orchestration — COMPLETE AND QUALIFIED

Implemented the canonical orchestration boundary over `StorageObjectManifestRegistry420`, `StorageAgreementRegistry420` and `StorageCommitmentRegistry420`:

- canonical manifest, agreement, commitment and placement reads;
- descriptor owner/object/shard identity checked against canonical storage state;
- active agreement, commitment, erasure-policy, root, size, node and placement provenance validated fail-closed;
- placement intent generation using the exact `registerPlacement(manifestId, shardIndex, agreementId, shardRoot, shardSizeBytes)` contract call;
- seal intent generation using `sealManifest(manifestId)` only after all declared placements exist;
- transaction intents explicitly non-authoritative and requiring user/wallet authorization;
- a sealed manifest is not delivery-ready unless canonical `isRetrievable(manifestId)` returns true;
- agreement effectiveness and commitment liveness retained as canonical readiness evidence.

### BG-13.4 — verified retrieval + Gateway delivery — COMPLETE AND QUALIFIED

Implemented the application delivery boundary above the frozen 420Storage developer API and 420Gateway:

- exact 420Storage v1 retrieve DTO generation from descriptor object identity;
- GET and HEAD delivery semantics;
- single HTTP-style byte ranges including open-ended and suffix ranges;
- full payload verification before any client range is sliced;
- exact returned object identity verification across object ID, manifest ID, shard index, shard root, byte size and commitment ID;
- exact byte-length verification and SHA-256 shard-root verification before bytes are marked verified;
- canonical delivery-readiness hook so a non-retrievable object can fail closed before Gateway retrieval;
- public access by explicit mode;
- private access default-deny unless a trusted application authorization callback revalidates subject/session and returns permission;
- only normalized `read` capability context is forwarded to 420Storage for private retrieval;
- Gateway/Cache tier, provider ID and node ID preserved only as non-authoritative route provenance;
- stable client-safe response envelopes with MIME type, range headers, verified flag and no provider credentials, filesystem paths or forwarded arbitrary headers.

### BG-13.5 — thumbnails, posters and transcodes — COMPLETE AND QUALIFIED

Implemented the Bong Goggles derivative coordinator above the existing 420Media protocol/node boundary:

- derivative roles are restricted to a launch-safe vocabulary: thumbnail, poster, preview, transcode and optional waveform;
- each enabled role must map to an operator-controlled configured `capabilityId`, `profileId` and output MIME type;
- Bong Goggles never supplies executable FFmpeg/GStreamer command fragments, codec flags, filesystem paths or source URLs;
- each source media item produces a deterministic opaque 32-byte input reference derived from its canonical 420Storage identity;
- media-job creation verifies the returned canonical job remains bound to the expected capability and opaque input reference;
- derivative collection accepts only successful 420Media result states with non-zero opaque result references;
- failed, expired, refunded, cancelled, incomplete or mismatched jobs fail closed;
- resolved derivative outputs must return complete 420Storage object identity and a MIME type matching the configured derivative profile;
- optional storage verification can require the returned 420Storage derivative reference to be canonically verified before the derivative is accepted;
- derivative items preserve explicit `derivativeOf` linkage to the immutable source item rather than overwriting the original identity;
- job ID, operator ID, opaque result reference and SLA evidence hash are retained as secret-free processing provenance.

### BG-13.6 — lifecycle, edits, deletion and privacy — COMPLETE AND QUALIFIED

Implemented the Bong Goggles media lifecycle/presentation policy above canonical social-object state:

- reads the current `BongGogglesSocialObjectRegistry420` object and exact `mediaRootAtVersion(objectId, version)` binding before deciding presentation eligibility;
- requires descriptor ownership to match the canonical social-object author;
- current normal delivery requires the requested media root to match both the requested canonical version and the object's current media binding;
- old versions remain auditable and retain immutable 420Store/420Storage history, but are not silently treated as current presentation media;
- `HIDDEN`, `DELETED` and `REMOVED` objects all stop normal media presentation while leaving canonical storage agreements, commitments, manifests, placements and proofs untouched;
- audience eligibility is re-evaluated for every active-current presentation request through the existing canonical `BongGogglesSocialPolicy420.canView` semantics rather than cached as permanent permission;
- private/follower/friend visibility therefore fails closed when current social relationships or profile state no longer authorize the viewer;
- retired/superseded derivatives can be excluded from active presentation through an explicit retirement policy while their original storage/provenance history remains intact;
- retention disposition separates tombstone/hidden/current/historical presentation state from immutable canonical storage history.

### BG-13.7 — production delivery closeout — IN PROGRESS

Implemented the Bong Goggles production delivery operations layer above the existing 420Gateway/420Cache routing and 420Storage verification boundary:

- immutable cache identity derived from complete verified 420Storage object identity rather than URL, provider, ETag or filename;
- verified public/current media may use `public, max-age=31536000, immutable`; private media is always `private, no-store`; unverified presentation media is `no-store`;
- responsive image/video candidates are selected only from the verified descriptor, limited to the original plus explicitly linked thumbnail/poster/preview/transcode derivatives in the same media family, and returned deterministically with canonical cache identity;
- request, success, failure, cache-tier, store-tier, p50/p95/p99 latency, integrity-failure and route-failure telemetry is retained as non-authoritative operations evidence;
- integrity failures and route/provider failures are classified separately so corrupted bytes are not mislabeled as transport failures;
- structured logs redact authorization, cookies, credentials, passwords, private keys, secrets, sessions and tokens before emission;
- failure-drill helpers require provider/cache/retrieval failures to actually be observed instead of treating unexpected success as a passing drill;
- bounded load qualification records request count, concurrency, failures and p95 latency against explicit budgets;
- launch readiness fails closed when a required drill/load qualification fails or unresolved integrity failures remain;
- the operator runbook is `docs/BONG-GOGGLES-BG-13-7-RUNBOOK.md` and requires exact-head Bong Goggles Media Verification, 420Docs Qualification and 420 Integrated Qualification before phase closeout.

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
11. Backend placement/seal planning never signs or executes canonical transactions; user/wallet authorization remains mandatory.
12. `isSealed` is not treated as synonymous with current retrievability; canonical `isRetrievable` is required for delivery readiness.
13. Byte-range responses never weaken integrity checking: the complete retrieved object is verified before the requested range is returned.
14. Gateway/Cache routing metadata is operational evidence only and cannot replace canonical object identity or application authorization.
15. Bong Goggles never converts requester-controlled strings into media-engine command lines; derivative execution is selected only through configured 420Media capability/profile mappings.
16. A 420Media result is not accepted as a Bong Goggles derivative until the job/input/capability binding and returned 420Storage identity have been validated.
17. Historical `mediaRootAtVersion` bindings remain auditable but do not automatically regain current presentation eligibility after an edit.
18. Hiding, deleting, removing or retiring presentation state never rewrites canonical storage commitments, placements or proof history.
19. Audience authorization is evaluated from current canonical social policy at delivery time; prior visibility is not treated as a durable access grant.
20. Immutable CDN/cache identity is derived from verified canonical 420Storage object identity; route/provider metadata never becomes the object key.
21. Private or unverified presentation media is never made publicly immutable-cacheable by the Bong Goggles operations layer.
22. Operational metrics, drills, load results and launch-readiness decisions are evidence only and cannot override canonical media/storage/social state.
23. Structured production logs must redact secrets/session/authorization material before emission.

BG-13 is developed on `feature/bong-goggles-bg13-media-storage` after Phase 12 merged to `main` in PR #307.
