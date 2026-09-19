# BG-19.11 — settings, privacy, accessibility and public web

Implemented on PR #350:

- `web/core/settings-public.js` defines strictly browser-local, enumerated text-size/contrast/motion preferences, HTTPS-only external handoffs, and a fail-closed public-document indexing policy.
- `web/core/settings-ui.js` exposes account-guarded settings, display controls, and truthful Wallet/420Notifications handoffs when a verified origin is available. Profile visibility, block/mute state, publishing defaults, and notification subscription policy are not silently changed by local browser controls.
- `web/app.js`, `web/settings.css`, `web/index.html`, `web/scripts/build.mjs` wire those display options and default all current shell routes to noindex. The display controls are ephemeral per browser page load and are not account policy or cross-device preferences. Reset restores defaults.
- `web/test/settings-public.test.js` covers invalid options, private deep links, withdrawn objects, participant policy, and settings guard behavior.

## Remaining gates before the BG-19.11 roadmap exit

1. The browser application still does not hydrate verified canonical public profile/post/page/group/event detail projections by route. `publicDocumentPolicy` is a pure preparation model, not live server-side HTTP 200/404/410 response handling; all current shell responses remain noindex. Search-engine indexability must be enabled only after verified public SSR/static response generation exists.
2. Approved privacy notice, terms and community-guideline destinations must be supplied by deployment owners. No placeholder URL is represented as a published policy.
3. Qualified Wallet/session management and 420Notifications preferences origins require deployment wiring. The existing 420Wallet sign-out remains the session clear boundary. Settings does not delete on-chain records or user accounts.
4. Canonical mute/block management, publishing defaults and notification-policy writes require verified reads, deployment-bound ABI and Wallet/service action routing. This increment shows handoffs rather than creating a second privacy authority.
5. Server/CDN must enforce the noindex policy and real HTTP status codes for private/missing/withdrawn objects; client-side meta alone cannot enforce HTTP semantics.

BG-19.11 UI and policy helpers can pass CI while these production integration gates remain open. Do not describe the public-web roadmap exit as complete until they are closed and tested end to end.
