# 420Pulse V1 Model

Status: **FROZEN FOR IMPLEMENTATION**

420Pulse is the canonical public social graph, publishing, provenance, discovery-reference, and creator-distribution protocol for 420 Integrated. It defines portable public profile identity, follow/block relationships, publication identity and revisions, reply/repost relationships, topics, lightweight interactions, and policy references while leaving feed ranking, recommendation, indexing, and large media payloads outside canonical chain state.

## Core distinction

- **420Pulse** discovers people, ideas, media, products, projects, communities, and public activity.
- **420Commons** organizes people into bounded communities with membership, permissions, and shared authority.

Pulse canonicalizes the public graph and provenance. It does not canonicalize an official ranked feed.

## Canonical V1 objects

### Profile
A stable public social identity bound to an account or organization controller. Profile types are descriptive only and never confer protocol authority. A controller may be a 420 programmable smart account so delegation, recovery, session policy, and account security remain in the shared account layer rather than Pulse.

### Follow
A reconstructable profile-to-profile social graph edge. Follow state does not grant payment, custody, governance, validator, bridge, or arbitrary execution authority. Creating a follow requires both profiles to be active; removing an existing follow remains possible if the target profile later becomes inactive.

### Block
A profile-scoped social restriction. Blocks affect Pulse interaction eligibility only and do not revoke unrelated protocol rights. Creating a block requires an active target; removing a previously recorded block remains possible if the target later becomes inactive.

### Publication
A stable publication identity permanently bound to its original author profile, publication type, content-manifest commitment, parent/root relationships, policy references, creation time, and revision. New publications and revisions require an active author profile. A deactivated author may tombstone an existing publication but may not revise or reactivate it until the profile is active again.

### Revision
Publication edits are append-only. Historical revisions are not overwritten or reassigned.

### Interaction
Lightweight social relationships such as likes and repost references. Interaction state must not become hidden economic or execution authority. Creating an interaction requires an active target and an interaction-eligible relationship, while removing a previously recorded interaction remains possible after the target is deactivated or the social relationship later becomes blocked.

### Topic
A stable topic identity used for portable public classification and discovery references. A normalized topic name maps to only one canonical `topicId`; ranking or trend computation remains non-canonical.

## Profile classifications

Canonical V1 profile types:
- PERSON
- CREATOR
- ORGANIZATION
- MERCHANT
- PROJECT
- PROTOCOL
- COMMUNITY

These are descriptive only.

## Publication classifications

Canonical V1 publication types:
- POST
- ARTICLE
- IMAGE
- VIDEO
- AUDIO
- LINK
- POLL
- PRODUCT_REFERENCE
- RELEASE_REFERENCE
- EVENT_REFERENCE
- COMMONS_REFERENCE

Large content/media bytes are referenced through content manifests and decentralized storage rather than stored in Pulse contracts.

Typed reference publications (`PRODUCT_REFERENCE`, `RELEASE_REFERENCE`, `EVENT_REFERENCE`, `COMMONS_REFERENCE`) require a nonzero canonical external reference ID. Pulse preserves that ID but does not assume ownership or authority over the referenced object.

A child publication may only be created against an existing active parent whose author profile is active. Root identity is derived from the immutable parent chain and cannot be supplied by the caller.

## Feed boundary

There is no canonical `official feed`, ranking score, recommendation algorithm, or global trend order in Pulse V1. Frontends and indexers may build chronological, following, recommendation, topic, creator, merchant, or other feeds from canonical public state, but those ranking decisions are replaceable and non-canonical.

## Integrations and exclusions

Pulse does not custody funds, settle payments, mint Identity420 credentials, create universal Trust scores, own Market listings, own Commons membership, or store large media payloads.

- Payments and monetization route through 420Pay.
- Objective reputation evidence routes through 420Trust.
- Identity and credentials route through Identity420.
- Names route through 420Names.
- Community membership/authority routes through 420Commons.
- Commerce references canonical 420Market objects.
- Creative references preserve canonical 420 Creative / 420Hz object IDs.
- Public content manifests use the shared content/storage layer.

## Invariants

- **PULSE-INV-001:** `profileId` is globally unique and never reassigned.
- **PULSE-INV-002:** follow relationships are canonical, reconstructable, and frontend-independent.
- **PULSE-INV-003:** every publication permanently binds its original author profile.
- **PULSE-INV-004:** publication edits are append-only and historical revisions remain reconstructable.
- **PULSE-INV-005:** protocol state does not define an official ranked feed.
- **PULSE-INV-006:** Pulse contracts do not custody large media payloads.
- **PULSE-INV-007:** no unrestricted moderator or operator can globally erase canonical lawful history.
- **PULSE-INV-008:** follows, reactions, profile type, and publication status confer no unrelated protocol authority.
- **PULSE-INV-009:** monetization finality originates from 420Pay.
- **PULSE-INV-010:** Pulse cannot create a universal reputation score.
- **PULSE-INV-011:** Pulse cannot create or modify Identity420 credentials.
- **PULSE-INV-012:** cross-dApp references preserve the referenced canonical object ID.
- **PULSE-INV-013:** a block affects only Pulse social interaction policy, not unrelated protocol rights.
- **PULSE-INV-014:** profiles, graph state, publications, revisions, topics, and canonical interactions are reconstructable from chain history plus published specs/manifests.
- **PULSE-INV-015:** official frontend, indexer, recommendation engine, and feed service are non-canonical and replaceable.
- **PULSE-INV-016:** ActionId and policy semantics are stable and versioned when materially broadened.
- **PULSE-INV-017:** deactivation or blocking cannot trap a user in an existing follow, block, or reaction state; removal of the caller's recorded relationship remains possible.
- **PULSE-INV-018:** an inactive author profile cannot create, revise, or reactivate publications; historical/tombstone state remains readable.
- **PULSE-INV-019:** each normalized topic name maps to one canonical `topicId` and cannot be reassigned.
- **PULSE-INV-020:** typed cross-dApp reference publications require a nonzero referenced canonical object ID and preserve that ID unchanged.
- **PULSE-INV-021:** new child publications cannot attach to inactive/tombstoned parent publications or to publications whose author profile is inactive.

## Foundational implementation sequence

1. `PulseIds420`
2. `PulsePolicyRegistry420`
3. `PulseProfileRegistry420`
4. `PulseGraph420`
5. `PulsePublicationRegistry420`
6. `PulseInteractionRegistry420`
7. `PulseTopicRegistry420`
8. `IPulse420`
9. `PulseRouter420`
10. invariant/unit tests
11. Genesis/early-service mapping

Subscriptions, monetization adapters, moderation/reporting, recommendation/indexing services, and richer cross-dApp adapters follow after the foundation qualifies.

No new frozen system/predeploy address is allocated by this suite. Discovery remains through the protocol/application registry layer.
