# 420Travel website branding and asset roadmap

Status: APPROVED DESIGN / ASSET INTEGRATION PENDING. This is a web-branding workstream within GEN-SVC-3 on PR #356, not evidence of production deployment or private-service readiness. Refer to `genesis/svc3/travelapp/GEN-SVC-3-ROADMAP.md` and `web/travel/CLOUDFLARE-DEPLOYMENT.md` for the broader release gates.

## Approved brand reference

Use the user-selected **front-facing** retro green camper van logo (not the later three-quarter-view variation): cream background, green-and-cream van with a surfboard on its roof, cannabis-leaf motif, pine trees and mountains, green `420`, black `Travel`, and dark-green lowercase tagline exactly `a greener way to see the world`. No decorative arc above the mountains. Preserve the selected composition and typography in the primary artwork; don't redraw a competing mark from an approximate verbal description. The approved image originated in the design conversation and **has not yet been committed as an asset to this repository**. Obtain the actual approved image bytes and verify visually against that reference before marking the source-asset task complete. Do not substitute another generated variant or claim asset integration merely because this document exists.

## WEB-BRAND-1 — source asset and repeatable exports [TODO]

- Store the verified, approved full logo as a versioned image under `web/travel/assets/brand/420travel-logo.png` (or a lossless master equivalent), with provenance and a simple approval note. Retain a full lockup for landing pages and a distinct van-only crop for small icon use. Do not upload fonts or claim a vector master was generated unless one actually exists.
- Produce reproducible exports rather than manually maintaining inconsistent artwork. Keep cream background/color continuity, legible edges, appropriate transparent variants where needed, and avoid including tiny wordmark/tagline in favicon-sized imagery. Record generation command/tool, source asset filename/hash, output dimensions, and any manual crop coordinates. Review small icons at actual display size; simplified crop is permitted only when visually faithful to the approved van.
- Generate and commit: `/favicon.ico` containing 16x16, 32x32 and 48x48 van-only sizes; `/favicon.svg` only if a genuinely reviewed vector is available (otherwise omit SVG); `/favicon-16x16.png`, `/favicon-32x32.png`, `/apple-touch-icon.png` (180x180), `/icon-192.png`, `/icon-512.png`, and `/maskable-icon-512.png` with appropriate safe area. Provide a monochrome Safari pinned-tab variant only if genuinely designed/tested; don't point `mask-icon` to a color PNG. Use website-root paths relative to `web/travel` so Pages serves each asset correctly.
- Generate and commit full-lockup website graphics: responsive header logo (with a van-only small-screen alternative if necessary), about/footer version, and a 1200x630 Open Graph/Twitter share preview. Document whether those previews are intended for public sharing and omit fake listings or claims of live booking capability.

## WEB-BRAND-2 — integrate branding into static website [TODO]

- Replace text-only `420Travel` branding in `web/travel/index.html` with the official logo using a responsive `<picture>`/`<img>` as appropriate, useful alt text, intrinsic dimensions and CSS preventing mobile clipping. Keep meaningful live text for the site name/heading where needed rather than relying solely on image text; avoid duplicate screen-reader announcements.
- Add `<link rel="icon">` (ICO and PNG), `<link rel="apple-touch-icon">`, theme color, Open Graph/Twitter metadata and appropriately sized social image. Add a minimal web app manifest **only if** the application name, start URL, scope, display behavior and icons accurately describe the deployed public preview. Do not imply offline support, push notifications or installable authenticated capabilities without implementation.
- Verify actual root and nested routes resolve favicon/graphics correctly under the configured Cloudflare Pages output directory `web/travel`; avoid incorrect `/travel/assets/...` paths when the site itself is served from the domain root. Ensure security headers allow same-origin image/manifest use without relaxing network permissions or exposing private data. Keep disconnected-state wording and booking/DOOBR feature gates unchanged.

## WEB-BRAND-3 — automated asset and browser qualification [TODO]

- Add a focused CI check validating existence, MIME/signature, required dimensions, nonblank crops, manifest links (if used), metadata references, and no broken local image URLs. Inspect the committed image files in GitHub; a green Go test alone does not validate static branding.
- Test favicon in browser tabs at 16/32 px, Apple touch and Android icons on light/dark system themes, site header at 320 px and desktop, keyboard focus, descriptive alt text, layout shifts and social-card preview. Check assets return 200 with expected content types and correct cache/security headers in a real Cloudflare preview.
- Recheck dedicated GEN-SVC-3 Travel and repository qualification on the exact final branding commit. Record actual CI workflow URLs and results; do not inherit earlier SHA's green status. Capture preview deployment ID, exact commit, HTTPS URL and custom-domain test; only then mark branding deployed.

## WEB-BRAND-4 — broader website graphics [PLANNED, NOT RELEASE BLOCKING]

- Establish reusable authentic imagery and optional abstract illustrations for discovery empty/error/loading states, public events, place detail, map/list and trip-planning sign-in/disabled states. Do not present illustration or sample destinations as published real records; provide readable text even when images fail to load.
- Add responsive image sizes/formats, useful alt-text conventions, optional image attribution/license ledger where applicable, and performance budgets to avoid a large hero download on mobile. Avoid external third-party image requests and embedded trackers by default.

## Dependency/order and release boundary

Proceed WEB-BRAND-1 -> WEB-BRAND-2 -> WEB-BRAND-3; WEB-BRAND-4 can follow iterative UI review. The static public preview may deploy before private Travel services are ready. Live Identity, trips, sharing, claims, review verification, booking and DOOBR remain governed by the existing independent GEN-SVC-3 release gates. Do not merge PR #356 based solely on website branding or green CI.
