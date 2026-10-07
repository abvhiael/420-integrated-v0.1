# 420Media — Search, Notifications and indexing projections

Roadmap step: **MEDIA-AUDIT-8 — Search, Notifications and indexing projections**

## Purpose

MEDIA-AUDIT-8 makes public 420Media discovery consumable by the existing 420Search result contract and establishes opt-in, provenance-preserving Media notifications without creating new authority.

The architecture remains strictly derived:

- 420Media/420Storage/420Rights remain authoritative for Media asset eligibility and rights-bearing publication;
- 420Indexer remains the shared non-authoritative provenance/finality source;
- 420Search remains a non-authoritative discovery/presentation layer;
- 420Notifications remains a non-canonical delivery/presentation layer;
- projection, ranking, notification delivery, deduplication and rebuild state never become protocol authority.

## Search projection boundary

The Media projection layer emits the existing 420Search result schema:

- Search domain: `asset`;
- Search source: `420Indexer`;
- mode: `discovery`;
- category: `media_asset`;
- stable source key: `media:<media-asset-id>`.

No new Search-owned domain, source, contract or canonical state is introduced.

### Public-only admission

A Media asset is eligible for Search projection only when:

1. the Media asset is `READY`;
2. visibility is exactly `PUBLIC`;
3. the existing Media Rights publication guard succeeds;
4. the Indexer source is explicitly qualified;
5. chain ID is nonzero;
6. indexed/safe/finalized heights are internally consistent;
7. event provenance contains block, block hash, transaction hash and log index;
8. declared finality is `head`, `safe` or `finalized` and does not exceed the corresponding Indexer cursor.

Private, unlisted, restricted, deleted, not-ready or Rights-denied assets never produce Search results.

The projection contains presentation metadata only. It does not expose:

- raw media payloads;
- encrypted/private Storage contents;
- private session or credential data;
- private Identity fields;
- notification subscriptions/endpoints;
- Wallet secrets.

### Provenance

Every projected Search result retains:

- chain ID;
- block number;
- block hash;
- transaction hash;
- log index;
- indexed height;
- finalized height;
- finality classification;
- indexed timestamp;
- explicit statement that authority remains with Media/Storage/Rights.

Search ranking and sponsorship fields remain non-canonical.

## Rebuildable Media projection index

The Media-owned projection cache is explicitly disposable and rebuildable.

It supports:

- deterministic upsert/delete application;
- non-finalized rollback to a canonical ancestor;
- finalized-height tracking;
- fail-closed finalized-history conflict detection;
- deterministic full rebuild from canonical ordered projection events;
- duplicate block/log provenance rejection;
- stable result identity inherited from the 420Search result contract.

A rollback below the retained finalized boundary fails with `ErrFinalizedConflict`.

A replacement or reorg above finality removes the orphaned projection and allows canonical replay.

The index never mutates the underlying Media, Storage, Rights or chain state.

## Notifications

420Media notifications are derived only from valid public Media Search projections.

Subscriptions are private application state and are:

- opt-in;
- reversible;
- topic-scoped;
- channel-scoped;
- severity-scoped;
- minimum-finality scoped;
- independently promotional-consent scoped;
- mutable/muteable without changing canonical Media state.

### Provenance-preserving delivery

Every generated notification retains:

- source Search result ID;
- source block hash;
- source transaction hash;
- source log index;
- source finality;
- topic;
- severity;
- delivery channel.

Notification IDs are deterministic over the user/topic/source provenance tuple.

Retries or replay of the same source event produce no second delivery.

### Promotional consent

Promotional Media notifications require an independent `PromotionalOptIn=true` subscription.

An operational or content subscription does not silently imply promotional consent.

### Finality threshold

Each subscription chooses its minimum finality:

- `head`;
- `safe`;
- `finalized`.

A notification derived from weaker finality is not delivered to a stronger-finality subscription.

### Reorg retraction

If a previously delivered non-finalized source block becomes orphaned, Media can emit one deterministic retraction for each affected delivery.

Retraction:

- preserves the original source provenance;
- is idempotent;
- changes presentation/delivery state only;
- never rewrites canonical history;
- never blocks or reverses the underlying protocol operation.

