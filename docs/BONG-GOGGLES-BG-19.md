# Bong Goggles BG-19 — Full Web Application + Public-Facing UI

BG-19 builds the production Bong Goggles web application for `https://bonggoggles.420integrated.org` on top of the qualified contracts, indexer, media, messaging, games, notifications, moderation, rewards, search and wallet-session infrastructure delivered through BG-18.

The web application is a presentation and transaction-intent layer. It must not create a second source of truth for social state, messaging state, moderation state, rewards, identity, permissions or Wallet authority.

## Product goals

- deliver a complete desktop and mobile-responsive social application;
- expose all qualified Genesis Bong Goggles capabilities through one coherent user experience;
- bind authentication/session state to 420Wallet / qualified passkey-session infrastructure;
- keep canonical chain/indexer state authoritative;
- make every state-changing operation explicit, reviewable and Wallet/session-policy constrained;
- support graceful degraded/read-only behavior when chain, indexer, media, Messenger or notification dependencies are unavailable;
- meet accessibility, performance, security and observability launch gates;
- produce a deployable production bundle for `bonggoggles.420integrated.org`.

## Authority boundaries

The BG-19 client may:

- render canonical/projected state;
- compose content locally before publication;
- upload media through qualified media/storage paths;
- prepare and submit permitted transaction or service intents;
- hold short-lived local UI state;
- cache non-sensitive presentation data;
- display notifications, rewards and moderation state.

The BG-19 client must not:

- invent canonical posts, relationships, messages, rewards or moderation outcomes;
- mark rewards paid before canonical confirmation;
- decrypt or expose private Messenger content outside the qualified messaging boundary;
- store private keys or raw Wallet secrets;
- bypass 420Wallet/session policy;
- treat recommendation/search rank as social/reward authority;
- create wagered game flows inside Bong Goggles.

## Detailed roadmap

### BG-19.1 — web application foundation + runtime contract — COMPLETE AND QUALIFIED

Build the production frontend workspace and runtime boundary.

- create the Bong Goggles web-app package/workspace;
- select and freeze the production framework/build tool already compatible with repository conventions;
- define environment schema for chain ID, RPC, indexer/API origins, media service, Messenger, 420Notifications, Wallet, Explorer and feature flags;
- reject missing/unsafe production environment values at startup/build time;
- define typed application service clients rather than direct ad-hoc fetches throughout components;
- create deterministic app bootstrap states: loading, ready, degraded, unsupported-network and maintenance;
- configure production routing for `bonggoggles.420integrated.org`;
- add error boundary, global async error handling and structured client telemetry with privacy redaction;
- define CSP-compatible asset/runtime rules;
- add CI for build, typecheck, lint and web unit tests.

Implemented in:
- `bong-goggles/web/package.json`
- `bong-goggles/web/runtime-config.example.json`
- `bong-goggles/web/core/runtime-config.js`
- `bong-goggles/web/core/services.js`
- `bong-goggles/web/core/bootstrap.js`
- `bong-goggles/web/core/telemetry.js`
- `bong-goggles/web/app.js`
- `bong-goggles/web/index.html`
- `bong-goggles/web/styles.css`
- `bong-goggles/web/scripts/check.mjs`
- `bong-goggles/web/scripts/build.mjs`
- `bong-goggles/web/test/runtime.test.js`
- `.github/workflows/bong-goggles-web.yml`

BG-19.1 follows the repository's existing Wallet/Exchange web convention: dependency-light Node 22 qualification plus browser-native ES modules and a deterministic static build. Runtime configuration is versioned and fail-closed, production requires the canonical Bong Goggles host and HTTPS service origins, typed service clients centralize external calls, bootstrap state explicitly distinguishes loading/ready/degraded/unsupported-network/maintenance, telemetry recursively redacts sensitive fields, the HTML shell carries a restrictive CSP, and dedicated Web Verification CI checks static invariants, tests, build output and frontend secret leakage.

**Exit:** a production-buildable shell starts deterministically against testnet/staging/production configuration and fails closed on unsafe configuration.

### BG-19.2 — Wallet, Identity, passkey + session UX — COMPLETE AND QUALIFIED

Integrate qualified account/session infrastructure.

