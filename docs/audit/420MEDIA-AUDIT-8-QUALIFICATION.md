# 420Media — MEDIA-AUDIT-8 qualification evidence

## Step

**MEDIA-AUDIT-8 — Search, Notifications and indexing projections**

Status: **COMPLETE**

Qualification level: **Level 1 — app-scoped fast qualification**

## Authoritative implementation

- implementation SHA: `acbb99e2485c9565598eb723ee1f97492478a52d`
- current main SHA at closeout review: `721a7f358e802bce91835851721eb93c4340f501`
- original audit baseline SHA: `d86a3810d2901dc1082b65dc9061896c46e1911d`
- audit branch: `audit/420media-complete-20261006`
- active PR: **#536**

## Canonical definition

MEDIA-AUDIT-8 requires:

- public-only Media discovery/projection into 420Search;
- opt-in provenance-preserving 420Notifications;
- finality/reorg/rebuild qualification;
- privacy-negative qualification;
- Search and Notifications to remain non-authoritative projection/delivery layers.

All canonical repository-scope requirements are satisfied.

## Implementation completed

### Public-only Search projection

Added `media/projection/search.go`.

A Media asset can become a Search result only when:

- local Media state is `READY`;
- visibility is exactly `PUBLIC`;
- the existing Media Rights publication authority succeeds;
- Indexer source status is explicitly qualified;
- chain identity is nonzero;
- indexed/safe/finalized cursors are internally valid;
- block provenance is present;
- declared head/safe/finalized status does not exceed the corresponding qualified Indexer cursor.

The projection uses the existing 420Search result contract:

- domain: `asset`;
- source: `420Indexer`;
- mode: `discovery`;
- category: `media_asset`;
- stable source key: `media:<asset-id>`.

No shared Search source/domain schema or Search-owned canonical state was introduced.

Projected results preserve:

- chain ID;
- block number/hash;
- transaction hash;
- log index;
- indexed height;
- finalized height;
- finality class;
- indexed timestamp;
- explicit non-authoritative authority description.

Ranking and sponsorship remain non-canonical.

### Rebuildable indexing projection

Added `media/projection/index.go`.

The Media projection index supports:

- deterministic upsert/delete;
- non-finalized rollback;
- finalized-height retention;
- finalized-history conflict detection;
- legitimate forward canonical evolution after a finalized object state;
- deterministic full rebuild;
- duplicate canonical block/log rejection;
- stable Search result identity;
- disposable/rebuildable derived state.

Rollback below the retained finalized boundary fails closed.

A same-position finalized provenance rewrite fails closed.

Forward canonical changes after a finalized prior state remain valid rather than being incorrectly classified as finalized-history corruption.

### Opt-in Notifications

Added `media/projection/notifications.go`.

Subscriptions are:

- explicitly opt-in;
- reversible;
- topic-scoped;
- channel-scoped;
- severity-scoped;
- minimum-finality scoped;
- independently promotional-consent scoped;
- private Media application state.

Notifications are generated only from valid public Media Search projections.

Every delivered notification retains:

- Search result ID;
- source block hash;
- transaction hash;
- log index;
- finality;
- topic;
- severity;
- channel.

Notification IDs are deterministic over the user/topic/source provenance tuple.

Replay of an already-delivered source event produces no second delivery.

Promotional delivery requires separate `PromotionalOptIn=true`.

### Reorg retractions

`RetractBlock` emits at most one deterministic retraction per previously delivered notification derived from an orphaned block.

Retractions:

- preserve source provenance;
- are idempotent;
- alter only non-canonical presentation/delivery state;
- do not mutate Media/Storage/Rights/Search/chain state;
- do not block or reverse the underlying canonical operation.

## Privacy/security boundaries

PASS:

- PRIVATE assets cannot become Search results;
- UNLISTED/restricted/not-ready/deleted state is excluded by the READY+PUBLIC gate;
- Rights-denied publication fails closed;
- unqualified Indexer status fails closed;
- impossible safe/finalized cursor relationships fail closed;
- projected block above safe/finalized cursor fails closed;
- Search result ranking remains non-canonical;
- notification subscriptions/history are not inserted into Search results;
- notification provider state is not protocol authority;
- promotional consent is independent;
- weak-finality events cannot satisfy stronger-finality subscriptions;
- notification replay is delivery-deduplicated;
- reorg retraction is single-use/idempotent;
- finalized projection history cannot be rolled back;
- duplicate canonical block/log rebuild input fails closed;
- projection rebuild never mutates canonical Media state.

## Files introduced or changed for this step

- `media/projection/search.go`
- `media/projection/index.go`
- `media/projection/notifications.go`
- `media/projection/projection_test.go`
- `docs/420-MEDIA-PROJECTIONS.md`
- `scripts/verify-420media-audit.py`
- `.github/workflows/420media-audit.yml`
- `docs/420MEDIA-AUDIT.md`

## Search dependency qualification

MEDIA-AUDIT-8 consumes the existing 420Search result and architecture contracts but does not change shared Search source.

The Media fast workflow therefore adds the directly applicable interface/dependency check:

`go test ./search/architecture ./search/result -count=1`

This passed on the exact implementation SHA.

