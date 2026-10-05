---
title: 420Town content model
component: town
audience:
  - developer
  - operator
  - architect
category: app
status: development
version: v1
---

# 420Town content, threads, comments and votes

TOWN-AUDIT-4 implements the first usable 420Town content-state layer in `town/content`.

## Storage boundary

Posts and comments store only:

- stable opaque object IDs;
- author/community/thread relationships;
- off-chain content references;
- SHA-256 body digests;
- visibility;
- lifecycle status;
- revision metadata.

420Town does **not** store high-volume post/comment body bytes in this state layer. Bodies remain off-chain by default in accordance with GEN-SVC architecture. The SHA-256 digest preserves stable provenance for the referenced body without turning Town into a large-payload storage system.

## Posts and revisions

A post is permanently bound to:

- its stable post ID;
- community;
- original author;
- initial creation time.

Edits create a new monotonically increasing revision. Historical revisions remain available and are never overwritten in place.

A post tombstone:

- preserves the post ID;
- preserves the last body digest;
- clears the body reference;
- appends a tombstone revision;
- marks a thread rooted at that post as tombstoned.

Tombstoned posts cannot be revised or used as active thread roots.

## Threads

A thread is bound to one active root post.

Only the root-post author may create the thread around that post. A root post can belong to only one thread.

Thread identity survives root-post deletion, but its status becomes `TOMBSTONED`. New comments are rejected once the thread/root is tombstoned.

## Comments and replies

Comments are attached to a thread. Replies additionally bind to a parent comment.

A reply:

- cannot cross thread boundaries;
- cannot cross community boundaries;
- cannot attach to a tombstoned parent;
- inherits the root post visibility.

Comments do not accept an independent visibility override. This prevents a reply from widening a more restrictive root thread.

Comment edits are append-only revisions. Comment tombstones preserve the stable ID and digest while clearing the body reference.

## Visibility

The canonical GEN-SVC scopes are retained exactly:

- `PUBLIC`
- `UNLISTED`
- `FOLLOWERS`
- `COMMUNITY_ONLY`
- `PURCHASERS_OR_BACKERS`
- `PRIVATE`
- `ORGANIZATION_MEMBERS`
- `MODERATORS`
- `ADMINS`

Town evaluates its own scopes using the authoritative community state introduced in TOWN-AUDIT-3:

- `COMMUNITY_ONLY` requires active membership;
- `MODERATORS` requires the community MODERATOR or ADMIN role;
- `ADMINS` requires the community ADMIN role;
- `PRIVATE` is author-only at this phase;
- `PUBLIC` and `UNLISTED` are readable without membership.

`FOLLOWERS`, `PURCHASERS_OR_BACKERS`, and `ORGANIZATION_MEMBERS` require trusted relationship context supplied by a future integration adapter. Missing relationship context is false and therefore fails closed. Callers must not populate these relationship flags from untrusted client assertions.

Unknown visibility values are rejected on write and denied on read.

## Votes

Votes are lightweight application interactions with values `-1` or `1`.

Rules:

- only active community members may vote;
- the voter must be able to view the target;
- targets are posts or comments;
- one canonical vote record exists per voter/target;
- changing a vote updates that record and increments its revision;
- clearing a vote preserves the historical record but marks it inactive.

Votes confer no payment, governance, identity, moderation or other protocol authority.

## Idempotency and replay safety

Every content mutation requires an idempotency key.

The idempotency namespace includes actor and operation. Repeating the same request with the same key returns the original result without creating another write.

Reusing the same key for a different payload is rejected with an idempotency conflict.

This mechanism is application replay protection. Later signed API/webhook layers must add their own domain-separated signatures, expiry and replay caches without weakening these semantics.

## Spam, Sybil and rate-abuse controls

The content service applies:

- per-identity write windows;
- separate vote-rate windows;
- aggregate per-community write limits;
- duplicate content fingerprint detection by author, community and body digest;
- lower limits for unknown, unverified or young identities;
- higher limits only for verified identities old enough to satisfy the configured minimum age;
- one canonical vote record per identity/target.

Risk/assurance data is throttling context only. It never becomes protocol identity authority.

The default policy is machine-readable in `config/420town-content-v1.json`.

## Authority and projection boundary

Posts, threads, comments and votes are replaceable off-chain application state.

They do not override:

- Town community membership/role authority;
- Identity;
- Rights;
- Registry;
- payments or treasury state;
- governance;
- Arbitration.

Search, indexers, UI, Notifications and rewards may consume Town content state but cannot widen visibility or become its authority.

## Deferred work

TOWN-AUDIT-4 does not claim completion of:

- moderation reports/hide/restore/appeal workflows;
- Identity/Storage/Search/Notifications adapters;
- signed public API/SDK;
- durable external persistence/recovery tooling;
- frontend workflows;
- live testnet or production deployment.

Those remain later canonical TOWN-AUDIT steps.
