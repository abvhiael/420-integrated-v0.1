# HZ-GCA-1.10 — Community authority model qualification evidence

Status: **COMPLETE — Level 1**

Canonical parent step: **HZ-GCA-1 — Scope, threat model and authority map**

Work package: **HZ-GCA-1.10 — Define Community authority model**

## Qualification identity

- Repository: `abvhiael/420-integrated-v0.1`
- PR: **#565 — Add 420Hz Generate, Community & Awards roadmap phase**
- Branch: `feature/420hz-generate-community-awards-roadmap`
- Current `main` / base SHA: `c6b62a6ea75be97564564e56b779dfad7df3f784`
- Qualified implementation SHA: `83fcee7d2e32e564542417eeb837fe8206544738`
- Qualification level: **Level 1 — per-roadmap-step fast qualification**
- Level 2 milestone: **NOT REQUIRED for HZ-GCA-1.10**
- Level 3: **DEFERRED to HZ-GCA-17 phase closeout**

## Canonical definition

HZ-GCA-1.10 freezes 420Hz Community authority for follows, favorites, playlists/playlist items, share/repost references and derived community presentation.

It explicitly preserves Wallet, Identity, Creative, Commons/Town, Search, Notifications, Charts, Awards and Governance boundaries.

## Implementation completed

Added:

- `hz/config/gca-community-authority-v1.json`
- `docs/architecture/420hz/HZ-GCA-1.10-COMMUNITY-AUTHORITY.md`
- `scripts/verify-420hz-gca-1-10.py`

Updated:

- `docs/420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md`
- `.github/workflows/420hz-gca.yml`

## Requirements satisfied

### 420Hz-owned community state

Owned application/community objects are limited to:

- ArtistFollow
- RecordingFavorite
- Playlist
- PlaylistItem

CommunityActivity and aggregate counts/feeds remain derived/rebuildable.

### Access model

- eligible PUBLIC reads may remain anonymous;
- follow/favorite/playlist mutations require qualified Wallet/session actor authority;
- Wallet connection alone is not mutation approval;
- client account/profile strings cannot authorize mutation;
- optional 420Identity is presentation/policy context and does not widen Wallet authority.

### ArtistFollow

- one logical active relation per follower account + artist Creator;
- replay/idempotency cannot create duplicate active relations/count inflation;
- follow does not imply Commons/Town membership, ownership, trust, paid entitlement, chart qualification, Award vote or economic right.

### RecordingFavorite

- one logical active relation per account + canonical Recording;
- PRIVATE by default under HZ-GCA-1.7;
- favorite does not imply ownership, rights, play/qualified play, chart point, Award vote or reward.

### Playlist / PlaylistItem

- owner-controlled PRIVATE / UNLISTED / PUBLIC visibility;
- owner/controller Wallet/session required for mutation;
- playlist is not a Creative Release;
- playlist membership grants no rights/playback authority;
- PlaylistItem references native canonical Recording identity;
- playlist visibility cannot widen source Recording visibility.

### Share / repost references

- sharing is non-authoritative and does not change visibility/access/rights;
- UNLISTED sharing does not create Search visibility;
- PRIVATE sharing does not grant access;
- future repost state must remain an application reference to original canonical media rather than duplicating Recording authority.

### Projections / counts

CommunityActivity, follower/favorite/playlist counts and future community feeds are rebuildable presentation state.

Projection lag/rebuild cannot create source relations.

Counts have no automatic rights, payment, Charts, Awards, Identity/trust or Governance meaning.

### Commons / Town separation

420Commons retains space/channel membership/role authority.

420Town retains its own Community/Membership/RoleBinding/PermissionGrant/Post/Thread/Comment/Vote authority where used.

420Hz follow/favorite/playlist state is not alternate Town/Commons membership/voting authority.

### Search / Notifications

- Search indexes only eligible PUBLIC community state;
- PRIVATE and UNLISTED state cannot leak into broad Search;
- Search remains non-authoritative;
- Notifications are opt-in delivery only;
- notification failure does not roll back source mutations;
- notification deep links cannot bypass Wallet/session checks.

### Charts / Awards separation

Community events are not automatically qualified Chart events or Award votes.

HZ-GCA-1.11 owns later chart methodology.

HZ-GCA-1.12/1.13 own later Awards architecture and nomination/voting policy.

### Moderation deferral

Block/mute/report authority is deliberately deferred to HZ-GCA-1.14.

