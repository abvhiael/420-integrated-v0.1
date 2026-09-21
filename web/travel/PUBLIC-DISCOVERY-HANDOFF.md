# WEB-BRAND-2.6 — Public discovery service handoff

Status: **integration contract only; not connected or released.** Site remains a Cloudflare Pages static public preview at `https://420travel.420integrated.org/`. PR #356 remains open.

## Deployment boundary

Cloudflare Pages publishes `web/travel/` as static files. It does not host `cmd/420travel`, and a green GitHub workflow does not establish a live Go origin. The Go public deployment handler accepts `TRAVEL_PUBLIC_SERVICE_URL`, requires an HTTPS public feed for staging/production, and exposes `GET /readyz`; `readyz` checks the configured public feed, not Identity or private persistence. The current static website does not fetch Travel data.

Do not switch on public frontend queries until the independently hosted public Go origin, public Location/Events projection, and HTTPS routing have been checked in staging. Never expose Go development server, private routes, internal service URLs, authentication cookies, credentials, or unlisted trip data to Pages. Choose and document one public read origin and a fixed, narrowly scoped same-origin path for public GET requests. Add no broad wildcard proxy or wildcard CORS allowance. Do not proxy authenticated mutations through the public preview.

## Required read-only adapter contract before implementing the UI client

1. Inventory the **actual** public Go route patterns, response schemas and publication/withdrawal semantics on the target commit. Do not invent route names or interpret `/readyz` as a listings endpoint. Record only published place/event fields authorized for anonymous exposure; omit all private and inferred coordinates.
2. Deploy the public Go process separately behind HTTPS; pin the deployed SHA, upstream feed version and staging origin. Verify fresh `GET /readyz` succeeds only while authoritative public data is available; test upstream outage returns unavailable without stale or fabricated results.
3. Implement a narrowly scoped same-origin read-only routing layer for the verified public endpoints (Cloudflare Worker/Pages Function or reviewed ingress). Define upstream allowlist, request timeout, response size cap, no credential forwarding, no unrestricted redirects, `GET`/`HEAD`-only policy, explicit cache rules, content type, security headers, and a structured unavailable response. Do not permit arbitrary user-controlled upstream URLs or private route prefixes.
4. After verifying backend payloads, add a progressive-enhancement browser client for Discover, Events, and List/Nearby. Handle loading, genuine empty search results, disconnected/upstream unavailable, malformed payload, withdrawn record and navigation/keyboard focus states. Escape all server-provided text before inserting into the DOM. Do not manufacture listing records, images, dates, or locations.
5. For Map, render markers only for records explicitly publishing exact coordinates; approximate places stay list-only. No browser geolocation or third-party tile requests until separately approved. Public results must revalidate current publication state and never leak withdrawn entries from cache.
6. Test desktop/mobile, keyboard and screen reader behavior, CSP under the *deployed* Cloudflare headers, direct asset URLs, 404/503 upstream behavior, record revocation, and exact-commit GitHub checks. Capture Cloudflare deployment ID, custom-domain HTTPS response and route probes before calling the website connected.

## Features that remain gated

Private trips, Save to trip, owner-scoped unlisted sharing, business claims and verified reviews require independently qualified Identity, authorization, CSRF, persistent database and trusted adapters. Booking and DOOBR transactions stay disabled. No public-discovery readiness check can unblock private features.

## Handoff acceptance record (fill with observed evidence, not assumptions)

- GitHub feature head / public Go deployed commit: **pending**
- Verified public route list and schema: **pending**
- Staging origin and `/readyz` output: **pending**
- Cloudflare Pages deployment ID and exact commit: **pending**
- Same-origin public read route security review and outage/revocation tests: **pending**
- Desktop/mobile/keyboard/screen-reader acceptance: **pending**
- Live Identity/private feature release gates: **closed**
