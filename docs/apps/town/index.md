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

## TOWN-AUDIT-2 skeleton

The repository owns Town application packages under `town/`. The current skeleton defines:

- package/build ownership under the root Go module;
- canonical service configuration;
- a local environment template with no secrets;
- versioned object names and opaque stable IDs;
- canonical shared visibility values;
- CI ownership and drift verification.

It does not yet provide a usable community application. Community lifecycle, membership authority, content workflows, moderation, integrations, API/indexer and frontend are later roadmap steps.

## Trust boundary

Authority-bearing membership, role, permission, subscription, entitlement and treasury references must remain independent of replaceable Search, Indexer, message transport, storage gateway, frontend and rewards surfaces.

Post/comment bodies remain off-chain by default and are represented by references in the skeleton schema.
