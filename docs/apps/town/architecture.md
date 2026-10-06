---
title: 420Town architecture and component map
component: town
audience:
  - developer
  - operator
  - architect
category: app
status: development
version: v1
---

# 420Town architecture and component map

420Town is the GEN-SVC community-board service identified by `420/service/town/v1`. It is a Genesis-facing replaceable service, not a frozen Genesis application.

## Authority boundary

`TownAuthority420` is the canonical application authority for community ownership, membership, scoped roles and permissions, subscriptions, entitlements, and treasury-reference binding. It has no custody or settlement API.

Replaceable/off-chain application state includes posts, threads, comments, votes, moderation cases/actions, Search projections, notification delivery, message transport, storage gateways, browser state, and rewards projections. None of those surfaces may widen or replace canonical Town authority.

## Component map

| Component | Repository location | Responsibility | Authority class |
|---|---|---|---|
| Town authority contract | `contracts/src/town/TownAuthority420.sol` | community, membership, roles, permissions, subscriptions, entitlements, treasury reference | authoritative application state |
| Content service | `town/content` | posts, threads, comments, votes, revisions, tombstones, visibility, abuse controls | replaceable application state |
| Moderation service | `town/moderation` | reports, moderation actions, appeals, restore, block/mute/suspend | replaceable application state constrained by Town roles |
| Integrations | `town/integrations` | Identity, Storage, Search, Notifications, Messenger, service discovery | adapters only |
| API | `town/api` | authenticated/idempotent `/v1` transport and observability | transport only |
| SDK | `sdk/town420` | typed Go client, HTTPS and retry policy | client only |
| Projection | `town/projection` | rebuildable public read model, reorg-safe generation | derived/non-canonical |
| Recovery | `town/recovery` | bounded atomic projection snapshots | derived-state recovery |
| Web app | `town/web` | discovery, content/moderation UX, wallet-reviewed authority transactions | client only |
| Search | shared `search/*` | PUBLIC Town discovery/indexing | derived/non-canonical |
| Rewards | `contracts/src/town/TownRewardsAdapter420.sol` | optional contribution projection | optional/non-authoritative |

## State machines

### Membership

`NONE -> ACTIVE -> LEFT -> ACTIVE`

An authorized membership manager may move an active member to `REMOVED`. A removed member cannot self-rejoin. The owner remains an active member until ownership is transferred.

### Subscription

`NONE -> ACTIVE -> CANCELLED` or `ACTIVE -> EXPIRED`. Activation is revisioned and duplicate active replay is rejected.

### Entitlement

`NONE -> ACTIVE -> REVOKED` or `ACTIVE -> EXPIRED`. Grants are revisioned and require an active member.

### Content

Posts/comments are `ACTIVE` or `TOMBSTONED`. Tombstones preserve stable IDs and the last digest while clearing the content reference. Revisions are append-only.

### Moderation

Reports create durable cases. Qualified actions include `HIDE`, `LOCK`, `SUSPEND`, `BLOCK`, `MUTE`, `APPEAL`, `MODERATOR_DECISION`, `RESTORE`. Appeals and decisions append provenance rather than rewriting prior history.

## Request/data flow

1. A user discovers PUBLIC communities through the non-authoritative Search projection.
2. Public content reads come from the Town API/projection and remain visibility-gated.
3. Mutations enter through authenticated/idempotent Town API routes and delegate to the qualified content/moderation services.
4. Authority-bearing membership/role/subscription/entitlement actions are wallet-reviewed calls to the configured `TownAuthority420`.
5. Content bodies remain off-chain; Town stores content references plus SHA-256 digests.
6. Notifications and Messenger are downstream delivery/transport adapters and cannot mutate Town authority.
7. Projection state is rebuildable and may be restored from bounded recovery snapshots.

## Failure model

Unknown visibility, missing authority, dependency identity mismatch, integrity mismatch, unsupported role/permission, stale projection cursor, chain gap, parent mismatch, unauthenticated mutation, missing idempotency key, malformed bearer token, and unresolved production bindings fail closed.

See also:

- `authority.md`
- `content.md`
- `moderation.md`
- `integrations.md`
- `api.md`
- `security.md`
- `web.md`
