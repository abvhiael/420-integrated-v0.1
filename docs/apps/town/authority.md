---
title: 420Town authority model
component: town
audience:
  - developer
  - operator
  - architect
category: application
status: development
version: current
---

# 420Town authoritative community state

TOWN-AUDIT-3 introduces the first authoritative 420Town state surface: `TownAuthority420`.

## Authority scope

The contract owns only community-scoped application authority:

- community ownership and metadata commitment;
- membership lifecycle;
- scoped role assignment;
- bounded application permissions;
- subscriptions;
- entitlements;
- canonical treasury-reference binding.

It does **not** make Search, 420Indexer, transport, UI, Notifications, Storage or rewards authoritative. Those systems may project or react to Town state but disagreement is resolved in favor of `TownAuthority420`.

## Membership lifecycle

Membership states are:

`NONE -> ACTIVE -> LEFT -> ACTIVE`

An authorized membership manager may also transition an account to `REMOVED`. Removed users cannot self-rejoin; an authorized manager must explicitly reinstate them.

The community owner is created as an active member and cannot leave or be removed while still owner. Ownership transfer requires the successor to already be an active member.

## Roles and permissions

Roles are fixed and community-scoped:

- MEMBER;
- MODERATOR;
- ADMIN.

Every active member implicitly has MEMBER. ADMIN and MODERATOR are explicit bindings.

Permissions are application-local and default deny. The owner implicitly has all Town permissions. Role permission configuration is owner-only, preventing an ADMIN or MODERATOR from granting itself additional power. ADMIN assignment and revocation are also owner-only.

Leaving or removal clears privileged ADMIN/MODERATOR bindings so stale role state cannot reactivate after a later rejoin.

## Subscriptions and entitlements

Subscriptions and entitlements use explicit lifecycle state and monotonically increasing per-record revisions.

Expiry affects authorization immediately at the timestamp even before a keeper materializes the `EXPIRED` state. Materialization records durable lifecycle provenance.

Only active members may receive an active subscription or entitlement.

This phase does not claim payment settlement. A subscription record is Town application authorization state, not evidence of payment unless a later canonical integration explicitly binds settled payment evidence.

## Treasury boundary

Town stores only a paired external treasury authority identifier and treasury address plus a revision counter.

It has:

- no payable deposit function;
- no withdrawal function;
- no transfer function;
- no Town-owned balance ledger.

This preserves the architecture rule that Town community treasury references are on-chain while settlement/custody remains with the authoritative treasury/payment subsystem.

## Events and invariants

All authority mutations emit community-scoped events for provenance: community creation/ownership, membership transitions, role assignment, role-permission changes, subscription transitions, entitlement transitions and treasury-reference changes.

The machine-readable invariant set is in `config/420town-authority-v1.json`.

The focused test suite covers owner safety, membership transitions, privilege scoping, self-escalation attempts, stale-role clearing, subscription/entitlement replay/state behavior, expiry, nonmember rejection and treasury-boundary behavior.