Comments/replies remain deferred until moderation/reporting/appeal boundaries are fully implemented and qualified.

## Community invariants

The manifest freezes **HZGCA-COM-001 through HZGCA-COM-018**.

The targeted verifier checks:

- exact HZ-owned community object set;
- required external authority boundaries;
- anonymous/public read policy;
- Wallet-authorized mutation policy;
- follow/favorite uniqueness;
- favorite privacy default;
- playlist visibility vocabulary and owner control;
- source visibility upper bound;
- share/repost non-authority;
- CommunityActivity derivation;
- Commons/Town separation;
- Charts/Awards separation;
- Search/Notifications non-authority;
- replay/idempotency/deletion anti-resurrection;
- moderation/comment deferral;
- all 18 invariant IDs;
- prerequisite HZ-GCA-1.2/1.7/1.8 state;
- roadmap Level-1/non-milestone classification.

## Level-1 qualification

Dedicated workflow:

**420Hz GCA Qualification**

Successful exact-head run:

- Run ID: **37734638659**
- Run number: **#113**
- Job: **HZ-GCA Level 1**
- Job ID: **113171291052**
- Exact tested SHA: `83fcee7d2e32e564542417eeb837fe8206544738`
- Result: **PASS**

Successful checks:

1. exact PR-head checkout/verification;
2. all GCA JSON manifest syntax validation;
3. retained HZ-GCA-1.1 verifier;
4. retained HZ-GCA-1.2 verifier;
5. retained HZ-GCA-1.3 verifier;
6. retained HZ-GCA-1.4 verifier;
7. retained HZ-GCA-1.5 verifier;
8. retained HZ-GCA-1.6 verifier;
9. retained HZ-GCA-1.7 verifier;
10. retained HZ-GCA-1.8 verifier;
11. retained HZ-GCA-1.9 verifier;
12. HZ-GCA-1.10 Community authority verifier.

No required Level-1 step was skipped, cancelled, stale or substituted.

The concurrently triggered **420Hz Web Qualification #79** also passed on the same implementation SHA. It is collateral evidence rather than a substitute for GCA Level 1.

## CI diagnosis

The HZ-GCA Level-1 job initially waited in the runner queue, then executed normally and passed.

Classification: **runner/queue delay only**.

There was no HZ-GCA-1.10 implementation, verifier or workflow failure on the qualified SHA.

## Security / adversarial result

Result: **PASS**

The verifier fails policies that:

- authorize mutations from client-supplied account/profile strings;
- permit duplicate active follow/favorite relations;
- let non-owners mutate playlists;
- leak PRIVATE favorites/playlists into public projection;
- broad-index UNLISTED playlists;
- widen source Recording visibility through playlists;
- let Search/Indexer/Notifications overwrite source community state;
- reinterpret community state as Commons/Town membership, rights, payment, Award vote or governance;
- enable comments/replies before later moderation requirements.

## Level 2 status

**Not run / not required.**

HZ-GCA-1.10 is an ordinary architecture/authority work package. It introduces no new shared executable community service and is not the documented HZ-GCA-1 milestone boundary.

The HZ-GCA-1 Level-2 milestone remains **HZ-GCA-1.20**.

## Intentionally deferred Level 3

Deferred to HZ-GCA-17:

- canonical full Solidity inventory;
- Genesis/address-authority qualification;
- 420 Integrated/global qualification;
- repository-wide Docs/global reconciliation;
- retained 420Hz app suite;
- affected clients/services/Indexer/Search/RPC/frontend/backend suites;
- full adversarial/invariant/static/security qualification;
- deployment/config verification.

At Level 3, Solidity Contracts owns the canonical full Foundry inventory. Genesis/address-authority verification remains separate and must not duplicate it.

## Limitations

HZ-GCA-1.10 intentionally does not implement:

- the runtime Community API/store;
- real follow/favorite/playlist persistence endpoints;
- moderation/block/mute/report workflows;
- comments/replies;
- Charts weighting;
- Awards eligibility/voting integration;
- production Search/Notifications integration;
- testnet/production deployment.

Those remain later roadmap work.

## Blockers

None for HZ-GCA-1.10.

## Completion state

**HZ-GCA-1.10 — COMPLETE (Level 1).**

Parent **HZ-GCA-1 remains IN PROGRESS**.

Next canonical work package:

**HZ-GCA-1.11 — Define Charts rules**
