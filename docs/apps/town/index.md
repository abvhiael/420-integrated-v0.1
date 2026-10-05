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

## Implemented through TOWN-AUDIT-3

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
- authority mutation events and machine-readable invariants;
- exact-SHA Town CI, focused authority tests and retained Town/rewards regressions.

The detailed state and trust model is documented in `docs/apps/town/authority.md`.

## Trust boundary

Authority-bearing community, membership, role, permission, subscription, entitlement and treasury-reference state is resolved from `TownAuthority420`.

Search, Indexer, message transport, storage gateway, frontend, Notifications and rewards must not widen or replace that authority.

Post/comment bodies remain off-chain by default.

## Remaining roadmap work

Posts/threads/comments/votes, moderation and appeals, service integrations, API/SDK/indexer/recovery, the user-facing web application, broader security hardening, complete app-phase qualification, live testnet qualification and production release remain open in later TOWN-AUDIT steps.
