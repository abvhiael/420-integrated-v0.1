# GEN-SVC — Genesis Consumer Services suite roadmap

Status reconciled: 2026-09-19. This ledger distinguishes **architecture/catalog targets**, **repository implementation and CI**, **actual product integrations**, and **production/genesis release readiness**. A merged implementation does not imply a deployed application. `config/genesis-applications.json` remains the frozen Genesis decision; `config/genesis-consumer-services.json` is a composition registry, not an automatic amendment to that catalog.

## What is complete on `main`

| Workstream | Verified repository milestone | Scope and limits |
| --- | --- | --- |
| GEN-SVC-0 shared architecture | Merged; [architecture roadmap](GEN-SVC-0-ROADMAP.md). | Service registry, shared objects, privacy/permissions, moderation, API and SDK conventions, feature flags, threat model and integration fixtures. Contract/registry baseline, not independently deployed apps. |
| GEN-SVC-1 420Reputation | Merged via PR #343; [Reputation roadmap](GEN-SVC-1-REPUTATION.md). | Domain-scoped review/reputation repository implementation and qualification. Confirm actual app integration and deployment separately. |
| GEN-SVC-2 420Location, Maps and 420Events | Implementation phases 2.1–2.24 merged by [PR #346](https://github.com/abvhiael/420-integrated-v0.1/pull/346), merge `48fe3235f5921892924e37d3350272cffe5465fe`; [phase ledger](https://github.com/abvhiael/420-integrated-v0.1/blob/main/genesis/svc2/CLOSEOUT.md). | Canonical Location/Events services and file stores, geo/near-route, provider-neutral OSM adapter/swap, privacy and Registry/Verify adapters, event lifecycle/recurrence/discovery/search/notifications adapters, public map/event projections, read-only v1 HTTP and Go SDK, security/Location/Events E2E tests and public map/travel/calendar consumer adapter. **In-process and repository qualification**, not proof of deployed frontends, delivery, or production readiness. |
| GEN-SVC-3 420Travel Genesis MVP baseline | An earlier GEN-SVC-3 baseline merge is present on `main`; [Travel scope](GEN-SVC-3-TRAVEL.md). | Discovery/planning target and reserved BnB/DOOBR interfaces. Do not infer that the live Travel UI, its routes, or its Location/Events/Reputation network integrations passed the later GEN-SVC-2.23 consumer checklist; verify those separately. |

GEN-SVC-2 feature head `051ed15173ce0be011461059447c965bd1e865b6`: dedicated run [#59](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/35467531534) and broad qualification [#4796](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/35467531600) passed. On the resulting `main` merge `48fe3235f5921892924e37d3350272cffe5465fe`, the dedicated GEN-SVC-2 push run [#60](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/35469210052) passed. Check the other post-merge workflow result on that exact SHA before calling the combined branch fully qualified. Roadmap-only edits require their own latest-HEAD verification.

## Where we are now

The shared Location/Events **code-integration milestone is merged**. The suite is at **cross-product wiring, operational hardening and per-application release qualification**, not at a verified deployed ecosystem. The public API/SDK/consumer adapter do not automatically connect existing Travel, Calendar, Classifieds, Commerce, Jobs, Grow or merchant UIs. The original 10-part [GEN-SVC-2 foundation outline](GEN-SVC-2-LOCATION-EVENTS.md) is architectural; the later 2.1–2.24 implementation ledger in [`genesis/svc2/CLOSEOUT.md`](https://github.com/abvhiael/420-integrated-v0.1/blob/main/genesis/svc2/CLOSEOUT.md) is the repository delivery record. They use different numbering and must not be treated as identical milestones.

## Remaining delivery work, in dependency order

| Next gate | Deliverable and acceptance evidence | Current disposition |
| --- | --- | --- |
| SVC-POST-1 merged-code verification | Verify repository-wide and dedicated Actions on the actual PR #346 merge SHA; recheck once later commits land. | Dedicated merge run passed; broad merge-run result must be checked separately. |
| SVC-POST-2 canonical event publication and recurrence integrity | Trigger durable discovery rebuild/publication on event create/update/delete, visibility/status change and recurrence exception. Verify canonical occurrence status at read time **or** atomic canonical/index publication; regression-test cancelled/changed occurrences against a stale index. | **Open**; security qualification flags this as a release gate. |
| SVC-POST-3 production service ingress and privacy | Deploy the read-only Location/Events handler behind reviewed TLS, access policy/public-only decision, rate limits, request-size bounds, logging/audit/monitoring and privacy-aware provider configuration. Prove map tiles/geocoding and third-party telemetry never enrich approximate or leak private locations. | **Open**; no deployment certification from the repository tests. |
| SVC-POST-4 real consumer integration | In separate app PRs, connect 420Travel map/place/events/trips, 420Calendar and relevant 420Classifieds/Commerce/merchant/Jobs/Grow screens through public `/v1` projections or equivalent authorized APIs. Record actual routes, network calls and end-to-end browser/mobile results; no SDK bypass or raw canonical data. | **Open**; `genesis/svc2/consumers` is a reusable adapter only. |
| SVC-POST-5 notification/calendar and transaction boundaries | Prove live event notification delivery, opt-in and deduplication; Calendar save/RSVP/reminders with the proper authority; preserve booking/ticketing/payment/entitlement boundaries in Travel and other apps. | **Open** until real service and UI evidence. |
| SVC-POST-6 release qualification | Exercise private/unlisted/approximate location, stale and cancelled events, provider swap, failures, race/load/soak, data migrations, backups/rollback, retention, accessibility/mobile UX and incident recovery in deployed environments. Record per-app sign-off and URLs. | **Open**; no independent security audit or production certification asserted. |

## Suite app-by-app delivery queue

The registry lists target scope, **not proof that every target is implemented or deployed**. Status below is deliberately limited to what the linked roadmaps/merged PR establish; each app needs its own file/route/CI audit before claiming completion.

1. **420Travel (GEN-SVC-3):** reconcile existing Genesis discovery/planning baseline with merged Location/Events/Reputation APIs, implement/verify real UI routes and rendered data, claims, trips and privacy tests. Keep BnB booking and DOOBR transactions disabled at Genesis unless a later explicit decision enables them.
2. **420Classifieds:** audit actual listing, local search, seller contact, moderation, reputation, payment/arbitration boundaries and UI; create/qualify missing integration phases. No inferred production readiness.
3. **420Town community boards and 420Media:** verify content/community, messaging/notifications, streaming, rights, search and moderation integrations independently; keep high-volume content and transport off-chain.
4. **420Launchpad crowdfunding and Reefer Review publishing:** verify donation/reward/preorder settlement and publishing/rights/provenance; securities/equity and paid external newsletters remain feature-gated off without explicit later approval.
5. **420Learn + 420Knowledge and 420University:** audit courses, Q&A, credentials and umbrella navigation; `university.freelance_ui` stays disabled at Genesis.
6. **420Mail and 420Calendar:** qualify identity-addressed inbox, private schedule, RSVP/reminders, permissions and real notification delivery; external SMTP and external calendar sync remain disabled by Genesis defaults.
7. **420Freelance:** Genesis schemas/interfaces only, post-Genesis UI and escrow/contract flows after Jobs/Pay/Arbitration integrations and separate authority/security qualification.

## Governance of progress

For each app, mark separately: (a) schema/architecture, (b) source + tests merged to `main`, (c) real UI/API integration, (d) production deployment and privacy/security/load qualification, and (e) Genesis catalog decision/feature-flag authorization. Do not convert an architecture entry, a green Go test, or a merged PR into a product-launch claim. Preserve independent canonical Identity/Registry/Verify/Trust/Pay/Arbitration authorities; never let Search, discovery or UI projections expand visibility or create settlement authority.

References: [GEN-SVC-2 security gates](https://github.com/abvhiael/420-integrated-v0.1/blob/main/genesis/svc2/SECURITY-QUALIFICATION.md), [cross-app consumer gates](https://github.com/abvhiael/420-integrated-v0.1/blob/main/genesis/svc2/CROSS-APP-QUALIFICATION.md), [GEN-SVC-2 closeout](https://github.com/abvhiael/420-integrated-v0.1/blob/main/genesis/svc2/CLOSEOUT.md), [suite registry](https://github.com/abvhiael/420-integrated-v0.1/blob/main/config/genesis-consumer-services.json).