- connect/disconnect 420Wallet;
- display active account, chain and session state;
- enforce supported-chain detection and network-switch guidance;
- integrate BG-11 / BG-11C wallet-session and passkey/session access bridge;
- support session-expiry, revocation and capability-change UX;
- distinguish read-only browsing from authenticated/state-changing actions;
- show transaction-intent preview before canonical writes;
- require explicit Wallet confirmation where the underlying service requires it;
- handle rejected, replaced, reverted and pending transactions;
- never persist private keys, seed phrases, raw signing material or unrestricted bearer capabilities;
- include secure sign-out / local-session clear behavior.

Implemented in:
- `bong-goggles/web/core/wallet-session.js`
- `bong-goggles/web/core/transaction-intent.js`
- `bong-goggles/web/test/wallet-session.test.js`
- `bong-goggles/web/app.js`
- `bong-goggles/web/styles.css`

BG-19.2 now discovers only the qualified `is420Wallet` EIP-1193 provider, supports explicit connect and secure local sign-out, tracks `accountsChanged`, `chainChanged` and disconnect lifecycle events, blocks state-changing UX on the wrong chain, keeps anonymous browsing read-only, and exposes secure 420Wallet handoffs for passkey and delegated-session management. Session presentation explicitly represents active/expired/revoked state without turning application state into capability authority. Canonical writes are represented as reviewable, non-authoritative Wallet intents and remain pending until a canonical receipt confirms or reverts them; user rejection can never become local success. Bong Goggles stores no private key, seed phrase or raw signing material.

**Exit:** users can safely enter, leave and recover sessions while every write remains constrained by canonical Wallet/session policy.

### BG-19.3 — design system, navigation + responsive application shell — COMPLETE AND QUALIFIED

Build the reusable visual/application foundation.

- desktop, tablet and mobile responsive layouts;
- persistent top/side/bottom navigation appropriate to viewport;
- routes for Home, Profile, Friends, Messages, Notifications, Discover, Groups, Pages, Events, Games, Rewards and Settings;
- reusable typography, spacing, buttons, inputs, cards, dialogs, sheets, menus, tabs, toasts, skeletons and empty/error states;
- canonical avatar/media components using qualified media delivery;
- accessible keyboard/focus behavior;
- high-contrast and reduced-motion support;
- loading/degraded/offline visual language;
- route-level permission/session guards;
- consistent Explorer/Wallet handoff components for canonical state and transaction inspection.

Implemented in:
- `bong-goggles/web/core/routes.js`
- `bong-goggles/web/core/design-system.js`
- `bong-goggles/web/core/app-shell.js`
- `bong-goggles/web/test/app-shell.test.js`
- `bong-goggles/web/app.js`
- `bong-goggles/web/styles.css`

BG-19.3 establishes the shared application shell and route contract for Home, Profile, Friends, Messages, Notifications, Discover, Groups, Pages, Events, Games, Rewards and Settings. Navigation access is derived from current Wallet/network state instead of inventing permissions, private routes fail closed into read-only presentation, and public routes remain accessible without authentication. The shell now provides desktop side navigation, mobile bottom navigation, a responsive content column, canonical Wallet/Explorer handoffs, route headings, status rail and explicit degraded-network/service banners. Reusable cards, buttons, tabs, toasts, skeletons, empty/error states and canonical handoff components are defined centrally. Keyboard focus, reduced-motion and forced-colors behavior are included at the system level.

**Exit:** every later feature can be implemented without inventing one-off navigation, modal, loading or authority patterns.

### BG-19.4 — profiles, relationships + social graph UI — COMPLETE AND QUALIFIED

Expose the qualified profile and relationship model.

- own-profile and public-profile views;
- profile metadata/edit flows permitted by canonical contracts;
- friend request send/cancel/accept/decline;
- follow/unfollow and approval-required follow flows;
- friends/followers/following lists;
- block/mute controls and visible consequences;
- profile activity/media tabs;
- relationship-state badges driven from canonical projection;
- privacy/policy-aware action availability;
- canonical profile and relationship Explorer links;
- deterministic refresh after write confirmation;
- no optimistic relationship state that survives a canonical rejection.

Implemented in:
- `bong-goggles/web/core/profile-social.js`
- `bong-goggles/web/core/profile-ui.js`
- `bong-goggles/web/test/profile-social.test.js`
- `bong-goggles/web/core/app-shell.js`
- `bong-goggles/web/styles.css`

