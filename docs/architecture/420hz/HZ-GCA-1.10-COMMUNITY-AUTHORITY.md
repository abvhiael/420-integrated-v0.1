# HZ-GCA-1.10 — Community authority model

Status: **IMPLEMENTED — Level 1 Community authority definition**

Canonical parent step: **HZ-GCA-1 — Scope, threat model and authority map**

Machine-readable policy:

`hz/config/gca-community-authority-v1.json`

This step freezes 420Hz Community authority for follows, favorites, playlists, playlist items, sharing/repost references and derived community activity without creating a second Identity, Commons/Town, Creative, Charts, Awards, payment or governance authority.

## Community state owned by 420Hz

420Hz may own only its explicit application/community objects:

- `ArtistFollow`
- `RecordingFavorite`
- `Playlist`
- `PlaylistItem`

420Hz also exposes rebuildable/non-authoritative projections such as:

- `CommunityActivity`
- follower counts
- favorite counts
- playlist counts
- community feeds
- future recommendation inputs derived from eligible source community state

These projections are not source authority.

## Anonymous reads vs mutations

Eligible PUBLIC community presentation may be read anonymously.

Authority-bearing community mutations require a qualified Wallet/session actor for the acting account.

Wallet connection alone is not approval.

A client-supplied account/address string is not authorization.

Optional 420Identity may provide display/profile context or later eligibility assertions, but selecting an Identity profile cannot widen Wallet/account authority.

## Identity authority

420Identity remains authoritative for its own profile/credential state.

420Hz may:

- display an eligible public profile/name/avatar;
- reference an Identity/profile where a later explicit policy needs it.

420Hz may not:

- manufacture Identity assurance;
- treat profile selection as signing authority;
- convert follows/favorites/playlists into Identity credentials or trust;
- require Identity merely for anonymous public reads or ordinary Wallet-authorized social state unless later policy explicitly says so.

## ArtistFollow

`ArtistFollow` is a 420Hz relation between one follower account and one artist Creator reference.

There is at most one active logical relation for:

`followerAccountRef + artistCreatorId`

Repeat follow requests are idempotent or fail without creating duplicate active relations/count inflation.

A follow means only:

> this 420Hz account currently follows this artist in the 420Hz application.

It does **not** mean:

- 420Commons or 420Town membership;
- creator ownership/control;
- Identity verification/trust;
- paid entitlement;
- qualified play;
- chart point;
- Award nomination/vote;
- economic right.

Current privacy default is PUBLIC relation. Any future private-follow mode requires explicit versioned policy rather than silent reinterpretation.

## RecordingFavorite

`RecordingFavorite` is a 420Hz user preference tied to one canonical Recording.

There is at most one active relation for:

`accountRef + RecordingId`

A favorite is **PRIVATE by default** under HZ-GCA-1.7.

It does not establish:

- Recording ownership;
- a license/right;
- a play;
- a qualified play;
- a chart point;
- an Award vote;
- payment/reward entitlement.

Any public favorite visibility requires explicit user/policy action.

## Playlist

A `Playlist` is a 420Hz-owned ordered collection under one authorized owner/controller.

Supported authority-level visibility vocabulary:

- PRIVATE
- UNLISTED
- PUBLIC

Only the owner/controller-authorized Wallet/session may mutate playlist title, metadata, visibility or membership.

A playlist does not become a Creative Release.

Including a Recording in a playlist does not grant:

- Recording ownership;
- license;
- derivative permission;
- playback authority;
- publication authority.

## PlaylistItem

`PlaylistItem` is a stable ordered membership edge referencing a native canonical Recording ID.

It inherits playlist visibility for the playlist presentation itself, but the underlying Recording/source remains the upper visibility/access bound.

A PUBLIC playlist cannot make an otherwise PRIVATE, UNLISTED, deleted, unavailable or rights-blocked Recording publicly playable/searchable.

The source must still pass its own canonical visibility/readiness/rights checks.

## Sharing and repost references

A share is a non-authoritative deep link/reference action.

Sharing:

- does not change source visibility;
- does not grant access;
- does not change ownership or rights;
- does not make UNLISTED content searchable;
- does not make PRIVATE content accessible.

If reposts are later implemented, they remain 420Hz application/community references to the original canonical Recording/release.

A repost must not duplicate the underlying Recording into a competing canonical object.

Share/repost counts cannot be treated as canonical proof of popularity, chart score, Award eligibility, protocol trust or economic value.

## CommunityActivity

`CommunityActivity` is rebuildable derived presentation state.

It preserves:

- source type;
- source ID;
- source revision.

Projection lag, failure or rebuild cannot create or delete the underlying community relation.

If a source follow/favorite/playlist state is deleted/deactivated/tombstoned, stale projections must not resurrect it.

Visibility of CommunityActivity may never exceed the source object's visibility.

## Counts and metrics

Follower, favorite, playlist and share/repost counts are derived presentation metrics.

They may be recomputed.

They are not canonical for:

- Creative rights;
- payments/rewards;
- Charts;
- Awards;
- Identity/trust;
- Governance.

