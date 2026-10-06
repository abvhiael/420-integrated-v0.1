---
title: 420Town
component: town
audience:
  - user
  - developer
  - operator
category: app
status: development
version: v1
---

# 420Town

420Town is the GEN-SVC Genesis-facing community-board application target.

It is **not** part of the frozen Genesis application catalog. Its service identifier, `420/service/town/v1`, belongs to the GEN-SVC composition registry and must not be represented as a frozen Genesis application ID without a later explicit catalog decision.

## Implemented through TOWN-AUDIT-10

The repository now contains:

- canonical package/build ownership under `town/`;
- canonical service/environment/schema configuration;
- stable opaque Town object IDs and shared visibility vocabulary;
- `TownAuthority420` for authoritative on-chain community state;
- membership lifecycle with owner safety and controlled reinstatement;
- fixed community-scoped MEMBER/MODERATOR/ADMIN roles;
- owner-controlled default-deny role permissions;
- explicit revisioned subscription and entitlement lifecycle;
- reference-only treasury binding with no Town custody;
- posts, threads, comments/replies and votes under `town/content`;
- off-chain content references plus SHA-256 body digests;
- append-only post/comment revision history;
- tombstone deletion preserving IDs and digests while clearing body references;
- visibility checks that fail closed and inherit thread scope for comments;
- required idempotency keys with conflicting replay rejection;
- duplicate-content, per-identity, trusted-device, trusted-network, vote and aggregate-community abuse controls;
- lower throttling limits for unknown/unverified/young identities;
- the canonical moderation action vocabulary;
- community-scoped MODERATOR/ADMIN authority;
- user-scoped block/mute state;
- community-scoped suspension;
- append-only report/appeal/decision/restore provenance;
- content-gate enforcement preventing hidden/locked/suspended alternate-path bypass;
- exact-SHA Town CI and app-specific regression qualification;
- canonical Identity active-profile fail-closed reads;
- 420Storage/Resource Protocol upload preparation and SHA-256-verified retrieval;
- PUBLIC-only non-canonical 420Search projection through `420Town:public` / `public_town`;
- provenance-bound 420Notifications handoff with explicit subscription selection;
- canonical 420Messenger authorization checks before replaceable encrypted transport;
- optional Registry service discovery with exact active service-ID matching;
- retained optional Town Rewards integration;
- authenticated `/v1` API with strict validation and mutation idempotency;
- typed `sdk/town420` client with HTTPS enforcement and bounded retries;
- generation-bound cursor pagination for public derived reads;
- rebuildable/reorg-safe `town/projection` state;
- atomic `town/recovery` interruption checkpoints;
- API request/error/auth/mutation/latency observability;
- user-facing browser application under `town/web`;
- public Town community discovery through 420Search;
- feed, post, thread, comment, voting and moderation workflows;
- canonical TownAuthority420 membership/subscription/entitlement reads;
- wallet/network/target-gated create/join/leave/admin/subscription/entitlement transactions;
- explicit loading/empty/error/transaction states and responsive/accessibility basics.

Detailed models:

- authority/trust boundary: `docs/apps/town/authority.md`
- content lifecycle/abuse boundary: `docs/apps/town/content.md`
- moderation/appeal lifecycle: `docs/apps/town/moderation.md`
- service integrations: `docs/apps/town/integrations.md`
- API/SDK/projection/recovery: `docs/apps/town/api.md`
- user-facing web application: `docs/apps/town/web.md`

## Trust boundary

Authority-bearing community, membership, role, permission, subscription, entitlement and treasury-reference state is resolved from `TownAuthority420`.

Posts, threads, comments, votes and moderation cases/actions are replaceable off-chain application state. Search, Indexer, message transport, storage gateway, frontend, Notifications and rewards must not widen visibility or replace Town authority, content provenance or moderation provenance.

Post/comment body bytes remain off-chain by default.

## Remaining roadmap work

TOWN-AUDIT-9 security hardening is repository-complete. TOWN-AUDIT-10 performs the exact-head Level 3 repository closeout. Live testnet qualification and production release remain TOWN-AUDIT-11 and TOWN-AUDIT-12 respectively. Live external endpoints, deployed wallet/network bindings and live reorg/recovery behavior are not inferred from repository-local qualification.