BG-19.4 mirrors the qualified contracts rather than inventing a browser-side relationship model. Profile projections preserve account/profile/status/type/hash/media metadata when supplied canonically. Relationship state supports symmetric friendship, directional follows, approval-pending friend/follow requests, block direction, scoped mute state and the contract's block side effects. Action availability is derived from current canonical relationship state plus Wallet/session write authority. Blocking suppresses ordinary friend/follow actions, incoming requests expose accept/decline, outgoing requests expose cancel, and inactive profiles disable new relationship creation.

Friends/followers/following/blocked/muted collections are deterministic projections and are never persisted as a second source of truth. Post-write state uses explicit canonical refresh semantics: optimistic state is not retained when the refreshed projection disagrees.

The repository's Bong Goggles indexer currently materializes profile and relationship records but does not expose a dedicated browser HTTP profile/relationship endpoint module. BG-19.4 therefore fails closed when that projection is unavailable rather than manufacturing relationship state in the browser. The UI integration is ready to consume the qualified projection transport when exposed by the deployment/application service layer.

**Exit:** profile and social-graph presentation/actions are implemented against the canonical model; browser state fails closed when the qualified projection transport is unavailable.

### BG-19.5 — home feed, publishing, interactions, media + stories — COMPLETE AND QUALIFIED

Build the central social experience.

- home/feed pagination from qualified indexer projections;
- deterministic feed cursors and refresh behavior;
- status composer;
- photo/media publication using BG-13 qualified storage/delivery;
- story creation/viewer;
- repost/quote/share provenance presentation;
- comments and replies;
- reactions;
- tags and mentions with approval/policy state;
- visibility/audience selectors supported by canonical policy;
- edit/withdraw/delete controls only where canonical primitives permit them;
- media upload progress, validation, failure recovery and preview;
- pending transaction/publication state clearly distinguished from canonical publication;
- blocked/inactive/withdrawn content removed or degraded according to current canonical state.

Implemented in:
- `bong-goggles/web/core/feed-publishing.js`
- `bong-goggles/web/core/feed-ui.js`
- `bong-goggles/web/test/feed-publishing.test.js`
- `bong-goggles/web/core/app-shell.js`
- `bong-goggles/web/styles.css`

BG-19.5 mirrors the qualified feed/social-object/media contracts. Feed pages are normalized from canonical/indexed projections, filter non-active objects, retain deterministic cursor/freshness metadata and never promote browser-local objects into canonical state. Composer drafts distinguish POST, COMMENT, STORY, REPOST and QUOTE_POST semantics and map them to the qualified `BongGogglesSocialObjectRegistry420` actions. Reaction/comment/repost/quote/tag intents map only to qualified contract operations. Pending Wallet submission is explicitly non-canonical; rejected and reverted states remain distinct; only a refreshed canonical projection marks publication confirmed.

The home route now includes a story strip, composer and feed surface. Media presentation is keyed by qualified media roots and upload UX has explicit preparing/uploading/verifying/registering/ready/failed states. The browser does not treat raw upload success as publication authority: a media root is usable only after the qualified storage/media registration path resolves it.

As with BG-19.4, the repository's indexer currently contains deterministic projector/materialized-feed logic but not a dedicated browser-facing HTTP feed controller module. The BG-19.5 client therefore fails closed when no qualified feed projection is supplied rather than inventing feed entries or cursors locally. Likewise, contract addresses/ABI deployment bindings are not currently part of the BG-19 runtime config, so this phase prepares and presents canonical action intent semantics without embedding duplicate or guessed deployment authority in the client.

**Exit:** the primary feed/composer/interaction/media/story web surfaces are implemented against canonical semantics, with pending-vs-confirmed behavior enforced and projection/deployment gaps failed closed instead of guessed.

### BG-19.6 — pages, groups + events application surfaces — IMPLEMENTED, QUALIFICATION PENDING

Expose community primitives from the qualified backend.

- Page directory, detail and activity views;
- Group directory, detail, membership and join-request flows;
- member/admin state presentation where canonically available;
- Group post/feed integration;
- Event directory/detail;
- RSVP flows and current RSVP state;
- event/group update notification/deep-link handling;
- blocked/muted/inactive eligibility enforced in presentation and actions;
- canonical links and degraded-state behavior;
- no synthetic invitations or permissions not supported by contracts.

Implemented in:
- `bong-goggles/web/core/community.js`
- `bong-goggles/web/core/community-ui.js`
- `bong-goggles/web/test/community.test.js`
- `bong-goggles/web/core/app-shell.js`
- `bong-goggles/web/styles.css`

