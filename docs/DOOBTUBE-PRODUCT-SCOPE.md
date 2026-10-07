# DoobTube — V1 product scope and canonical user workflows

Roadmap step: **DOOBTUBE-1 — Product scope and canonical user workflows**
Status: **ADOPTED**
Date: 2026-10-06

## 1. Purpose

DoobTube V1 is the 420Integrated user-facing video application/client built over the canonical 420Media service defined by DOOBTUBE-0.

V1 gives users a coherent video experience for:

- discovering and watching qualified public video;
- using direct unlisted links where authorization permits;
- connecting a Wallet for creator/controller actions;
- optionally presenting a 420Identity profile without making Identity mandatory;
- uploading, publishing and managing video through 420Media;
- creating, watching and controlling basic livestreams;
- subscribing to creator-update notifications as a replaceable application preference;
- reporting abuse/rights concerns and participating in application-scoped moderation/appeal flows;
- deleting owned media through the owning service boundary;
- exporting user-visible metadata/provenance references;
- using the application accessibly across desktop and mobile layouts.

DoobTube V1 is not a new media protocol. Product requirements must preserve the authority boundaries in `docs/DOOBTUBE-ARCHITECTURE.md`.

## 2. Product principles

- **DT-PROD-001 — Public viewing without forced identity.** A visitor may browse/search/watch eligible PUBLIC media without connecting a Wallet or creating a 420Identity profile.
- **DT-PROD-002 — Wallet only when authority is required.** Creator/controller/moderation actions that mutate state require the qualified Wallet/session boundary; viewing public media does not.
- **DT-PROD-003 — Identity remains optional.** A user may attach an active Wallet-controlled 420Identity profile for display/context, but Wallet-only pseudonymous operation remains valid where the owning service permits it.
- **DT-PROD-004 — Canonical service state wins.** DoobTube never reports upload, publication, deletion, livestream, rights or moderation success merely because local UI state changed.
- **DT-PROD-005 — No shadow authority.** Product behavior must use canonical owning services rather than inventing DoobTube-specific ownership, rights, storage, payment or protocol truth.
- **DT-PROD-006 — Explicit failure states.** Loading, empty, unavailable, pending, success and error states must be visible and distinguishable for every core workflow.
- **DT-PROD-007 — Privacy is fail-closed.** A presentation/index/cache failure must never widen a media item's canonical visibility.
- **DT-PROD-008 — Replaceable discovery.** Feeds, ranking and recommendations are application presentation only and may be rebuilt or replaced without changing canonical media state.

## 3. Account, Wallet and optional Identity

### DT-ACCOUNT-001 — Anonymous visitor mode

Anonymous visitors can:

- open the application;
- browse the public home/discovery feed;
- search public media;
- open PUBLIC media detail/playback pages;
- open an UNLISTED media URL only when the owning service says the request is permitted;
- watch public livestreams when playback is available;
- view non-sensitive creator presentation information.

Anonymous visitors cannot perform creator/controller/moderator mutations.

**Acceptance:** no Wallet prompt is required merely to load public discovery or PUBLIC playback.

### DT-ACCOUNT-002 — Wallet connection

A user can connect a compatible injected Wallet.

The client must:

- validate account shape;
- validate expected chain/network before authority-bearing actions;
- show disconnected, connected and wrong-network states;
- invalidate authority-sensitive local state when account/network changes;
- never accept or persist private keys, seed phrases or mnemonics.

**Acceptance:** wrong-network state blocks mutations without blocking safe public browsing.

### DT-ACCOUNT-003 — Optional Identity presentation

A connected Wallet may select an active Wallet-controlled 420Identity profile where the qualified dependency permits it.

Identity is optional:

- zero/no profile means Wallet-only pseudonymous operation;
- selecting a profile cannot widen Wallet authority;
- DoobTube does not create, edit, revoke or transfer canonical Identity state in V1;
- profile-management UI must hand off to the owning Identity application/service if offered.

**Acceptance:** a Wallet-only creator can use otherwise-authorized V1 creator workflows.

## 4. Creator/channel presentation model

### DT-CHANNEL-001 — Creator page

V1 exposes a creator/channel presentation page keyed to the authoritative creator/controller context returned by qualified services.

It may display:

- display name/profile presentation when available;
- Wallet-safe shortened identity presentation;
- public videos;
- currently discoverable public livestreams;
- subscription/update control.

A DoobTube "channel" is **presentation grouping, not a new canonical identity object**.

### DT-CHANNEL-002 — No separate channel authority

V1 creates no channel ownership contract, channel token, channel Registry authority or parallel identity record.

