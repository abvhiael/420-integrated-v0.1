# Bong Goggles BG-12.4 — Community & Discovery Projection Reducers

BG-12.4 extends the monolithic Phase-12 production indexer with canonical reducers for Pages, Groups, membership, Events/RSVPs, discovery subjects, reviews, corrections and verification attestations.

## Canonical community reducers

The adapter consumes the actual `BongGogglesCommunityRegistry420` events:

- `PageCreated`, `PageUpdated`
- `GroupCreated`, `GroupUpdated`
- `GroupJoinRequested`, `GroupMemberActivated`, `GroupMemberRemoved`
- `EventCreated`, `EventUpdated`, `EventRSVP`

Page, group, membership and event records are hydrated from canonical contract reads at the event block whenever the event payload omits complete materialized state. Membership removal deletes the projected row so stale membership cannot survive replay. RSVP records are keyed by event + account.

## Canonical discovery/review reducers

The adapter consumes the actual `BongGogglesDiscoveryRegistry420` events:

- `SubjectSubmitted`
- `ReviewPublished`, `ReviewWithdrawn`
- `CorrectionSubmitted`
- `VerificationAttested`

Discovery subjects, reviews, corrections and verification records are projected from canonical hydrated state. When a new review supersedes an earlier active review, the reducer can update the prior review to inactive and upsert the replacement in the same projector event, preserving deterministic review history without treating the indexer as authoritative.

## Guarantees

- optional fields are normalized to persistence-safe values
- address keys are normalized consistently
- community and discovery entities retain canonical lifecycle/role/status fields
- removed group membership leaves no stale active row
- review withdrawal and replacement preserve canonical active state
- projector replay/reorg semantics continue to come from BG-12.1
- persistence/restart verification continues to come from BG-12.3
- missing canonical hydration fails closed

## Phase-12 integration rule

BG-12.4 remains on `feature/bong-goggles-phase12-monolithic` / PR #307. It is not merged independently. BG-12.5 through BG-12.7 continue on the same branch before final Phase-12 reconciliation and qualification.