BG-19.6 mirrors `BongGogglesCommunityRegistry420` and the qualified community indexer reducers. Page, Group, GroupMember, Event and RSVP projections are normalized as canonical presentation records. Page actions are owner-gated. Group actions reflect OPEN, APPROVAL_REQUIRED and DISABLED join policies; pending membership exposes cancellation/leave semantics through the contract-supported removal primitive; active membership and owner roles are displayed from canonical state only. Private Groups fail closed unless the current canonical member state is ACTIVE. Blocked owner/member relationships suppress Group and Event actions.

Event presentation preserves host type, visibility, schedule and current RSVP state. PUBLIC and GROUP_ONLY events may expose RSVP controls only when the current canonical policy permits them; INVITE_ONLY events do not manufacture an invitation flow because the current contract does not define one. RSVP is explicitly labeled as canonical intent rather than attendance proof.

`/pages`, `/groups` and `/events` now render either canonical directories or detail views when supplied. Group details include a qualified group-feed handoff surface for the feed/indexer layer. Directories filter inactive records and sort Events chronologically. Post-write refresh replaces presentation state from canonical projections and never preserves optimistic membership or RSVP state as truth.

The repository still lacks a dedicated browser HTTP controller for these materialized community projections and BG-19 runtime config still does not carry canonical deployment bindings. The browser therefore fails closed when community projection transport is unavailable and prepares only qualified Wallet intents for supported `BongGogglesCommunityRegistry420` calls.

**Exit:** Pages, Groups and Events are implemented as first-class web surfaces with canonical membership, visibility and RSVP semantics, while unsupported invitation/permission behavior remains absent rather than synthesized.

### BG-19.7 — private messaging web client

Build the BG-14 qualified Messenger experience.

- conversation list and direct-message thread views;
- compose/send using the qualified 420Messenger envelope path;
- device/session-key readiness UX;
- sequence/order presentation;
- delivery/pending/error presentation without inventing canonical message state;
- metadata-only notification handoff;
- encrypted/private payload exclusion from telemetry, URLs and notification metadata;
- unread indicators derived from qualified state;
- conversation access revalidation after block/policy/session changes;
- reconnect/recovery behavior;
- secure local rendering and clipboard/download handling for message content where applicable.

**Exit:** qualified private messaging is usable on the production web app without weakening the BG-14 privacy boundary.

### BG-19.8 — discovery, reviews, search + recommendations

Unify findability and discovery features.

- global search UI over qualified search classes;
- search-result filters and deterministic pagination;
- user/page/group/event/post/discovery result rendering;
- discovery subject detail;
- reviews, corrections and verification presentation/actions;
- recommendation surfaces clearly labeled as non-authoritative ranking;
- canonical revalidation before presenting actionable results;
- empty/no-result/degraded index states;
- deep links and shareable canonical URLs;
- no recommendation or engagement score becomes reward/moderation authority.

**Exit:** users can find people, content, communities and cannabis discovery/review objects through one production interface.

### BG-19.9 — games application + zero-wager boundary

Expose BG-15 social games.

- game hub;
- invite/accept flows;
- active game/session list;
- turn-ready state and move submission;
- finished-game/history views;
- leaderboard/stat views only where qualified;
- clear zero-wager product boundary;
- no stake, escrow, odds, settlement or wagering controls;
- preserve BG-18 deferred game-reward status;
- game notifications deep-link into the correct session;
- mobile-friendly game containers and recovery after refresh/reconnect.

**Exit:** Bong Goggles social games are usable while remaining cleanly separated from 420Bet and reward authority.

### BG-19.10 — notifications, rewards, moderation + safety surfaces

Integrate qualified operational/user-state systems.

- notification centre using BG-16 unread/history/deep-link semantics;
- finalized/retracted/superseded/degraded presentation;
- notification preferences handoff to 420Notifications;
- reward contribution, earned, claim and paid views using BG-18 lifecycle semantics;
- Wallet-bound reward claim flow;
- reward history and Explorer links;
- moderation case/action presentation for affected users;
- appeal submission/status/result UX where canonical flows permit;
- report/safety entry points;
- operator/admin reward surfaces exposed only behind explicit authorized routes;
- no UI control can locally finalize moderation, appeals or reward payment.

**Exit:** notifications, rewards and safety are integrated into everyday product workflows with their authority boundaries intact.

### BG-19.11 — settings, privacy, accessibility + public-web behavior

Finish user-facing account/application controls and public surfaces.