If a creator has no 420Identity profile, DoobTube may present a pseudonymous Wallet-derived creator label.

**Acceptance:** deleting or replacing DoobTube cannot invalidate the creator's canonical Wallet/Identity/Media ownership.

## 5. Upload, publication and creator library

### DT-MEDIA-001 — Creator library

A connected authorized creator can view a cursor-paginated library of media visible to that creator, including current canonical/presentation state.

Required UI states:

- loading;
- empty;
- populated;
- pagination/load-more;
- error;
- stale/revalidation-needed.

### DT-MEDIA-002 — Prepare and upload video

V1 supports video upload through the qualified 420Media/Storage boundary.

The workflow must:

1. require Wallet/network validity;
2. accept a browser `video/*` file;
3. select V1 visibility;
4. collect required qualified Storage references/configuration;
5. compute/retain integrity input required by the Media service;
6. use an idempotent upload-preparation request;
7. send raw bytes only to the qualified off-chain transport endpoint;
8. poll/revalidate canonical Media/Storage state;
9. report success only after canonical READY state.

**Acceptance:** transport acceptance alone is never displayed as completed publication/readiness.

### DT-MEDIA-003 — V1 visibility choices

Creator-facing V1 supports:

- `PRIVATE`;
- `UNLISTED`;
- `PUBLIC`.

Other ecosystem visibility scopes remain outside the initial DoobTube V1 UI until explicitly promoted by a later canonical requirement.

Rules:

- PRIVATE never enters public discovery;
- UNLISTED is not searchable/browsable by public discovery merely because a URL exists;
- PUBLIC is only discoverable when the owning Media/Rights/Search qualification allows it.

### DT-MEDIA-004 — Publication and Rights gate

Selecting PUBLIC visibility is not sufficient proof of publication authority.

Public publication/discovery requires the canonical Rights/provenance guard supplied by the owning services.

The UI must surface:

- pending/unverified publication state;
- Rights/provenance denial;
- unavailable/stale authority;
- successful public eligibility only after authoritative revalidation.

### DT-MEDIA-005 — Edit boundary

V1 may allow editing application presentation metadata only where the qualified Media API exposes an authorized operation.

DoobTube must not invent mutable canonical fields or overwrite canonical provenance.

Any field not supported by the owning API is read-only/deferred.

## 6. Playback

### DT-PLAY-001 — Safe playback

V1 can play a media asset only when a qualified service supplies an allowed playback locator.

The app:

- does not derive a playback URL from an object ID;
- rejects unsafe URL schemes/credentials;
- uses native playback controls;
- does not require autoplay;
- surfaces playback unavailable/error states without changing asset authority.

### DT-PLAY-002 — Media detail

A media detail view must distinguish presentation metadata from canonical/provenance references.

At minimum, where available, it should expose:

- title/display metadata;
- creator presentation;
- visibility relevant to the viewer;
- media state;
- rights/provenance reference/status;
- playback availability;
- report action;
- share action for eligible PUBLIC/UNLISTED media.

## 7. Discovery, feed and Search

### DT-DISC-001 — Public home feed

V1 provides a public discovery/home feed composed only from records eligible for public presentation.

The feed is rebuildable and non-authoritative.

A feed item disappearing/reordering does not alter Media ownership, Rights or availability.

### DT-DISC-002 — Search

V1 supports user-entered search over the qualified public Search projection.

Search must:

- exclude PRIVATE content;
- exclude UNLISTED content from public results;
- exclude deleted/not-ready/not-authorized public projection;
- distinguish no-results from service failure;
- never treat ranking as canonical status.

### DT-DISC-003 — Ranking/recommendations

V1 may provide deterministic/rebuildable ranking such as recent/popular/recommended only from eligible public inputs.

Ranking is explicitly non-authoritative and may not use undisclosed private content.

Personalized recommendation engines are not required for V1.

## 8. Livestreaming

### DT-LIVE-001 — Basic livestream creation/control

V1 includes basic livestreaming because the canonical Media target includes `video_uploads_basic_livestreaming`.

Authorized controllers can:

- create;
- refresh status;
- start;
- stop

through the qualified Media service.

Every authority-bearing action requires Wallet/network validation and the `media.livestreaming` capability.

### DT-LIVE-002 — Live viewing/discovery

Where the qualified Media service supplies safe playback/presentation state, V1 may display and play a live stream.

PUBLIC livestream discovery must obey the same public eligibility/privacy principles as video discovery.

### DT-LIVE-003 — Failure recovery

A failed create/start/stop request does not let DoobTube assume remote state.

The UI must require canonical status refresh/revalidation before representing or retrying an ambiguous state transition.

