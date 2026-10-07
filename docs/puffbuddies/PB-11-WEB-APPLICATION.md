# PB-11 — Web application

## Purpose
Implement the first complete user-facing PuffBuddies client as the canonical web-first MVP surface required by PB-0.2, while preserving the rule that browser/client state is presentation only and never canonical relationship, consent, block, lifecycle, safety, deletion, visibility or eligibility authority.

Current PB-11 carries forward the historical PB-0.19 **Web MVP and baseline user experience** scope. It does not carry forward the legacy PB-0.19 numeric PB-11 launch-readiness meaning; current numbering authority remains the canonical PuffBuddies roadmap.

## Canonical web MVP scope
PB-11 exposes the complete PB-MVP-001 through PB-MVP-015 journey:
1. eligibility-gated entry;
2. profile creation/editing;
3. profile media upload handoff;
4. discovery;
5. like/pass;
6. mutual-match presentation;
7. matched-user messaging entry;
8. notifications;
9. unmatch;
10. block;
11. report;
12. profile/account controls;
13. deactivate/reactivate;
14. deletion request/status;
15. baseline safety and matched messaging remain non-premium.

PB-11 also presents the already-qualified PB-9 verification indicators and PB-10 premium feature availability without allowing either to become relationship/safety authority.

## Architecture boundary
- `puffbuddies/web/` is the canonical web-client presentation location reserved by PB-0.17.
- The web client delegates protected actions to a same-origin PuffBuddies API boundary.
- PB-14 remains owner of backend/API hardening and production transport implementation.
- Client-side data is cache/presentation only and is invalidated by authoritative generation changes.
- Session tokens are held in memory only; no localStorage/sessionStorage/IndexedDB/cookie authority is introduced.
- The client never stores raw eligibility evidence, moderation evidence, wallet addresses, exact GPS/address, private messages, payment evidence or canonical relationship state as durable browser authority.
- A server denial, stale generation, revoked session, block, safety action, lifecycle change or deletion state clears/defeats derived client state.

## Runtime truth
PB-11 is repository-qualified but **not deployed**. The committed runtime config declares:
- `deploymentStatus = repository-qualified-not-deployed`;
- same-origin API base `/api/puffbuddies/v1`;
- `authorityMode = server-revalidated`;
- `cacheMode = memory-only`.

No public URL, Cloudflare deployment, production API endpoint, live Messenger entry, production credential or testnet/mainnet readiness is claimed.

## Canonical requirements
1. Implement the complete PB-MVP-001…015 web journey.
2. All protected actions are delegated to canonical server/domain authority; the browser cannot manufacture success.
3. Session token is bounded and memory-only.
4. API requests use same-origin paths, `credentials=same-origin`, `cache=no-store`, and fail closed.
5. Eligibility is displayed from authority and cannot be self-asserted by the client.
6. Profile editing includes intent, text/prompts, coarse location/distance and media upload.
7. Profile media upload accepts only bounded JPEG/PNG/WebP input and delegates storage/moderation/authorization to the server.
8. No exact address/GPS field exists in the web discovery/profile form.
9. Discovery receives already-authorized results; hard exclusions remain server/domain-owned.
10. Like/pass calls canonical relationship action endpoints and cannot directly create a match.
11. Matches are displayed only from current server-authorized state.
12. Messaging entry requires a server-authorized current match handoff; the browser cannot infer Messenger authority from cached match data.
13. Notifications are presentation-only and non-authoritative.
14. Block/report/unmatch are always visible baseline controls and cannot be premium-gated.
15. Visibility/lifecycle/deletion controls are explicit and server-authorized.
16. Deactivation/deletion never imply Wallet/Identity deletion.
17. PB-9 verification badges remain bounded presentation only.
18. PB-10 premium entitlements expose feature availability only and cannot create consent, bypass safety or reveal protected private-person data.
19. Client derived caches are cleared whenever the authoritative generation advances.
20. A stale/lower authority generation is rejected.
21. 401/403/409/410 protected-action failures clear derived client state.
22. Signing out clears the session token and all derived caches.
23. No persistent browser security/relationship authority primitive is used.
24. UI includes skip navigation, semantic sections, labels, live regions, focus-visible styling and responsive layout.
25. Core safety/account-exit controls remain usable without premium.
26. No public member search, wallet-profile enumeration, public match history, exact location, public safety/reputation or cannabis registry is introduced.
27. No client-side force-match, force-unblock, admin-match or block-override path exists.
28. Runtime config cannot claim live deployment.
29. Build output is reproducible static content and is non-canonical.
30. PB-12 remains owner of native mobile applications.
31. PB-14 remains owner of backend/API hardening.
32. PB-17+ remain owners of live testnet/mainnet/public release qualification.

## Qualification
PB-11 requires:
- **Level 1** exact-head web-client qualification: static checks, Node tests, build, accessibility/security boundary checks and relevant Python regressions;
- **Level 2** app-focused web-MVP integration milestone, because PB-11 is the first user-facing convergence of PB-1 through PB-10.

Level 2 remains app-specific and does not trigger repository-wide Solidity, Genesis, global, Geth or fault/soak inventories.

## Affected components
- `puffbuddies/web/package.json`
- `puffbuddies/web/runtime-config.json`
- `puffbuddies/web/index.html`
- `puffbuddies/web/styles.css`
- `puffbuddies/web/state.js`
- `puffbuddies/web/api-client.js`
- `puffbuddies/web/app.js`
- `puffbuddies/web/scripts/*`
- `puffbuddies/web/test/*`
- PB-11 workflow
- canonical roadmap/master scope reconciliation
- durable qualification evidence

## Dependencies
PB-0.2, PB-0.3, PB-0.4, PB-0.5, PB-0.7, PB-0.8, PB-0.9, PB-0.10, PB-0.11, PB-0.12, PB-0.13, PB-0.14, PB-0.15, PB-0.16, PB-0.17; PB-1 through **PB-10 — Payments and premium entitlements — COMPLETE**.

## Exit criteria
- complete core web MVP surface exists in the canonical reserved path;
- same-origin fail-closed API/client boundary exists;
- client cache/revocation behavior is generation-aware;
- no client-side canonical authority or persistent sensitive session state exists;
- accessibility/core-flow/static/privacy checks pass;
- web build passes;
- full retained PuffBuddies regressions pass;
- app-focused PB-11 Level-2 integration passes;
- PB-0 structure/authority verifier remains green;
- durable exact-SHA evidence is recorded;
- deployment/live API/testnet readiness remain explicitly deferred.
