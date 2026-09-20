# Bong Goggles — delivery and launch roadmap

**Status baseline:** 2026-09-19. **Active work:** BG-19, production web application and qualified service integration. **Working branch:** `feature/bong-goggles-bg19-web-app`, [PR #350](https://github.com/abvhiael/420-integrated-v0.1/pull/350), open and not merged at this baseline. **Intended public host:** `https://bonggoggles.420integrated.org`. **Next phase after evidenced BG-19 closeout:** BG-20 operational launch hardening.

## 1. Product goal and definitions of done

Bong Goggles is the 420 Integrated social application: 420Wallet-based sessions, user profiles, friends/follows, posts and photos, stories and interactions, pages/groups/events, private messaging, discovery/reviews/search, seven zero-wager social games, notifications, rewards, and moderation/safety. The web application presents canonical or qualified projected data and prepares explicitly authorized intents; it does not become a second source of truth for identities, content, permissions, messaging, payments, rewards, moderation, or wallet signatures.

The status of each deliverable must be recorded at **four different levels**: (1) contract/service/schema implementation on `main`; (2) web code and automated CI on the feature branch or `main`; (3) actual service ingress plus browser-to-service integration in a named environment; and (4) production launch authorization with security, privacy, reliability, recovery, accessibility, and operational evidence. `Implemented` does not imply `deployed`; `CI passed` does not imply a browser journey passed; a prepared transaction intent does not imply a submitted or finalized transaction. All four levels must pass before calling the full product complete.

**Launch definition:** A new user can visit the deployed host, browse appropriately public content, connect 420Wallet, use each enabled Genesis feature through its authoritative service, sign and confirm real supported intents, recover from failures, and leave no unauthorized data accessible. The evidence ledger must name the build/commit, expected chain, contract and API versions, service origins, visibility-policy version, test accounts, devices, exact test runs, and approval/rollback record. Unsupported or unqualified features must remain clearly disabled, rather than simulated as successful.

## 2. Finished: foundations already merged into `main`

| Delivered foundation | Repository milestone | What it establishes — and what it does not |
| --- | --- | --- |
| Initial social protocol | PRs #55, #57, #62, #67, #69, #70, #75, #76 | Social objects, content/publication, relationship, reaction, repost/quote, tags/mentions and audience/feed policy primitives; not a live browser application. |
| Community and adjacent protocols | PRs #78, #80, #82, #83, #89, #91, #93, #96, #136 | Pages/groups/events, Messenger groundwork, games, discovery/reviews, trust and safety, rewards, search, wallet session and passkey bridges. Browser endpoints and end-user journeys require independent proof. |
| BG-12.1–12.7 — application/indexer backend | PR #307 | Deterministic indexer and backend projection foundations; materialized views are **not** permission to expose raw data over HTTP. |
| BG-13.1–13.7 — media/storage | PR #308 | Media storage, delivery and associated qualification foundations; no assertion of an operational public CDN/media origin for BG-19. |
| BG-14.1–14.7 — private messaging | PR #314 | Qualified Messenger backend and privacy boundary; no assertion of live encrypted browser send/receive or device recovery. |
| BG-15.1–15.9 — social games | PR #321; merge `95ab47efaccb1a50084c33c5b7c8d4faf44ab529` | Game protocol/application foundation with **zero-wager** separation from 420Bet. |
| BG-16.1–16.9 — notifications | PR #330 | Notification taxonomy, emitters, opt-in delivery handoff, centre semantics and privacy/recovery groundwork. Actual push/web delivery to the final site needs operational testing. |
| BG-17.1–17.9 — moderation | PR #335; merge `0612b39f017ad26092378e4292b61ec13adc172f` | Moderation-operations implementation; anonymous/browser disclosures still require independently qualified current-state enforcement. |
| BG-18.1–18.12 — rewards | PR #344; merge `db6dcb12b79af6c8afc5b15a6fd9ace28bb938fc` | Reward configuration, verification, budgets, lifecycle and shared-rewards interfaces. A submitted contribution is not an earned, claimable or paid reward. |

These milestones are merged repository foundations. Preserve all canonical boundaries, including 420Wallet, Identity, Messenger, media, rewards and moderation; do not duplicate their authority inside Bong Goggles.

## 3. Finished on the BG-19 feature branch: web implementation and CI

**Requalification baseline:** PR #350 head `91c951c75393c6a6f05423120e2d47bba9d0dfac`. Six workflows passed at that head: [Web #147](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/35470286583), [Games #125](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/35470286566), [Media #188](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/35470286632), [Indexer #143](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/35470286526), [420Docs #2422](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/35470286568), and [420 Integrated #4837](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/35470286552). **This roadmap edit creates a later head requiring its own check.** PR #350 is not merged and these runs do not certify deployed browser journeys.

| Web increment | Implemented and previously CI-qualified repository deliverables | Remaining real-world integration |
| --- | --- | --- |
| BG-19.1 — foundation | Browser-native web workspace, strict runtime config, typed service clients, fail-closed bootstrap, privacy-redacted telemetry and static build. | Production host and actual service origins/availability. |
| BG-19.2 — Wallet/session | 420Wallet discovery, network gating, connect/sign-out UX, passkey/session handoffs and reviewed transaction-intent states. | Real account/device/passkey tests, deployed ABI/address validation and canonical transaction receipt flows. |
| BG-19.3 — responsive shell | Desktop/mobile navigation, route guardrails, shared design system, loading/empty/error/read-only/degraded states. | Cross-browser/device, keyboard, screen-reader and accessible interaction sign-off. |
| BG-19.4 — social graph | Profile and relationship normalizers, screens and guarded friend/follow/block/mute intents. | Qualified public/account-scoped projection endpoints and on-chain/browser journeys. |
| BG-19.5 — feed and publishing | Feed/composer/story/media/interaction UI, audience-aware normalizers, pending-versus-confirmed and refresh semantics. | End-to-end feeds, authorized content resolution/media upload, real publish/react/edit/revoke receipts. |
| BG-19.6 — communities | Pages, groups, events, membership and RSVP views/intents with canonical permission guardrails. | Live community read routes, member visibility, actual transactions, notification/deep-link verification. |
| BG-19.7 — Messenger | Inbox/thread UI and sequence, privacy and session/device safeguards. | Authorized encrypted browser send/receive, epoch changes, recovery, cross-device and metadata leakage tests. |
| BG-19.8 — discovery | Search, review and recommendation presentation with non-authoritative ranking boundaries. | Real indexed results, qualification of stale/deleted/private results and supported review actions. |
| BG-19.9 — games | Hub and seven zero-wager games' presentation/state handlers and guarded session intents. | Real invitations, turn/finality, refresh/resume, mobile and zero-wager regression proof. |
| BG-19.10 — operations | Notification, reward, moderation and safety presentation and intent states. | Account-scoped real services, opt-in delivery, correct reward statuses and actual appeal/claim flows. |
| BG-19.11 — settings | Local display preferences, Wallet/settings handoffs, public indexing defaults. | Real user settings/privacy controls and accessibility verification. |
| BG-19.12–19.13 — security/reliability | URL, CSP, telemetry and static-asset safeguards; retry/abort, accessibility and build qualification utilities. | Deployed ingress/browser CSP/CORS/headers, performance, load and fault drills. |
| BG-19.14 — journey evidence | Readiness/journey inventory and test structures **partially prepared**. | Named-environment E2E matrix and evidence for each enabled product flow. **Open.** |
| BG-19.15 — deployment closeout | Manifest/package, security-header templates and launch gating **partially prepared**. | Attested deployment, live host verification, approvals, rollback and release record. **Open.** |

### BG-19 public-feed integration already implemented, but not released

`bong-goggles/web/app.js` can call qualified `GET /v1/status` through its indexer service and display a **non-authoritative diagnostic**. `bong-goggles/web/core/qualified-read.js` supplies a fail-closed opt-in read boundary; generic status is **not** a social feed. `services/bong-goggles-indexer-v1/src/publicFeedHttp.js` defines the bounded anonymous `GET /v1/public-feed` DISCOVER adapter, with an allowlisted schema, `no-store`, inactive/private filtering and an injected server-side visibility/moderation callback. The opt-in Node HTTP server adapter and real HTTP regression tests establish a testable transport, not a deployed public endpoint. Without a qualified view provider and visibility policy the route must remain **disabled**. The result is a bounded sample only: no authenticated audience feeds, qualified cursor pagination, decoded content, verified freshness/finality, production service origin or browser binding is established.

**Current position:** repo-level implementation and all six cited CI runs are complete on the PR; the next task is **BG-19.16, canonical current-state and visibility-policy qualification**. Do not call BG-19.14/15 or the full application complete because the screen routes render or the HTTP adapter tests pass.

## 4. Remaining implementation: critical-path sequence

The following work packages are proposed execution increments continuing BG-19. Their numbering denotes **new work**, not already completed milestones. Each package requires source/tests, service or browser evidence as applicable, a documentation update, and exact-head CI before changing its status.

### BG-19.16 — server-owned public-visibility policy and canonical snapshot (FIRST)

**Build:** Inventory the existing authoritative audience, author/profile, relationship/block, moderation/takedown and repost/source-object state and document exact providers and versioned contracts. Supply `getView` only from an expected-chain, current, canonical materialized snapshot with verified checkpoint, index lag/finality, reorg handling and freshness thresholds. Implement and independently test `canShowPublicObject` server-side against *current* eligibility for anonymous DISCOVER, including deleted/restricted authors, withheld objects, blocked subjects where globally relevant, source-object restrictions, policy withdrawal and moderation updates. Deny on unavailable/stale/inconsistent dependencies and never trust a browser-provided authorization verdict.

**Exit evidence:** A reproducible positive public case plus negative tests for non-public audience, inactive author, withdrawn/deleted/moderated/blocked content, restricted quote/repost source, stale checkpoint, reorg and policy-provider failure. Security reviewer records actual policy dependencies and confirms no private metadata in anonymous DTOs. Keep ingress off until evidence is complete.

### BG-19.17 — deployment-owned social API and ingress

**Build:** Attach the route to the real indexer/application server and canonical view provider with explicit enablement. Publish its own verified origin and versioned `/v1` contract; enforce HTTPS, exact CORS allowlist, no credential reflection for anonymous public reads, request/response size and deadline bounds, rate limiting, content-type, cache and security headers, privacy-safe logs, health/readiness and observable denied/failure rates. Add deployment configuration without assuming the generic 420Indexer status host serves social projections.

**Exit evidence:** Named testnet/staging deployment and real external HTTP checks for success, 400/404/405/429/503, wrong origin, injected credentials, policy outage, stale chain and reorg. Capture deployment revision, host, checkpoint/chain and API schema; route stays disabled in production until separately approved.

### BG-19.18 — browser public DISCOVER feed

**Build:** Extend runtime validation for only the attested social origin. Implement a strict versioned public-feed DTO validator and bind `qualified-read.js` into the DISCOVER screen through the real service client. Support accessible loading/empty/denied/offline states, navigation aborts, refresh and fail-closed invalidation after moderation/reorg. Resolve post text and media **only** through a separately authorized content/media delivery path; do not render a hash as if it were decoded content. Present incomplete sample semantics clearly until pagination is qualified.

**Exit evidence:** Real-browser request/response capture for public, denied, empty, stale, disconnected and recovery cases; verify screen content matches the authorized projection and disappears on policy withdrawal. No fake posts or mock responses may be presented as production data.

### BG-19.19 — complete public and authenticated social read APIs

**Build:** Implement stable cursor semantics, snapshot-bound pagination and `hasMore`/cursor truth for public DISCOVER. Then implement versioned HOME, FRIENDS and FOLLOWING feeds, profiles, relationship lists and community reads with server-verified 420Wallet/session identity, owner/audience and membership enforcement. Enforce authorization on every page and after session revocation, block or policy changes; do not accept a client account string as permission. Add privacy-safe content/media delivery and explicit index freshness/error contracts.

**Exit evidence:** Deterministic multi-page/refresh/reorg tests, no cross-account or private-group disclosures, failed/expired session tests and browser data consistency against canonical state. Public and scoped endpoints must remain independent of recommendation rank or client-side hiding.

### BG-19.20 — real publishing, relationships, communities and media

**Build:** Wire actual deployed contract addresses, ABIs and service origins from verified configuration. Deliver Wallet-confirmed post/comment/story/reaction/repost, media registration, friendship/follow/block/mute, group membership and event RSVP where supported by canonical primitives. Validate audience and moderation policies at submission; track pending/replaced/reverted/confirmed receipts and refresh from canonical projection. Never equate upload completion or browser optimistic state with publication or membership.

**Exit evidence:** Per-action testnet/staging journey with user confirmation, canonical transaction or service receipt, refreshed view, rejection/revert and permission-change cases; no unsupported button may claim success.

### BG-19.21 — remaining private and cross-product integrations

**Build:** Integrate Messenger authorized envelope transport/device keys, notifications consent and delivery, search/reviews, games, rewards claim/lifecycle, moderation/appeal operations and settings. Give each dependency an explicit service owner, environment and contract; keep message payloads out of telemetry/notifications and claims out of speculative earned/paid UI. Preserve zero-wager gameplay and all 420Wallet/Identity/moderation ownership boundaries.

**Exit evidence:** End-to-end per-feature browser tests including revoked session, cross-account access, block/withdrawal, failed/replayed message, game finality, notification dedupe, disputed/denied claim and appeal outcome. Disable any feature lacking qualification rather than introducing substitute authority.

### BG-19.14 — comprehensive product-journey and abuse qualification (REOPEN/CLOSE)

**Build:** Assemble a traceable matrix across anonymous and authenticated users, supported/wrong chain, desktop and mobile, keyboard/screen reader, fresh/stale/reorg chain, unavailable services, and public/private/muted/blocked/moderated content. Cover first-visit, Wallet/passkeys, feeds/posting/media, profiles, communities/events, Messenger, games, search/reviews, notifications, rewards and safety. Test privacy boundary, request abuse, API pagination, recovery after navigation/reconnect and measured response/performance. Use staging/testnet *deployed* services, not exclusively mocks.

**Exit evidence:** Every enabled Genesis journey has a green browser/device run with reproducible inputs and artifacts, deployment origin, commit/config and owner sign-off. Open failures explicitly identify feature flags or launch blockers.

### BG-19.15 — deployment, release reconciliation and operator approval (REOPEN/CLOSE)

**Build:** Reconcile PR #350 against the newest `main`, resolve conflicts without dropping other app work, re-run all required checks on the new exact head and merged result if/when explicitly requested. Attest build artifacts/config and contract/API/policy versions. Verify host/DNS/TLS, cache/CSP/CORS/headers, accessibility, monitoring/alerts, backup, rollback and incident procedures. Obtain operator/security/privacy review and controlled-release approval; keep `launchApproved=false` until evidence is complete.

**Exit evidence:** Signed-off release checklist, environment and immutable artifact references, production smoke tests, documented rollback and recovery drill, and explicit decision on every disabled/unfinished feature. Merge PR #350 only upon a separate explicit merge request; a green CI run alone is not production approval.

### BG-20 — production launch hardening, after BG-19 closeout

Conduct canary/limited rollout where appropriate, observe actual latency/error and privacy/moderation metrics, exercise incident response and abuse escalation, verify backups and retention, repeat accessibility/mobile testing and establish regression, dependency-upgrade and security-review cadence. Record measured thresholds, owners, runbooks and post-launch fixes. Do not use BG-20 as a shortcut around incomplete BG-19 integration or security gates.

## 5. Release blockers, dependencies and control ledger

| Gate | Current state | Who/what must supply proof |
| --- | --- | --- |
| Current canonical public social view | Not deployment-qualified | Indexer operator: chain/finality/freshness/reorg and view provenance |
| Server-side privacy/moderation eligibility | Injected callback contract, no independently qualified live implementation | Social-policy + moderation/security reviewers |
| Public HTTP social service | Opt-in server adapter tested; no attested deployment | API/deployment operator: host/ingress/origin/rate/error policy |
| Public DISCOVER browser content | UI and reader available; real data not wired | Web + API owners: live request, strict DTO, authorized content/media resolver |
| Authenticated/private social routes | Not browser-integration qualified | Identity/Wallet, social policy and indexer owners |
| Canonical write binding | Prepared intents; real deployed action journeys not qualified | Wallet/contracts/service integrators: ABI/address/receipt/refresh |
| Cross-service features | Service foundations merged; final consumer journeys not proven | Messenger, media, notifications, games, search, rewards and safety owners |
| BG-19.14 end-to-end readiness | Open | QA/security/accessibility: per-journey staging evidence |
| BG-19.15 production approval | Open | Deployment/operations/security: artifact, live smoke, rollback and sign-off |

**Operating rule for subsequent increments:** At every change, update this ledger with the phase, changed code paths, commit SHA, exact test URLs, actual browser/deployment evidence where relevant, unresolved blockers and the next dependency. Do not relabel a foundational contract or adapter as a delivered user-facing product. Source runbooks include `docs/BONG-GOGGLES-BG-19.md`, `docs/BONG-GOGGLES-BG-19-INTEGRATION-FOLLOWUP.md`, `docs/BONG-GOGGLES-BG-19-INDEXER-STATUS-INTEGRATION.md`, `docs/BONG-GOGGLES-BG-19-PUBLIC-FEED-HTTP.md` and `docs/BONG-GOGGLES-BG-19-15-DEPLOYMENT-CLOSEOUT.md`. Some earlier runbooks describe an older integration snapshot; this roadmap's dated ledger supersedes those older status statements, not their security requirements.
