---
title: 420Town moderation and appeals
component: town
audience:
  - developer
  - operator
  - architect
category: application
status: development
version: v1
---

# 420Town moderation and appeals

TOWN-AUDIT-5 implements the shared GEN-SVC moderation vocabulary in `town/moderation`:

`REPORT, HIDE, BLOCK, MUTE, SUSPEND, APPEAL, MODERATOR_DECISION, RESTORE, LOCK`.

## Authority scope

Community moderation authority is derived from the TOWN-AUDIT-3 community authority layer.

A privileged moderation action requires:

- active membership in the target community; and
- the community `MODERATOR` or `ADMIN` role.

A moderator in one community has no moderation authority in another community merely because the same identity holds a role elsewhere.

Moderation is application state only. It cannot:

- transfer assets;
- change treasury/payment settlement;
- revoke protocol identity;
- acquire wallet authority;
- rewrite rights ownership;
- override Registry, Governance or Arbitration authority.

## Reports and target provenance

Reports may be submitted by active community members.

A content report binds:

- stable case ID;
- stable record ID;
- community;
- target kind and target ID;
- affected subject;
- reason;
- optional off-chain evidence reference plus lowercase SHA-256 digest;
- actor;
- version and timestamp.

The target must resolve to the same community as the report. User-target reports require the reported user to be an active member of that community.

Only one active moderation case occupies a content/user target slot at a time. A restored case releases the slot without rewriting its historical records, allowing a later independent report to open a new case.

## Hide

`HIDE` removes ordinary read access to the target while preserving provenance.

The affected author and domain moderators retain review access.

A hidden target cannot be bypassed through:

- direct read;
- revision-history read;
- vote;
- edit;
- thread creation;
- comment/reply paths.

Hide never changes content ownership, original author, content digest, payment state or rights state.

## Lock

`LOCK` preserves read access but blocks new interaction against the target.

For Town content this prevents applicable:

- edits;
- thread/reply creation;
- votes;
- other writes that route through the content moderation gate.

## Block and mute

`BLOCK` and `MUTE` are user-scoped by default.

A block prevents the blocked relationship from being used as an alternate content-visibility path.

A mute affects only the user who created the mute and does not globally hide the target user from unrelated viewers.

Block/mute state does not grant moderator capability and does not alter community membership or protocol identity.

## Suspension

`SUSPEND` is scoped to the Town application within one community.

A suspended user cannot create or mutate Town content in the suspended community. The suspension does not automatically apply to other communities.

Suspension does not remove the user from protocol Identity and does not transfer/revoke assets.

## Appeals and decisions

Only the affected subject may file an `APPEAL` for a moderated case.

Appeals never rewrite the prior report or moderation decision. Every case record is append-only and linked to its prior record.

A domain moderator/admin may issue `MODERATOR_DECISION` only after the case enters `APPEALED`.

The decision preserves the enforcement state unless a subsequent `RESTORE` action explicitly releases it.

## Restoration

`RESTORE` releases active hide/lock/suspension enforcement for the case.

Restoration:

- preserves the full prior case history;
- advances case version;
- records actor/reason/timestamp provenance;
- restores applicable content interaction/read behavior;
- releases the target slot so a later unrelated report may open a new case.

## Replay and evidence safety

Moderation writes use idempotency keys.

An exact retry returns the existing result. Reusing the same actor/action/idempotency key for a different moderation payload is rejected.

Evidence references are optional, but when evidence is supplied both the reference and a lowercase SHA-256 digest are required.

## Integration boundary

The Town content service requires a moderation gate at construction.

The moderation service fails closed for content reports until its content resolver is attached.

This two-way binding makes moderation part of the content access/write path rather than an optional UI-only overlay.

## Deferred work

TOWN-AUDIT-5 does not claim completion of:

- production Identity/Storage/Search/Notifications adapters;
- public signed API/SDK/webhook surfaces;
- external moderation queues or operator dashboards;
- Arbitration-backed financial remedies;
- user-facing frontend workflows;
- live testnet or production deployment.

Those remain later canonical Town roadmap work.