- application preferences;
- notification preferences;
- mute/block management;
- privacy/publishing defaults where supported;
- session/device management links;
- accessibility preferences;
- data/cache reset controls;
- public shareable pages for canonical public profiles/posts/pages/groups/events where policy permits;
- social metadata / SEO for public canonical pages without leaking private data;
- explicit robots/indexability policy for private/authenticated routes;
- 404/410 handling for missing, withdrawn or inaccessible canonical objects;
- legal/privacy/community-guideline links appropriate to deployment.

**Exit:** the application behaves coherently both as an authenticated social app and as a public web property.

### BG-19.12 — frontend security + privacy hardening

Perform production client hardening.

- CSP and trusted-origin review;
- XSS/HTML/URL sanitization;
- media URL validation;
- open-redirect prevention;
- CSRF/session assumptions documented and tested for service calls;
- no secrets in browser bundle, source maps, logs or telemetry;
- sensitive Messenger/Wallet/Identity fields redacted;
- dependency and supply-chain scan;
- malicious deep-link tests;
- permission/session downgrade tests;
- clickjacking/frame policy;
- safe clipboard/external-link behavior;
- wallet phishing/spoof-resistant transaction-intent presentation.

**Exit:** the production browser client does not weaken qualified chain, Wallet, Messenger or privacy guarantees.

### BG-19.13 — performance, accessibility + reliability qualification

Qualify the application under realistic use.

- route-level bundle budgets;
- feed/search/profile render latency targets;
- media lazy loading and responsive delivery;
- cache strategy for safe public/projected state;
- reconnect/retry behavior with bounded backoff;
- degraded mode when indexer/media/Messenger/notifications are unavailable independently;
- Lighthouse-style performance/accessibility checks in CI where practical;
- keyboard-only navigation;
- screen-reader labeling;
- color-contrast validation;
- responsive testing across phone/tablet/desktop breakpoints;
- deterministic reload/recovery during pending transactions;
- browser compatibility matrix.

**Exit:** the app remains usable, accessible and recoverable under realistic production conditions.

### BG-19.14 — end-to-end product journeys

Automate or deterministically qualify complete workflows.

Required journeys:

1. Wallet/session connect → profile load → feed load.
2. Publish status → canonical confirmation → feed appearance.
3. Upload photo → publish → media delivery.
4. Friend request → accept → relationship refresh.
5. Comment/reaction/tag flow.
6. Create/join Group and RSVP Event where permissions allow.
7. Send/receive private message.
8. Search → canonical object → action.
9. Game invite → accept → move → finish.
10. Notification deep-link → canonical target.
11. Reward contribution → earned → claim → paid.
12. Moderation/report/appeal presentation.
13. Block/mute immediately suppresses affected presentation/actions.
14. Refresh/restart preserves canonical outcomes without duplicate local writes.

**Exit:** all major Genesis Bong Goggles capabilities are proven through actual web journeys.

### BG-19.15 — production deployment + closeout

Prepare `bonggoggles.420integrated.org` for launch hardening.

- testnet deployment;
- staging deployment;
- production build artifact;
- DNS/TLS/CDN/static-host configuration;
- environment/config verification;
- CSP/security-header verification;
- cache invalidation/versioning strategy;
- health/readiness endpoint or synthetic browser probe;
- frontend telemetry dashboards and alert thresholds;
- deployment/rollback runbook;
- operator smoke checklist;
- reconcile BG-19 branch with current `main`;
- exact-head web, Bong Goggles, contracts, docs and integrated qualification green;
- merge only from the reconciled qualified head.

**Exit:** the complete Bong Goggles web application is deployed-capable and ready for BG-20 launch hardening.

## Recommended implementation order

`19.1 foundation → 19.2 Wallet/session → 19.3 design shell → 19.4 profiles/social graph → 19.5 feed/publishing → 19.6 communities/events → 19.7 messaging → 19.8 discovery/search → 19.9 games → 19.10 notifications/rewards/safety → 19.11 settings/public web → 19.12 security → 19.13 performance/accessibility → 19.14 E2E journeys → 19.15 deployment closeout`

## Definition of done

BG-19 is complete only when the qualified Bong Goggles backend and protocol capabilities can be used end to end through `bonggoggles.420integrated.org`, with canonical authority preserved, Wallet/session writes constrained, private messaging protected, rewards/moderation accurately represented, responsive/accessibility/security gates passed, and production deployment artifacts/runbooks prepared.

BG-20 remains the final launch-hardening phase after the full web product exists.