A full 420Search repository audit rerun is not required because Search source/runtime/schema was not changed.

## CI diagnosis history

Three superseded candidates are not qualification evidence.

1. An early candidate failed to build because the projector declared a publication-only interface but called a Storage helper requiring the broader publication+reuse interface.
   - classification: **implementation interface-shape defect**;
   - repair: enforce the already-qualified local READY+PUBLIC predicate, then call the publication-only authority directly;
   - no authorization was weakened.

2. The next exact candidate failed the changed-surface gofmt gate for `notifications.go`.
   - classification: **formatting/CI hygiene defect**;
   - repair: gofmt-only source normalization;
   - downstream skipped steps were not treated as passing evidence.

3. The following candidate reached substantive tests and exposed an index correctness bug:
   - a finalized prior object state incorrectly blocked a legitimate later canonical update;
   - classification: **implementation logic defect**;
   - repair: finalized conflict now rejects backward or same-position provenance rewrites while allowing forward canonical evolution;
   - the adversarial test was preserved and passed after repair.

## Exact-head Level 1 qualification

Workflow: **420Media audit**

- run: **37515368608**
- run number: **87**
- job: **112446804084**
- exact implementation SHA assertion: **PASS**
- canonical Media audit verifier: **PASS**
- changed-surface gofmt gate: **PASS**
- GEN-SVC feature contract validator: **PASS**
- `go test ./media/... ./cmd/420media-node`: **PASS**
- `go test ./search/architecture ./search/result -count=1`: **PASS**
- `go vet ./media/... ./cmd/420media-node`: **PASS**
- Media Solidity build: **PASS**
- retained `MediaPhase1*420.t.sol` suite: **PASS**
- Media Anvil integration: **PASS**
- workflow conclusion: **SUCCESS**

## Current-main dependency review

Current `main` advanced materially during MEDIA-AUDIT-8 and is now:

`721a7f358e802bce91835851721eb93c4340f501`

The audit branch is behind current main, but the new main changes are:

- Compute Market CMP-4 scientific/research extensions;
- PuffBuddies work;
- repository/global CI optimization.

The current-main delta does **not** change:

- `media/**`;
- 420Search architecture/result contracts consumed by this step;
- 420Indexer public projection interfaces consumed by this step;
- Notifications architecture used by this step;
- GEN-SVC Media service dependency declaration.

Therefore current-main reconciliation is not required for MEDIA-AUDIT-8 Level 1 qualification.

The Compute changes do affect a previously completed Media dependency area and must be reconciled with the accumulated Media branch at the mandatory Level 3 closeout before monolithic merge. They do not invalidate this step's Search/Notifications implementation evidence.

## Level 2 status

No new Level 2 milestone is documented or required.

MEDIA-AUDIT-8 adds an app-local projection/delivery layer and consumes existing Search/Indexer/Notifications contracts without modifying those shared services.

The retained MEDIA-AUDIT-5 Level 2 milestone remains the latest app integration milestone.

## Intentionally deferred Level 3 checks

Deferred to MEDIA-AUDIT-11:

- reconcile complete accumulated Media work with then-current `main`;
- reconcile any newer Compute dependency changes against MEDIA-AUDIT-7;
- canonical full repository Solidity inventory;
- Genesis/address-authority qualification;
- 420 Integrated/global qualification;
- Docs/global reconciliation;
- affected client/service/Indexer/Search/RPC/frontend/backend full integration suite;
- final security/adversarial/invariant/static/deployment/config qualification;
- exact accumulated merge-candidate qualification.

## Deferred live/release evidence

- live qualified 420Indexer and 420Search endpoint binding — MEDIA-AUDIT-12;
- real reorg/rebuild behavior against production-equivalent chain/indexer infrastructure — MEDIA-AUDIT-12;
- real 420Notifications provider delivery/failover/retry evidence — MEDIA-AUDIT-12;
- public Media `/v1` search/subscription APIs — MEDIA-AUDIT-9;
- user-facing Search/Notifications preferences UX — MEDIA-AUDIT-10;
- production service/Registry/Genesis publication — MEDIA-AUDIT-13.

## Exit criteria

- public-only Search projection: **SATISFIED**
- Rights publication gate preserved: **SATISFIED**
- qualified Indexer provenance/finality: **SATISFIED**
- non-authoritative Search boundary: **SATISFIED**
- opt-in Notifications: **SATISFIED**
- provenance-preserving notifications: **SATISFIED**
- promotional consent separation: **SATISFIED**
- deterministic delivery dedupe: **SATISFIED**
- finality thresholding: **SATISFIED**
- reorg retraction: **SATISFIED**
- non-finalized rollback: **SATISFIED**
- finalized conflict protection: **SATISFIED**
- deterministic rebuild: **SATISFIED**
- duplicate canonical log rejection: **SATISFIED**
- privacy-negative coverage: **PASS**
- directly affected Search contract tests: **PASS**
- retained Media regressions: **PASS**
- exact-head qualification: **PASS**
- durable documentation: **SATISFIED**

## Blockers

None for MEDIA-AUDIT-8 repository Level 1 completion.

## Next canonical roadmap step

**MEDIA-AUDIT-9 — Stable /v1 API and typed SDK**
