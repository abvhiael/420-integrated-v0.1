---
title: 420Media Moderation and Appeals
audience:
  - user
  - operator
  - operator
category: reference
status: current
version: current
---

# 420Media moderation and appeals

420Media adopts the GEN-SVC shared moderation vocabulary.

Canonical actions:

`REPORT, HIDE, BLOCK, MUTE, SUSPEND, APPEAL, MODERATOR_DECISION, RESTORE, LOCK`

## Scope

Media moderation controls application visibility/access only.

It does not mutate:

- 420Identity;
- 420Rights ownership/license records;
- Wallet authority;
- Pay settlement;
- Compute jobs/entitlements;
- canonical Media payment history.

Financial or protocol remedies must use the authoritative owning system.

## Reports

Reports contain stable IDs, reporter reference, target kind/ID, reason, optional opaque evidence reference and timestamp.

Report creation is rate-limited.

Duplicate report IDs fail closed.

## Decisions

A moderator decision requires:

- verified session;
- `media.moderate` capability;
- positive domain-scoped moderator authorization;
- existing report;
- stable decision ID;
- reason.

Repository moderation decisions allow application-level HIDE, SUSPEND, RESTORE, LOCK and MODERATOR_DECISION.

BLOCK and MUTE remain user-scoped controls rather than privileged moderator decisions.

## Appeals

Appeals reference an existing decision and preserve its historical record.

An appeal never overwrites the original decision.

## Rights complaints

For rights abuse:

1. hide/quarantine application visibility when justified;
2. preserve content/provenance hashes;
3. query canonical 420Rights evidence;
4. never rewrite ownership to make a complaint disappear;
5. restore visibility only through auditable moderation/review.

## Moderator compromise

If moderator authority is compromised, revoke the application capability/session, preserve the audit trail, review decisions made in the exposure window and restore visibility through new auditable decisions where appropriate.

Do not use a hidden administrative database edit.
