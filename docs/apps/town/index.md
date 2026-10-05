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

## Implemented through TOWN-AUDIT-4

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
- exact-SHA Town CI and app-specific regression qualification.

Detailed models:

- authority/trust boundary: `docs/apps/town/authority.md`
- content lifecycle/abuse boundary: `docs/apps/town/content.md`

## Trust boundary

Authority-bearing community, membership, role, permission, subscription, entitlement and treasury-reference state is resolved from `TownAuthority420`.

Posts, threads, comments and votes are replaceable off-chain application state. Search, Indexer, message transport, storage gateway, frontend, Notifications and rewards must not widen visibility or replace either Town authority or Town content provenance.

Post/comment body bytes remain off-chain by default.

## Remaining roadmap work

Moderation and appeals, service integrations, API/SDK/indexer/recovery, the user-facing web application, broader security hardening, complete app-phase qualification, live testnet qualification and production release remain open in later TOWN-AUDIT steps.
