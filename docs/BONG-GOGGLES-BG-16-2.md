# Bong Goggles BG-16.2 — Relationships + Interaction Emitters

BG-16.2 connects canonical Bong Goggles relationship and interaction events to the BG-16 notification catalog while revalidating current recipient/actor policy before presentation delivery.

## Emitters

- `FriendRequestCreated` -> `FRIEND_REQUEST_RECEIVED`
- `FriendRequestAccepted` -> `FRIEND_ACCEPTED`
- `FollowRequestCreated` -> `FOLLOW_REQUEST_RECEIVED`
- `Followed` -> `FOLLOWED`
- `SocialObjectPublished` with `COMMENT` type -> `COMMENT_CREATED`
- `TagCreated` with PROFILE target -> `MENTIONED`
- `TagCreated` with PAGE/COMMUNITY target -> `TAGGED`

## Policy boundary

Relationship requests, comments, mentions and tags require hydrated current notification-policy state. Emission fails closed unless both profiles are active, neither side is blocked, notification delivery is not muted, and interaction policy still allows the source actor to interact with the recipient. Profile mentions additionally require current `canMention` eligibility.

This policy check is presentation-layer suppression only. It cannot rewrite or invalidate the canonical source event.

## Canonical hydration

Comment notifications hydrate both the published social object and its canonical parent. Only COMMENT objects with active comment/parent state are eligible. The parent author is the recipient; the comment author is the actor. Self-comments are suppressed by the common candidate builder.

Tags use the canonical `TagCreated` event arguments and distinguish profile mentions from page/community tagging using `TagTargetType` (`PROFILE=0`, `PAGE=1`, `COMMUNITY=2`).

## Replay guarantees

All emitters retain BG-12.6 deterministic notification IDs based on the non-authoritative envelope and source provenance. Reprocessing the same log through `BongGogglesNotificationPipeline` emits once and advances only consumer-owned checkpoint state.

## Tests

`notificationRelationshipsInteractions.test.js` covers:

- incoming friend/follow requests;
- current policy/block/mute fail-closed behavior;
- comment parent hydration and self-notification suppression;
- non-comment filtering;
- profile mention vs page/community tag mapping;
- `canMention` and block revalidation;
- deterministic replay deduplication.
