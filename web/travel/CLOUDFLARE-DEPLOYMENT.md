# 420Travel — Cloudflare Pages public preview handoff

Status: source prepared for a public, disconnected preview. A successful GitHub build is **not** evidence of a Cloudflare deployment. Keep PR #356 open.

## Deploy static preview

Create or connect a Cloudflare Pages project backed by `abvhiael/420-integrated-v0.1`. Choose the branch `feature/gen-svc-3-travel-implementation` for a branch preview; if the project is configured to publish only its production branch, intentionally configure that branch instead. Set framework preset to **None**, repository root to the repository root, build command to **empty**, and build output directory to **web/travel**. Do not set `web/travel` as both root and output path. The output directory includes `index.html` and `_headers`. Do not place API credentials in Pages public environment variables. Verify the generated `*.pages.dev` URL before associating `travel.420integrated.org` under the Pages project's Custom domains. The domain must be bound in the correct Cloudflare account/zone and DNS must resolve to this Pages project; GitHub access alone cannot perform that account-side step.

## Architecture and feature gates

The site in `web/travel` is a static public layout preview. Existing Go routes are served by `cmd/420travel` and `genesis/svc3/travelapp`; **Cloudflare Pages does not run the Go server binary**. The static preview does not presently fetch a live public feed, authenticate users, or proxy Go endpoints. A subsequent reviewed integration may use a separately deployed HTTPS Go origin with same-origin `/travel/*` proxy routing via a Cloudflare Worker/Pages Function, or a public-read JSON API with explicitly qualified CORS and publication/withdrawal semantics. Never route authenticated mutation requests to a publicly accessible development server. Choose a single authoritative origin and verify cookies, audience, CSRF, Origin, Host, caching, service revocation, security headers and rate limiting before enabling it. Do not rewrite public discovery URLs to private stores or expose service credentials in frontend source.

Until a real trusted public Location/Events service is deployed and its results are validated, the static page truthfully shows disconnected/empty service states rather than example destinations. Save to trip remains an authenticated Go handler capability and must stay unavailable in the static preview until live Identity, owner-scoped persistent storage, CSRF and current-public-record checks pass deployed acceptance. Claims, unlisted shares and verified reviews also remain gated. Booking and DOOBR transactions are disabled.

## Acceptance after Cloudflare project is connected

Record exact Git commit, Cloudflare deployment ID and preview URL, HTTP status and response security headers, desktop/mobile and keyboard/screen-reader results, custom-domain DNS and HTTPS verification, and actual backend service versions if any are enabled. Do not mark `travel.420integrated.org` live based on a repository commit, GitHub CI, or a local HTML render alone.