## 9. Creator subscriptions / following

### DT-SUB-001 — Subscribe to creator updates

V1 includes a simple **Subscribe** control for creator updates.

Subscription is:

- opt-in;
- reversible;
- non-custodial;
- non-authoritative for creator ownership;
- not a paid entitlement;
- not a prerequisite to view PUBLIC media.

The exact persistence and Notifications integration are frozen in DOOBTUBE-2/DOOBTUBE-5.

### DT-SUB-002 — Notification consent separation

Operational/content update subscription does not imply marketing/promotional consent.

If promotional notifications are later offered, they require separate explicit opt-in consistent with the canonical Media Notifications boundary.

## 10. Comments, reactions and sharing

### DT-SOCIAL-001 — Comments deferred

User comments on videos/livestreams are **not included in V1**.

Reason: the audited Media service does not establish a canonical comment authority for DoobTube. Introducing comments before DOOBTUBE-2 would create an unnecessary parallel content/moderation subsystem.

### DT-SOCIAL-002 — Reactions/likes deferred

Likes, dislikes, emoji reactions and reaction counts are **not included in V1**.

No on-chain vote/reaction semantics are inferred from unrelated canonical `Vote` objects.

### DT-SOCIAL-003 — Sharing included

V1 supports non-authoritative sharing of eligible media by copying/opening its canonical application URL/reference.

Sharing:

- does not change visibility;
- does not grant access to PRIVATE media;
- does not make UNLISTED media searchable;
- does not create ownership/rights authority.

## 11. Monetization

### DT-MONEY-001 — Viewer monetization deferred

V1 does **not** include:

- paid subscriptions;
- pay-per-view;
- creator tips/donations;
- advertising/revenue sharing;
- sponsored ranking;
- token-gated access;
- creator payout dashboards.

420Media's Pay/Compute settlement integrations are not automatically equivalent to DoobTube creator monetization.

Any monetization feature requires an explicit later product/architecture amendment and qualified Pay/entitlement boundaries.

### DT-MONEY-002 — No app custody

DoobTube never holds viewer or creator funds in V1.

## 12. Rights and provenance

### DT-RIGHTS-001 — Rights-aware publication

Public publication and discoverability must fail closed when canonical Rights/provenance authorization cannot be established where required.

### DT-RIGHTS-002 — Provenance presentation

Where canonical provenance references are available, V1 exposes them in a user-understandable detail surface without claiming that a Rights record proves external legal truth beyond its canonical protocol meaning.

### DT-RIGHTS-003 — Licensed reuse/derivatives

V1 does not create a new derivative/remix licensing workflow.

If a qualified Media API presents an already-authorized derivative, DoobTube may display it. Creating/reusing derivatives remains outside V1 until explicitly scoped.

## 13. Privacy and visibility

### DT-PRIV-001 — Visibility enforcement

DoobTube presentation must never widen canonical visibility.

- PRIVATE: owner/authorized access only; never public Search/feed.
- UNLISTED: direct authorized reference presentation only; never public Search/feed by default.
- PUBLIC: eligible for public presentation only after canonical readiness/Rights checks.

### DT-PRIV-002 — No client-side access authority

A hidden button, route guard or cached visibility flag is never sufficient authorization for protected media.

### DT-PRIV-003 — Minimal correlation

V1 should not require 420Identity for public viewing or Wallet-only creator operation, and telemetry must not be treated as identity authority.

Detailed retention/logging/analytics implementation belongs to later security/runtime steps.

## 14. Reporting, moderation and appeals

### DT-MOD-001 — User report flow

V1 includes a Report action for eligible Media-domain targets.

A report may include:

- target reference;
- category/reason;
- optional opaque evidence reference;
- user-visible acknowledgement/status where supported.

Submitting a report does not itself hide/delete/transfer the target.

### DT-MOD-002 — Application-scoped moderation

Authorized moderators may perform only qualified application-scoped actions exposed by the owning Media moderation boundary, such as hide/lock/suspend/restore where supported.

Moderation cannot:

- change canonical ownership;
- rewrite Rights;
- move funds;
- sign Wallet actions;
- become Governance;
- fabricate Arbitration finality.

### DT-MOD-003 — Appeal flow

Where an application moderation decision is appealable, V1 includes an appeal submission/status path.

Appeals preserve prior decision history rather than rewriting it.

### DT-MOD-004 — Block/mute scope

User-level local block/mute presentation controls may be introduced only as non-authoritative application preferences. They do not alter canonical access or another user's rights.

## 15. Delete, retention and export

### DT-DATA-001 — Delete owned media

