# DoobTube — DOOBTUBE-3 qualification evidence

Roadmap step: **DOOBTUBE-3 — Data, storage, media-processing and lifecycle architecture**
Qualification level: **Level 1 — app-scoped data/lifecycle architecture qualification**
Status: **COMPLETE**
PR: **#553**
Branch: `audit/doobtube-baseline-20261006`

## Implementation summary

DOOBTUBE-3 freezes the V1 data, storage, media-processing and lifecycle architecture in:

`docs/DOOBTUBE-DATA-LIFECYCLE.md`

The architecture explicitly reuses the repository-qualified 420Media / 420Storage / 420 Compute Market surfaces rather than creating parallel DoobTube authority.

## Canonical ownership decisions

- MediaAsset/Stream lifecycle remains 420Media-owned.
- Storage object/readiness authority remains 420Storage / Resource Protocol.
- Rights/provenance authority remains 420Rights.
- Compute scheduling/provider/funding/entitlement/settlement remains Media-owned through its qualified Compute integration.
- Search projections remain rebuildable derived state.
- Notifications retain subscription/delivery preference state.
- DoobTube owns only replaceable UI, feed, cache, preference and ephemeral retry state.

No DoobTube-owned contract, storage protocol, media registry, compute scheduler or canonical index is introduced.

## Canonical MediaAsset lifecycle adopted

```text
DRAFT -> PREPARED -> UPLOADED -> READY -> DELETED
```

Key frozen semantics:

- PREPARED requires an exact verified upload plan.
- UPLOADED means verified ingest transport receipt only.
- UPLOADED is not READY.
- READY requires exact sealed/retrievable canonical Storage manifest/shard/commitment evidence.
- DELETED requires successful canonical-aware Media delete/retirement.
- DELETED never claims immutable canonical Storage/protocol history was erased.

## Storage identity

DOOBTUBE-3 freezes the complete Storage object reference vocabulary:

- `object_id`
- `manifest_id`
- `shard_index`
- `shard_root`
- `size_bytes`
- `commitment_id`

Filename, endpoint, provider ID, local upload ID, ETag-like value and playback URL cannot substitute for canonical object identity.

## Derivative / processing architecture

Transcodes, thumbnails, posters and previews are modeled as derivative/output artifacts.

Rules frozen:

- derivatives are separate Media assets;
- source identity is never overwritten;
- derivative links cannot self-reference;
- owner/provenance boundaries must be preserved;
- DoobTube does not directly schedule Compute providers;
- Compute completion alone cannot make output READY;
- output requires its own Media/Storage readiness.

## Playback data

Playback locators/manifests are non-authoritative transport/presentation metadata.

A playback URL:

- does not become Storage object identity;
- does not become Rights authority;
- may be refreshed after failure;
- cannot mutate Media asset lifecycle by itself.

## Visibility/privacy lifecycle

V1 remains:

- PRIVATE;
- UNLISTED;
- PUBLIC.

PUBLIC discovery requires READY + PUBLIC + applicable Rights/publication authorization + qualified projection provenance/finality.

A direct UNLISTED URL does not make an asset PUBLIC/searchable.

Stale Search/feed cache cannot override current visibility/revocation state.

## Delete / retention semantics

- delete requests go through Media;
- unsupported canonical-aware deletion fails closed;
- failed delete preserves prior asset state;
- UI/API must distinguish presentation removal from immutable historical protocol evidence;
- DoobTube must not promise physical/historical erasure that the owning protocol does not guarantee.

## Livestream identity / recovery

`MediaStreamRegistry420` remains authoritative for stream controller ownership.

The qualified Media livestream session lifecycle is reused:

```text
CREATED -> STARTING -> ACTIVE -> STOPPING -> CLOSED
              \-> FAILED -> bounded recovery
```

Restart recovery requires:

- persisted desired-live state;
- fresh canonical controller re-read;
- controller match;
- valid stream lifecycle;
- feature availability;
- bounded reconnect attempts.

A locally persisted controller is not sufficient authority.

## Projection / index lifecycle

Public Search/feed projection is:

- public-only;
- provenance/finality aware;
- rollback/replay capable for non-finalized state;
- fail-closed on finalized-history conflict;
- deterministically rebuildable;
- duplicate-provenance safe;
- non-authoritative.

DoobTube feed cache is second-order presentation state and may be discarded/rebuilt at any time.

## Persistence classes

DOOBTUBE-3 freezes four persistence classes:

1. **Canonical protocol/service state** — must be read/revalidated from owning authority.
2. **Durable Media application state** — restart-safe Media lifecycle/recovery data.
3. **Rebuildable derived state** — Search/feed/projection data.
4. **Ephemeral client state** — selected file, in-memory retry context, route/playback/pending UI state.

Client/browser state can never be the sole durable authority for lifecycle recovery.

## Idempotency model

Frozen rules include:

- upload prepare uses a stable idempotency key bound to exact object/preconditions;
- ingest/provider failure preserves the same prepared identity;
- failed provider write must not trigger silent object-ID rotation;
- later mutation APIs must preserve Media replay-safe idempotency semantics;
- ambiguous livestream mutation requires state revalidation before retry;
- Pay/Compute idempotency stays with Media/owning protocols;
- projection replay cannot duplicate derived output.

## Recovery model

Explicit recovery rules cover:

- prepare failure;
- ingest failure;
- canonical Storage-read outage;
- processing interruption;
- playback failure;
- livestream restart;
- Search/index corruption;
- delete failure;
- application/client restart.