## Authority and privacy boundaries

Search and Notifications must never:

- create Media assets;
- change Media visibility;
- grant Rights publication/reuse authority;
- mutate Storage state;
- alter Pay/Compute settlement;
- sign Wallet actions;
- execute notification action buttons as transactions;
- expose private or encrypted payloads;
- turn a delivery receipt into canonical protocol truth.

Search/Notifications outage or corruption may degrade discovery/delivery but cannot affect canonical Media operation.

## Failure and recovery

### Unqualified/stale Indexer source

Fail closed; do not project a Media asset.

### Impossible finality metadata

Fail closed if:

- finalized height > safe height;
- safe height > indexed height;
- projected block exceeds its declared safe/finalized cursor.

### Non-finalized reorg

Rollback derived entries above the common ancestor, then replay the canonical suffix.

### Finalized conflict

Fail closed. Do not silently rewrite retained finalized projection history.

### Projection corruption

Discard and deterministically rebuild from canonical approved provenance inputs.

### Notification provider/delivery failure

Do not block Media, Storage, Rights, Pay, Compute or livestream operations. Retry/failover remains non-canonical and must preserve deduplication.

## Security invariants

- **MEDIA-PROJ-INV-001:** only `READY + PUBLIC` Media assets may enter Search projection.
- **MEDIA-PROJ-INV-002:** Search publication also requires live Media Rights publication authorization.
- **MEDIA-PROJ-INV-003:** Search projection requires a qualified Indexer source and explicit chain/finality provenance.
- **MEDIA-PROJ-INV-004:** private/unlisted/restricted/deleted/not-ready Media data cannot be projected by changing presentation metadata.
- **MEDIA-PROJ-INV-005:** projection state is non-authoritative and rebuildable.
- **MEDIA-PROJ-INV-006:** non-finalized projection state may roll back and replay.
- **MEDIA-PROJ-INV-007:** finalized history conflicts fail closed.
- **MEDIA-PROJ-INV-008:** deterministic rebuild rejects duplicate canonical block/log provenance.
- **MEDIA-NOTIF-INV-001:** notification subscriptions are opt-in and reversible.
- **MEDIA-NOTIF-INV-002:** promotional delivery requires separate explicit consent.
- **MEDIA-NOTIF-INV-003:** delivery respects subscriber minimum finality.
- **MEDIA-NOTIF-INV-004:** retries/replay do not create duplicate delivery.
- **MEDIA-NOTIF-INV-005:** reorg retractions are idempotent and preserve source provenance.
- **MEDIA-NOTIF-INV-006:** notification history/subscriptions/endpoints never become public Search state.
- **MEDIA-NOTIF-INV-007:** Notifications cannot sign, spend or mutate canonical Media/protocol state.
- **MEDIA-NOTIF-INV-008:** notification failure never blocks the underlying Media action.

## Qualification level

MEDIA-AUDIT-8 is an ordinary roadmap step and is qualified at **Level 1 app-scoped fast qualification**.

This implementation consumes existing Search result and Indexer/Notifications architectural contracts without modifying shared Search or Notifications source/runtime schemas. Therefore no new Level 2 boundary is introduced.

The retained MEDIA-AUDIT-5 Level 2 milestone remains valid.

## Qualification scope

Required Level 1 checks include:

- Media verifier;
- gofmt on the new projection package;
- full Media Go test/regression suite;
- Go vet;
- direct 420Search result/architecture dependency tests;
- retained GEN-SVC validation;
- retained Media Solidity build/Phase-1 regressions;
- retained Media Anvil integration;
- exact implementation SHA assertion.

## Deferred work

- live 420Indexer/Search endpoint binding and real reorg delivery evidence — MEDIA-AUDIT-12;
- live 420Notifications provider delivery/failover evidence — MEDIA-AUDIT-12;
- public `/v1` Media discovery/subscription API — MEDIA-AUDIT-9;
- user-facing search/subscription/preferences UX — MEDIA-AUDIT-10;
- broader index-poisoning/webhook/provider abuse closeout — MEDIA-AUDIT-11;
- production deployment/Registry/Genesis evidence — MEDIA-AUDIT-13.
