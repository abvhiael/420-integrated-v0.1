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

### BG-19.1 — web application foundation + runtime contract

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

**Exit:** a production-buildable shell starts deterministically against testnet/staging/production configuration and fails closed on unsafe configuration.

### BG-19.2 — Wallet, Identity, passkey + session UX

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

**Exit:** users can safely enter, leave and recover sessions while every write remains constrained by canonical Wallet/session policy.

### BG-19.3 — design system, navigation + responsive application shell

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

**Exit:** every later feature can be implemented without inventing one-off navigation, modal, loading or authority patterns.

### BG-19.4 — profiles, relationships + social graph UI

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

**Exit:** profile and social-graph behavior is complete, canonical and usable across desktop/mobile.

### BG-19.5 — home feed, publishing, interactions, media + stories

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

**Exit:** a user can complete the primary Bong Goggles loop: open feed → publish → interact → see canonical result.

### BG-19.6 — pages, groups + events application surfaces

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

**Exit:** Pages, Groups and Events are first-class web experiences rather than hidden backend capabilities.

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