HZ-GCA-1.11 may later define which approved community-derived signals may enter chart methodology.

HZ-GCA-1.12/1.13 may later define whether any community data affects Awards eligibility or voting.

Until then, no automatic conversion is allowed.

## Commons and Town separation

420Commons retains community-space/channel membership and role authority.

420Town retains its own Community/Membership/RoleBinding/PermissionGrant/Post/Thread/Comment/Vote authority where Town is used.

420Hz Community follows/favorites/playlists are not alternate Commons/Town membership, roles or votes.

A 420Hz playlist is not a Town community.

A follow is not a Town subscription.

A favorite is not a Town vote.

## Search

420Search remains rebuildable/non-authoritative discovery.

It may index only eligible PUBLIC community objects/projections.

It must not broad-index:

- PRIVATE favorite state;
- PRIVATE playlists;
- UNLISTED playlists;
- hidden/tombstoned/deactivated community state.

Search disappearance does not delete source community state.

Search ranking cannot broaden source visibility.

## Notifications

420Notifications may deliver opt-in alerts about community events.

Notifications:

- do not mutate source community state;
- do not become follow/favorite/playlist authority;
- cannot bypass Wallet/session mutation checks through a deep link/action;
- do not roll back source state if delivery fails.

Private notification preferences/endpoints remain governed by Notifications/privacy boundaries.

## Idempotency and replay

Follow/unfollow and favorite/unfavorite must be replay safe.

A duplicated network/client request cannot create:

- a second active relation;
- an extra aggregate count;
- an economic/Chart/Awards side effect.

Playlist mutations use stable item identities/revisions so retries cannot silently duplicate membership.

Derived rebuilds must respect tombstones/deactivation.

## Deletion and retention

Community application-controlled deletion/tombstone follows HZ-GCA-1.8.

Private/unlisted community state must stop being served/projected immediately on accepted deletion/tombstone.

Physical retention follows the bounded storage policy.

Community deletion does not erase independent Creative, Identity or chain history.

## Moderation interaction

HZ-GCA-1.10 does not finalize block/mute/report semantics.

Those remain part of **HZ-GCA-1.14 — Define moderation & dispute boundaries**.

A later block/mute may suppress presentation/interactions, but it must not silently fabricate unfollow/unfavorite or delete unrelated canonical state unless the user explicitly performs the corresponding mutation.

Comments/replies remain deferred until moderation/reporting/appeal boundaries are fully implemented and qualified.

## Failure cases

Community authority fails closed if:

- a mutation lacks qualified Wallet/session actor authority;
- a client address/profile string is used as authorization;
- replay creates duplicate follow/favorite state;
- a non-owner mutates a playlist;
- a playlist widens underlying Recording/source visibility;
- private community state enters public Search/activity;
- UNLISTED playlist state enters broad Search/trending;
- stale Search/Indexer/Notifications state attempts to overwrite source community state;
- follow/favorite/playlist/share is interpreted as membership, rights, payment, Award vote or governance;
- comments/replies are enabled before later moderation requirements are satisfied.

## Invariants

The machine-readable policy freezes **HZGCA-COM-001 through HZGCA-COM-018**.

The key guarantees are:

- 420Hz owns only explicit 420Hz community state;
- public reads may remain anonymous;
- mutations require Wallet/session authority;
- Identity is optional presentation/policy context;
- follow/favorite uniqueness is replay safe;
- favorite is private by default;
- playlist visibility never widens source visibility;
- community metrics are derived;
- Commons/Town/Creative/Charts/Awards/Pay/Governance authority remains separate;
- deletion/tombstone defeats stale projection resurrection;
- moderation-dependent behavior remains deferred.

## Source reconciliation

HZ-GCA-1.10 preserves the already-frozen rules from:

- HZ-GCA-1.1 product boundaries;
- HZ-GCA-1.2 canonical object model;
- HZ-GCA-1.7 privacy;
- HZ-GCA-1.8 retention/deletion;
- DoobTube product authority patterns for anonymous reads, Wallet-authorized mutations, optional Identity and non-authoritative sharing;
- 420Town's independent membership/role/content authority;
- 420Search non-authoritative discovery;
- 420Notifications non-authoritative delivery.

No ABI, contract address, live service, provider or testnet state is asserted.

## HZ-GCA-1.10 exit criteria

HZ-GCA-1.10 is complete when:

- 420Hz-owned community objects and derived/external authority boundaries are explicit;
- anonymous-read vs Wallet-authorized mutation policy is explicit;
- Identity/Commons/Town/Creative/Search/Notifications/Charts/Awards/Governance separation is explicit;
- follow/favorite/playlist/share/repost semantics are explicit;
- source visibility remains the upper bound;
- replay/idempotency/deletion/anti-resurrection rules are explicit;
- comments/moderation-dependent features remain correctly deferred;
- targeted exact-head verifier passes;
- no live/deployed/testnet claim is invented;
- parent HZ-GCA-1 remains open.

Next canonical work package:

**HZ-GCA-1.11 — Define Charts rules**