An authorized owner/controller may request deletion/removal through the owning Media/Storage service when that operation is supported.

The UI must:

- require Wallet/network authorization;
- show pending/success/failure honestly;
- stop public presentation only when authoritative state requires it;
- not claim canonical storage/history erasure when the owning protocol retains immutable commitments/audit history.

### DT-DATA-002 — Retention transparency

V1 must present the retention/deletion semantics exposed by the owning service and must not promise irreversible physical deletion that repository evidence cannot guarantee.

DoobTube-local cache/preferences should be disposable and reconstructable.

### DT-DATA-003 — Export

An authorized user can request/export DoobTube-visible account/creator/media metadata and canonical references in a portable machine-readable form once the runtime/API step implements it.

V1 export scope includes, where available:

- creator presentation reference;
- owned MediaAsset identifiers;
- visibility/state;
- canonical Storage/Media references;
- Rights/provenance references;
- livestream identifiers/status history exposed to that user;
- DoobTube subscription/preferences.

Raw video byte export/download is only offered if a qualified owning service supplies an authorized safe download/playback mechanism; DoobTube does not fabricate direct Storage access.

## 16. Accessibility and responsive UX

### DT-UX-001 — Semantic/accessibility baseline

Core workflows require:

- semantic page structure/headings/forms;
- keyboard-operable controls;
- explicit labels;
- visible focus;
- status/error announcements;
- no color-only critical state;
- reduced-motion support;
- native media controls or equivalent accessible controls.

### DT-UX-002 — Responsive baseline

Core workflows must remain usable on narrow/mobile and desktop layouts without a desktop-only dependency.

### DT-UX-003 — Safe remote content rendering

Service-provided text/media metadata must be rendered without unsafe HTML/script execution.

### DT-UX-004 — Explicit capability/unavailable state

If runtime/service capability is unavailable, the application displays that state and disables only the affected authority-bearing action rather than pretending success.

## 17. Canonical V1 routes / surfaces

Exact URL syntax may be finalized with the frontend/runtime implementation, but V1 requires equivalent user surfaces for:

1. **Home/discovery**
2. **Search**
3. **Media detail/playback**
4. **Creator/channel presentation**
5. **Creator library**
6. **Upload**
7. **Livestream create/control**
8. **Public live viewing**
9. **Subscriptions/preferences**
10. **Report/appeal**
11. **Data export/delete controls**
12. **Wallet/network/session status**

Route names are presentation details; the workflow capabilities are the requirement.

## 18. Product state machines

### 18.1 Session / authority state

```text
ANONYMOUS
  -> WALLET_CONNECTING
  -> WALLET_CONNECTED
  -> WRONG_NETWORK
  -> AUTHORITY_READY

account/network change:
  AUTHORITY_READY -> REVALIDATION_REQUIRED
  REVALIDATION_REQUIRED -> AUTHORITY_READY | WRONG_NETWORK | ANONYMOUS
```

Rules:

- public browse/playback remains possible from ANONYMOUS when content is public;
- authority-bearing mutations require AUTHORITY_READY;
- account/network change invalidates mutation context.

### 18.2 Upload/publication state

```text
IDLE
 -> PREPARING
 -> PREPARED
 -> UPLOADING
 -> WAITING_CANONICAL_READY
 -> READY_PRIVATE | READY_UNLISTED | PUBLICATION_REVALIDATING
 -> READY_PUBLIC

failure:
 any in-flight state -> ERROR_RETRYABLE | ERROR_TERMINAL

visibility/right change:
 READY_PUBLIC -> PUBLICATION_REVALIDATING -> READY_PUBLIC | NON_PUBLIC
```

Rules:

- PREPARED/UPLOADED transport state is never equivalent to READY;
- PUBLIC requires canonical readiness and Rights/publication authorization.

### 18.3 Playback state

```text
UNRESOLVED -> UNAVAILABLE | READY -> PLAYING
READY | PLAYING -> ERROR
```

Playback state never mutates media authority.

### 18.4 Livestream state

```text
IDLE -> CREATING -> CREATED -> STARTING -> ACTIVE -> STOPPING -> CLOSED
                         \-> ERROR_REVALIDATE
ACTIVE ------------------\-> ERROR_REVALIDATE
```

Ambiguous failures transition to ERROR_REVALIDATE, not assumed ACTIVE/CLOSED.

### 18.5 Subscription state

```text
NOT_SUBSCRIBED -> SUBSCRIBING -> SUBSCRIBED
SUBSCRIBED -> UNSUBSCRIBING -> NOT_SUBSCRIBED
any mutation failure -> REVALIDATE
```