## Logical V1 schemas frozen

- `MediaAssetView`
- `StorageObjectRef`
- `UploadRetryContext`
- `ProcessingView`
- `LivestreamView`
- `ProjectionView`

Exact wire/database representation is intentionally deferred to DOOBTUBE-5.

## Files changed for DOOBTUBE-3

- `docs/DOOBTUBE-DATA-LIFECYCLE.md`
- `docs/DOOBTUBE-ROADMAP.md`
- `docs/DOOBTUBE-AUDIT.md`
- `scripts/verify-doobtube-baseline.py`

## Repository base

Current `main` / qualification base:

`ff4440bfd7b69c0712ee3dd7c4b417cb049ae76d`

The branch remained reconciled and 0 commits behind throughout DOOBTUBE-3.

## Level 1 qualification

Qualified implementation SHA:

`3de707202f51791e807b00e1707dc1b1fe7c1cfc`

Workflow: **DoobTube baseline audit**
Run: **37560004137**
Job: **baseline / 112594884601**
Result: **PASS**

Passed on the exact implementation SHA:

- exact PR-head checkout;
- exact implementation SHA assertion;
- DOOBTUBE-0 architecture invariants;
- DOOBTUBE-1 product-scope invariants;
- DOOBTUBE-2 dependency/trust invariants;
- DOOBTUBE-3 document and stable requirement IDs;
- exact Media lifecycle vocabulary DRAFT/PREPARED/UPLOADED/READY/DELETED;
- complete Storage object-reference vocabulary;
- canonical Media Storage lifecycle source assertions;
- canonical Media Pay/Compute boundary assertions;
- canonical Media livestream authority/recovery assertions;
- canonical Media projection rebuild/finality assertions;
- all original DOOBTUBE-3 categories;
- required lifecycle/recovery boundaries;
- logical V1 schemas;
- roadmap COMPLETE state;
- audit completion state;
- no second DoobTube/420Video service/contract/runtime authority;
- no false readiness claim.

No required DOOBTUBE-3 check was skipped, cancelled, missing or stale.

## Diagnosed superseded failures

### Run 37559896571 / job 112594552554

Exact implementation SHA:

`ccd8e4915bbf6af122eaa46381232a3a6cfd4159`

Result: **FAIL**

Classification: **test-harness defect**.

The exact-SHA assertion passed. A retained DOOBTUBE-2 verifier assertion still required the stale audit phrase:

`DOOBTUBE-0 through DOOBTUBE-2 are complete`

while the current audit correctly stated:

`DOOBTUBE-0 through DOOBTUBE-3 are complete`

The stale assertion was corrected.

### Run 37559953309 / job 112594727273

Exact implementation SHA:

`f794e96f5dff20ce124266ce19b421439433a097`

Result: **FAIL**

Classification: **test-harness/document-wording mismatch**.

The exact-SHA assertion passed. The verifier expected the unformatted phrase:

`MediaStreamRegistry420 remains authoritative for stream controller ownership`

while the repository document correctly contains:

``MediaStreamRegistry420`` remains authoritative for stream controller ownership.

The verifier was aligned to the exact repository wording. The authority requirement was not weakened.

No protocol, lifecycle, privacy, storage, Compute or recovery defect was found in either failed run.

## Security/adversarial/invariant result

DOOBTUBE-3 introduces no executable runtime, contract or custody surface.

Architecture-level invariants qualified:

- no parallel Media lifecycle;
- complete Storage identity preserved;
- transport state never equals readiness;
- READY requires canonical Storage evidence;
- derivative/source identity separation;
- Compute completion cannot bypass output readiness;
- playback locator is non-authoritative;
- public projection cannot widen visibility;
- failed delete cannot tombstone live media;
- livestream restart revalidates controller authority;
- projection state is rebuildable/reorg-aware;
- idempotent retries preserve identity;
- client state is not lifecycle authority;
- raw media/credentials remain outside canonical DoobTube app state.

No unresolved DOOBTUBE-3 lifecycle contradiction remains.

## Milestone status

DOOBTUBE-3 is an **ordinary Level 1 roadmap step**.

It freezes architecture but does not introduce implemented cross-component runtime behavior. Therefore Level 2 is not triggered.

The documented Level 2 milestone remains:

**DOOBTUBE-8 — Ecosystem integration milestone**

## Intentionally deferred Level 3 qualification

Per the phase policy, the following remain deferred until **DOOBTUBE-11 — Repository Level 3 exact-head closeout**:

- canonical full repository Solidity inventory;
- Genesis/address-authority qualification;
- 420 Integrated/global qualification;
- Docs/global reconciliation;
- unrelated app audits;
- global fault/soak qualification;
- final client/service/Indexer/Search/RPC/frontend/backend suite;
- final static/security/deployment/config/build/lint/type closeout.

These are not blockers for this ordinary architecture step.

## Limitations and blockers

No blocker remains for DOOBTUBE-3.

There is still no DoobTube runtime implementation. The next step must decide and implement only the contract/protocol adapter scope actually proven necessary by DOOBTUBE-0 through DOOBTUBE-3.

## Evidence SHA rule

This document is a durable **evidence-only** update written after the exact implementation SHA qualified.

It changes no executable source, tests, workflows, dependencies, configuration, generated/runtime artifacts, interfaces, deployment state or substantive requirements. The qualified implementation SHA remains authoritative without recursive qualification.

## Next canonical roadmap step

**DOOBTUBE-4 — Contracts and protocol adapters**
