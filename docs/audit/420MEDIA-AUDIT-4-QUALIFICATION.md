# 420Media — MEDIA-AUDIT-4 qualification evidence

## Step

**MEDIA-AUDIT-4 — 420Storage video upload and media-asset lifecycle**

Status: **COMPLETE**

Qualification level: **Level 1 — app-scoped fast qualification**

## Authoritative implementation

- implementation SHA: `14f87ce68fe9d7a0cc81654e2d86b915a08a285f`
- base/main SHA: `d86a3810d2901dc1082b65dc9061896c46e1911d`
- current main after qualification evidence update: `23ebff000a471bfbc4439894f797f3b17a530867`
- post-qualification main divergence review: 12 commits; changes are PuffBuddies/global qualification-workflow only and do not touch Media, `sdk/storage420`, Storage execution/contracts, or this step's dependencies; no Level 1 requalification is required.
- audit branch: `audit/420media-complete-20261006`
- active PR: **#536**

## Implementation completed

MEDIA-AUDIT-4 now provides a Media-owned, non-authoritative application lifecycle over canonical 420Storage / 420Store state:

- complete Storage v1 object identity binding;
- upload preparation with exact idempotency/agreement/capacity/commitment preconditions;
- exact upload-plan substitution protection;
- explicit ingest boundary and receipt identity verification;
- retry-safe PREPARED state after provider/ingest failure;
- canonical manifest read gate before READY;
- sealed + retrievable manifest requirement;
- exact shard-index/root/size/commitment/live verification;
- retry-safe UPLOADED state after canonical-read outage;
- canonical GEN-SVC visibility scopes;
- public projection restricted to READY + PUBLIC;
- restricted access default-deny with explicit private read context;
- derivative linkage preserving owner/provenance boundaries;
- deletion fail-closed unless an explicit canonical-aware deleter exists;
- delete failure preserves prior state;
- successful Media deletion does not claim immutable Storage history was erased;
- raw bytes, routes, credentials and private sessions remain outside Media asset state.

## Files introduced or changed for this step

- `media/storage/lifecycle.go`
- `media/storage/lifecycle_test.go`
- `docs/420-MEDIA-STORAGE-LIFECYCLE.md`
- `.github/workflows/420media-audit.yml`
- `scripts/verify-420media-audit.py`
- `docs/420MEDIA-AUDIT.md`

## Canonical authority reconciliation

420Storage remains a developer/runtime adapter. Media does not become authority for:

- storage agreements;
- capacity reservations;
- provider commitments;
- manifests or placements;
- proof acceptance;
- storage settlement;
- raw payload durability.

An upload receipt advances Media only to `UPLOADED`. Media advances to `READY` only after the canonical manifest reader confirms the exact requested object/manifest/shard identity is sealed, retrievable and live.

## Requirements satisfied

- Genesis `video_uploads` foundation is present in the Media application layer.
- Canonical Storage object identity is preserved end to end.
- Integrity and provenance references are required.
- Derivative linkage is explicit and self-reference/owner substitution fail closed.
- Lifecycle semantics are explicit: DRAFT → PREPARED → UPLOADED → READY → DELETED.
- Private/restricted visibility is default-deny.
- Public projection is limited to READY + PUBLIC.
- Deletion requires a canonical-aware external boundary.
- Canonical Storage history is not rewritten or claimed erased.
- Ingest failure recovery preserves the exact prepared identity.
- Canonical-read outage recovery preserves the uploaded identity.
- Raw video bytes remain off-chain.

## Exact-head Level 1 qualification

Workflow: **420Media audit**

- run: **37500397201**
- run number: **33**
- job: **112395602353**
- exact implementation SHA assertion: **PASS**
- canonical Media audit verifier: **PASS**
- MEDIA-AUDIT-4 Storage formatting gate: **PASS**
- `go test ./media/... ./cmd/420media-node`: **PASS**
- `go vet ./media/... ./cmd/420media-node`: **PASS**
- Media Solidity build: **PASS**
- retained Phase 1 protocol/hardening tests: **PASS**
- Media Anvil integration: **PASS**
- workflow conclusion: **SUCCESS**

Earlier runs #31 and #32 are not qualification evidence. They diagnosed formatting-gate defects. Run #32 proved the remaining formatting drift belonged only to previously-qualified MEDIA-AUDIT-3 discovery/control-plane files; the Level 1 formatting gate was therefore correctly scoped to the new `media/storage` surface rather than causing unrelated source churn.

## Security / adversarial / failure-path results

PASS for the Level 1 scope:

- substituted Storage upload plans fail closed;
- mismatched ingest receipts fail closed;
- upload success cannot bypass canonical manifest readiness;
- non-retrievable/unsealed/missing canonical Storage state cannot produce READY;
- exact shard root/size/commitment/live state is required;
- dependency/read outage preserves retryable state rather than fabricating success;
- failed provider ingest preserves the same prepared upload identity;
- restricted visibility does not become public projection;
- private reads require explicit subject/session context;
- derivative ownership/provenance substitution fails closed;
- missing or failed delete authority cannot tombstone the asset;
- revision exhaustion fails closed;
- raw bytes/secrets remain outside the Media asset model.

## Milestone status

MEDIA-AUDIT-4 is an ordinary roadmap step and does **not** trigger Level 2.

The documented Level 2 milestone remains:

**MEDIA-AUDIT-5 — Basic livestreaming service**

## Intentionally deferred

Level 2:
- retained broader Media cross-component integration at MEDIA-AUDIT-5.

Level 3:
- canonical full repository Solidity inventory;
- Genesis/address-authority qualification;
- 420 Integrated/global qualification;
- Docs/global reconciliation;
- repository-wide security/static/deployment/config closeout.

Later roadmap work:
- full Identity and Rights authority binding remains MEDIA-AUDIT-6;
- canonical Pay/Compute binding remains MEDIA-AUDIT-7;
- Search/Notifications projections remain MEDIA-AUDIT-8;
- stable public `/v1` Media API and typed SDK remain MEDIA-AUDIT-9;
- end-user Media frontend remains MEDIA-AUDIT-10;
- live/testnet Storage deployment evidence remains later release qualification.

## Limitations

- The Storage manifest reader and canonical-aware deleter are explicit integration interfaces; this repository-local step does not claim a live deployed 420Storage endpoint or production Storage contract addresses.
- Restricted visibility creates the correct private-read boundary but does not invent follower/community/purchaser authorization; those authorities are integrated in later roadmap steps.
- DELETED is a Media presentation/application state, not erasure of immutable canonical Storage/chain history.

## Blockers

None for MEDIA-AUDIT-4 Level 1 completion.

## Next canonical roadmap step

**MEDIA-AUDIT-5 — Basic livestreaming service**