Subscription state is a replaceable preference, not access entitlement.

### 18.6 Report / moderation / appeal state

```text
REPORT_DRAFT -> REPORT_SUBMITTING -> REPORT_SUBMITTED
moderator: OPEN -> DECIDED
appealable decision: DECIDED -> APPEAL_SUBMITTED -> APPEAL_DECIDED
```

Historical decisions remain auditable; appeal never overwrites prior decision history.

### 18.7 Delete state

```text
ACTIVE -> DELETE_REQUESTING -> DELETE_PENDING -> DELETED_OR_RETIRED
                        \-> DELETE_FAILED_REVALIDATE
```

DoobTube does not promise erasure beyond authoritative service semantics.

## 19. V1 non-goals

The following are explicitly outside DoobTube V1 unless a later canonical roadmap amendment promotes them:

- a separate DoobTube media protocol or service authority;
- DoobTube-owned smart contracts solely to recreate existing protocol functions;
- comments or threaded discussion;
- likes/dislikes/reaction counters;
- creator paid subscriptions;
- pay-per-view;
- creator tipping/donations;
- advertising marketplace or revenue sharing;
- sponsored ranking;
- token-gated media;
- NFT minting tied to uploads;
- creator payout accounting;
- decentralized recommendation consensus;
- mandatory real-name/420Identity use;
- social graph ownership on-chain;
- importing/mirroring third-party video platforms;
- automated copyright adjudication;
- DRM invention;
- browser custody of Wallet keys;
- client-side private-media authorization;
- permanent/raw-media storage on-chain;
- direct bridge/oracle/governance/treasury authority;
- full video editor or studio;
- shorts/stories/ephemeral video;
- private/group video calls;
- comments/chat attached to livestreams;
- mobile native apps in the initial V1;
- production domain or deployment claims during repository product-scope work.

## 20. Acceptance matrix

| Requirement group | V1 acceptance |
|---|---|
| Account/Wallet | Public viewing works anonymously; mutations require valid Wallet/network; Identity optional |
| Channel | Creator presentation exists without creating a new canonical channel authority |
| Upload/library | Creator can prepare/upload, observe canonical readiness and browse owned library |
| Visibility | PRIVATE/UNLISTED/PUBLIC semantics fail closed and public discovery cannot widen them |
| Playback | Only qualified safe playback locators are used |
| Discovery/Search | Only eligible public media enters browse/search; failures/no-results are distinct |
| Livestream | Create/status/start/stop + public viewing when qualified; ambiguous failures revalidate |
| Subscribe | Opt-in reversible creator-update subscription; not paid access |
| Social | Sharing included; comments/reactions explicitly absent |
| Monetization | No viewer/creator monetization or app custody in V1 |
| Rights | Public publication requires authoritative Rights/provenance validation |
| Moderation | Report + scoped moderation + appeal; no ownership/fund/protocol authority |
| Delete/retention/export | Authorized delete request, truthful retention semantics, metadata/reference export |
| Accessibility | Keyboard/semantic/status/focus/reduced-motion baseline |
| Responsive | Core workflows usable on mobile/narrow and desktop |
| Security boundary | No private keys; no client-only authorization; no unsafe remote rendering |

## 21. Requirement ownership for later roadmap steps

DOOBTUBE-1 freezes **what V1 must do**, not the exact dependency/API/storage implementation.

- DOOBTUBE-2 maps these requirements to exact 420Integrated dependencies/trust boundaries.
- DOOBTUBE-3 freezes schemas/lifecycle/idempotency/storage/processing ownership.
- DOOBTUBE-4 implements any proven contract/adapters only if necessary.
- DOOBTUBE-5 implements backend/API/indexing/service control plane.
- DOOBTUBE-6 implements media delivery/processing/livestream integration.
- DOOBTUBE-7 implements the user-facing web application.
- DOOBTUBE-8 qualifies the converged app integration milestone.
- DOOBTUBE-9 closes security/abuse/moderation qualification.
- DOOBTUBE-10 closes docs/deployment/operator readiness.
- DOOBTUBE-11 performs repository Level 3 closeout.

## 22. Exit decision

DOOBTUBE-1 is satisfied when:

1. all required roadmap product categories are explicitly included or excluded;
2. requirement IDs are stable;
3. V1 non-goals are explicit;
4. core user/state-machine behavior is explicit;
5. each major requirement group has acceptance criteria;
6. the scope preserves DOOBTUBE-0 authority boundaries;
7. the DoobTube verifier qualifies the exact implementation SHA.

**Next canonical roadmap step: DOOBTUBE-2 — Dependency and trust-boundary freeze.**
