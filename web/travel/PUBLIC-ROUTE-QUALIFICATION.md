# WEB-BRAND-2.6.2 — Narrow public HTTPS route and frontend adapter

Status: **code and mocked-route qualification implemented; live HTTPS upstream and Cloudflare deployment qualification NOT established.** PR #356 stays open.

## Pages route boundary

This repository's Pages source root is the repository root; static build output is `web/travel`. Pages Functions must be built/deployed from the same root (a static-only direct-upload deployment will not deploy `functions/`). Exact routes are `GET /travel/api/v1/places` and `GET /travel/api/v1/events` registered by `functions/travel/api/v1/{places,events}.js`. The shared function accepts only a server-side `TRAVEL_PUBLIC_ORIGIN` with an HTTPS origin and no credentials, path, query, fragment or nonstandard port. Do not set a development server, a private service, a URL containing credentials, or the Pages site itself as upstream. The setting is absent by default: both endpoints fail closed with HTTP 503 and `{"state":"disconnected"}`.

The proxy forwards only an anonymous GET and approved destination/date query parameters, never cookies, Authorization, incoming headers, request bodies, or arbitrary paths. It has a 4.5-second deadline, no redirect following, 128 KiB response cap, JSON content-type check, response-state/schema validation, field allowlist, and `Cache-Control: no-store`. It refuses upstream responses outside expected 200/400/502/503 codes and maps failures to a generic unavailable response without leaking upstream details. No CORS wildcard, authenticated route, map tiles, geolocation, private trips or mutation is enabled. Keep upstream DNS/egress restrictions and request throttling at the Cloudflare zone and public origin; those deployment controls are not established by repository tests.

## Frontend activation

`web/travel/public-discovery.js` calls only the two same-origin URLs with `credentials: omit` and `cache: no-store`. Each Discover/Events section probes its public endpoint at load. Until a valid 200 `ready` or `empty` payload arrives, search remains disabled. Published text is inserted only via `textContent` and generated DOM nodes, and previous results are cleared before a new request or on errors. No synthetic listings, guesses about coordinates, or save/booking actions are provided. Current events API supports a **single UTC date**, not an end-date range: the end-date control remains disabled. Map/Nearby and all private features stay gated.

## Automated evidence and remaining release gates

`420Travel Web Qualification` runs `python3 web/travel/check_site.py` and `node --experimental-default-type=module web/travel/test-public-route.mjs`. The Node test uses a stub upstream to exercise allowlisted records, suppressed Set-Cookie/private fields, method/path/origin rejection, redirects, malformed responses, outage, and empty results. These mocks are not evidence of a reachable HTTPS Go deployment or service publication/revocation correctness.

Before activating public discovery in production, independently deploy and identify a reachable HTTPS Go `cmd/420travel` service backed by an authoritative public Location/Events projection; verify direct `GET /readyz` and both JSON endpoints (including withdrawal/outage behavior); configure only the verified `TRAVEL_PUBLIC_ORIGIN` as a **server-side** Pages Functions environment setting; ensure Cloudflare deploy actually includes Pages Functions; capture deployment ID, Git commit, upstream version, HTTPS security headers, 200/empty/503 cases, and mobile/desktop/keyboard/screen-reader acceptance. If the origin cannot be verified, leave the variable unset. Never represent CI or a checked-in function as proof of a live routed site.
