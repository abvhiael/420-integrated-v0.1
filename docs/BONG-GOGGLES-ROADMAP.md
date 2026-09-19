# Bong Goggles Roadmap

**Status date:** 2026-09-19. **Current phase:** BG-19 web application/integration, PR [#350](https://github.com/abvhiael/420-integrated-v0.1/pull/350), branch `feature/bong-goggles-bg19-web-app` (open; not merged). **Next product phase:** BG-20 launch hardening, after BG-19 deployment and product-journey gates are satisfied.

Bong Goggles is the 420 Integrated social layer: profiles, friends/follows, publishing/photos/stories, pages/groups/events, private messaging, casual zero-wager games, discovery/reviews/search, notifications/rewards, moderation/safety and 420Wallet-native identity/session access. Intended production web host: `https://bonggoggles.420integrated.org`.

**Status vocabulary:** *Complete and merged* means implementation/qualification has landed on `main`. *Implemented and CI-qualified on PR* means repository code and automated tests passed at the cited head, **not** that the service is deployed, reachable, secure under live policy, or launch-ready. *Partial/blocked* identifies real outstanding work; a UI route, prepared transaction intent, mock or unit test is not a verified end-to-end journey.

## Finished — protocol and backend foundation (on `main`)

| Phase | Delivered | Merge/reference |
| --- | --- | --- |
| Early social foundation | Social contracts and publishing/media/interactions; publishing, relationships, repost/quote, tags, reaction and feed policy; communities; Messenger foundation; games; discovery/reviews; moderation; rewards; search; 420Wallet session and passkey bridge | PRs #55, #57, #62, #67, #69, #70, #75, #76, #78, #80, #82, #83, #89, #91, #93, #96, #136 |
| BG-12.1–12.7 | Deterministic social indexer and production application/indexer backend foundations | PR #307 merged |
| BG-13.1–13.7 | Media/storage delivery foundations | PR #308 merged |
| BG-14.1–14.7 | Qualified private-messaging backend | PR #314 merged |
| BG-15.1–15.9 | Zero-wager social games backend/application foundation | PR #321 merged; `95ab47efaccb1a50084c33c5b7c8d4faf44ab529` |
| BG-16.1–16.9 | 420Notifications integration: taxonomy, interaction/group/event/game/message/moderation/reward emitters, consent/delivery, centre, privacy/recovery and production closeout | PR #330 merged; earlier BG-16.9 pending wording in this roadmap is superseded by the merged phase |
| BG-17.1–17.9 | Moderation operations | PR #335 merged; `0612b39f017ad26092378e4292b61ec13adc172f` |
| BG-18.1–18.12 | Reward-production configuration, verification, budgets, lifecycle and shared-rewards integration | PR #344 merged; `db6dcb12b79af6c8afc5b15a6fd9ace28bb938fc` |

The earlier phases provide canonical primitives and tested service components; they do not by themselves prove every browser journey is deployable or live. Detailed records: `docs/BONG-GOGGLES-BG-18.md`, `docs/BONG-GOGGLES-BG-19.md`, and individual earlier phase runbooks. Bong Goggles does not maintain a second social, wallet, message, moderation or reward authority.

## BG-19 — what is finished in the PR, and what is not

**Working branch:** `feature/bong-goggles-bg19-web-app` / PR #350. The prior implementation head `2dd585173ae81179ffdb37e5429c57ef0e1cbd77` passed Bong Goggles Web Verification #145, Bong Goggles Indexer Verification #141, 420Docs Qualification #2409 and 420 Integrated Qualification #4823. This documentation update creates a *new* head; its CI must be checked independently. Mergeability can change as `main` moves; reconcile before merge and recheck exact-head qualification. Do not describe PR #350 as merged.

| Increment | Implementation state | Product/deployment limitation |
| --- | --- | --- |
| BG-19.1 | **Implemented; CI-qualified:** static web workspace, runtime/environment schema, typed service clients, fail-closed bootstrap, error reporting and build workflow | Production service origins/config and real-host deployment not demonstrated |
| BG-19.2 | **Implemented; CI-qualified:** qualified 420Wallet provider detection, account/network/session UX, passkey handoffs and Wallet-reviewed intent semantics | Live Wallet/passkey/device journey and canonical on-chain writes need browser qualification |
| BG-19.3 | **Implemented; CI-qualified:** responsive shell, navigation/routes, reusable design elements, access gates and read-only/degraded UX | Real browser/device accessibility and route journeys not closed out |
| BG-19.4 | **UI/normalizers implemented; CI-qualified:** profiles, friend/follow/block/mute and social graph | Dedicated qualified browser HTTP projections and deployment contract missing; user data/actions fail closed |
| BG-19.5 | **UI/normalizers implemented; CI-qualified:** feed, composer, media/story/interaction flows and canonical refresh semantics | Full qualified feed, media-service and transaction bindings unavailable; no claim of live publishing |
| BG-19.6 | **UI/normalizers implemented; CI-qualified:** pages, groups, events and bounded membership/RSVP intents | Browser community projection and actual Wallet action bindings still missing |
| BG-19.7 | **UI/logic implemented; CI-qualified:** Messenger inbox/thread metadata and privacy/epoch/session gates | Live encrypted send/receive, recovery and cross-device browser proof outstanding |
| BG-19.8 | **UI/logic implemented; CI-qualified:** discovery, reviews, search and recommendations | Live search/discovery projection routes and verified action bindings outstanding |
| BG-19.9 | **UI/logic implemented; CI-qualified:** seven zero-wager social games and guarded game hub | Live invite/turn/finality/refresh journeys outstanding; no wagering controls |
| BG-19.10 | **UI/logic implemented; CI-qualified:** notifications, rewards, moderation and safety presentation | Real account-scoped service binding and canonical claim/appeal/message lifecycle verification outstanding |
| BG-19.11 | **Implemented; CI-qualified:** local display preferences, settings handoffs and public-indexing fail-closed policy | End-user privacy/settings and public-route browser checks outstanding |
| BG-19.12 | **Implemented; CI-qualified:** URL/telemetry/privacy/security hardening | Deployment headers, CORS, CSP, dependency and browser security verification outstanding |
| BG-19.13 | **Implemented; CI-qualified:** static asset/accessibility checks, retry/abort and reliability utilities | Measured live-browser performance, accessibility and degraded-dependency drill evidence outstanding |
| BG-19.14 | **Partially implemented:** journey/readiness gates and qualification metadata | No complete, evidenced testnet/staging browser journey matrix; cannot mark complete |
| BG-19.15 | **Partially implemented:** deterministic deployment packaging, security-header template, manifest and launch gate | No attested deployed build, signed-off service configuration, live smoke/e2e tests or operator launch approval; `launchApproved` remains false |

**Interpretation:** BG-19.1–19.13 are implemented as repository feature/UI increments and passed the applicable automated checks at the cited prior head. Their end-to-end *operational* integration is **not** complete. BG-19.14/15 are **blocked**, not launch-qualified. See `docs/BONG-GOGGLES-BG-19.md` and `docs/BONG-GOGGLES-BG-19-15-DEPLOYMENT-CLOSEOUT.md`.

## Where we are now — BG-19 public read integration

The app now makes a validated, read-only 420Indexer `GET /v1/status` call and displays a **non-authoritative indexer diagnostic**. This is not a social-data source or evidence of endpoint deployment. `bong-goggles/web/core/qualified-read.js` provides an opt-in fail-closed projection reader with versioned binding, strict validation, wallet-scoped private reads, request abort and stale-session invalidation; it is not wired to invented feed/profile URLs. See `docs/BONG-GOGGLES-BG-19-INDEXER-STATUS-INTEGRATION.md` and `docs/BONG-GOGGLES-BG-19-INTEGRATION-FOLLOWUP.md`.

The indexer branch additionally contains a restricted public DISCOVER-feed route adapter (`services/bong-goggles-indexer-v1/src/publicFeedHttp.js`) and an opt-in Node HTTP server adapter with real-HTTP tests. The response is read-only, bounded, schema-versioned, field-allowlisted and `no-store`; serving records requires a **separately qualified, server-side** visibility/moderation decision. The HTTP adapter refuses to enable without an explicit flag and injected policy/canonical-view provider. It is **not deployed, not browser-wired and not a complete paginated or authenticated feed**. Existing `materializeState()` and `visibleFeed()` helpers alone must never be treated as sufficient anonymous visibility enforcement. See `docs/BONG-GOGGLES-BG-19-PUBLIC-FEED-HTTP.md` (its earlier 'no running server adapter' wording predates the new opt-in HTTP adapter; the deployment/visibility gaps still apply).

## Remaining execution sequence — do not skip release gates

1. **BG-19 integration A — server visibility/moderation and current-state authority (CURRENT NEXT STEP).** Inventory the actual qualified social-policy, audience, block, moderation and author/content status sources; implement a server-owned anonymous eligibility policy for DISCOVER, including source/repost dependencies where applicable. Bind `getView` to a verified expected-chain canonical checkpoint and establish replay/reorg, freshness, state-root and health checks. Deny when policy inputs are absent, contradictory, stale or fail. Independently test leak-prevention cases before enabling HTTP ingress.
2. **BG-19 integration B — qualified HTTP deployment.** Register and operate the opt-in route behind deployment-owned host/HTTPS, exact origin/CORS policy, rate limits, bounded request and response size/time, no credential reflection, privacy-redacted logs/metrics and readiness checks. Publish a separately identified social-projection service origin, versioned response DTO, chain/policy version and deployment evidence; do not assume the general 420Indexer host serves social routes.
3. **BG-19 integration C — browser public DISCOVER read.** Extend the validated runtime only for a verified social service origin and qualified binding; consume its exact DTO through a strict response validator and qualified reader. Wire only the public read into the relevant view with accessible loading/empty/error states, abort on navigation and canonical refresh, and fail closed on incorrect chain, reorg, moderation withdrawal or transport failure. Run real browser tests against a deployed, policy-enforced service. Do not display hashes as decoded social content without a qualified content/media resolver.
4. **BG-19 integration D — complete, scoped social services.** Qualify cursor-based public feed pagination, then authenticated HOME/FRIENDS/FOLLOWING and profile/relationship/community projections with server-enforced owner/audience scope (not an account string supplied by the browser). Connect media, search, games, 420Notifications, rewards/moderation and 420Messenger with explicit session/device/privacy gates. Verify every transaction intent against real deployment address/ABI and canonical receipt/revalidation; never infer success from browser state or submit unsupported actions.
5. **BG-19.14 — end-to-end product journey closeout.** Record reproducible testnet/staging browser and mobile-viewport results for account/network/passkeys; public/private social access; publishing/media; groups/events; DM privacy and recovery; games; notifications/rewards/appeals; wrong-chain/rejected/reorg/revoked-session; accessibility, performance, reliability and abuse scenarios. Attach exact endpoint, chain, commit, deployment and policy evidence to each passing journey; keep incomplete journeys explicitly blocked.
6. **BG-19.15 — deploy and approve.** Reconcile PR #350 with the current `main`, rerun all required workflows on the new exact head, verify deployment package/hashes/headers/CSP/CORS/secrets, deploy and smoke-test the intended host, exercise rollback and incident drills, and obtain operator/security launch approval. Only then mark deployment and BG-19 complete and merge when explicitly requested.
7. **BG-20 — launch hardening (AFTER BG-19).** Production observation, incident/abuse response, operational monitoring, accessibility and mobile-device verification, recovery/rollback and post-launch regression gates; define completion from measured evidence, not roadmap labels.

**Critical path:** merged BG-18 foundation → BG-19 UI/logic (implemented and CI-qualified on open PR) → BG-19 qualified policy + deployed social transport + actual browser bindings → BG-19.14 e2e evidence → BG-19.15 release/merge → BG-20 launch hardening → production readiness.
