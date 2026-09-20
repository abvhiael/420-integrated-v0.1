# GEN-SVC-2.23 — Cross-app consumer qualification

## In-repository integration

`genesis/svc2/consumers` provides a presentation-only adapter over `sdk.Client` for public map, travel and calendar views. `public_feed_test.go` exercises the canonical in-memory Location and Events sources, discovery, the v1 HTTP handler, SDK decoding and three consumer projections together. The test deliberately includes a public event pointing to a private venue and a public event pointing to an unlisted venue; neither event may appear in the travel/calendar join. A standalone public event may appear in the calendar. Approximate public places may appear as area cards without exact coordinates. Updating an event or place's canonical visibility must remove its exposed consumer representation without granting the SDK lifecycle or authorization authority.

## Consumer contract

- Map: render only `Feed.Map.Items`. `kind=area` is text-only coarse geography, **not a coordinate or geocoded pin**. Do not query provider aliases or canonical records to enrich it.
- Travel: render only `Feed.Travel` public venues and their associated public event cards. A referenced venue that is no longer available to public readers is not a valid fallback to a private or unlisted location.
- Calendar: render only `Feed.Calendar`, including public standalone events without a venue. This feed is discovery, not ticketing, booking, entitlement or private-calendar authorization.
- Refresh source views when changing event visibility, cancellation, version, occurrence exceptions, and place visibility/precision. Do not persist an older public consumer feed as authoritative. The HTTP API uses `Cache-Control: no-store`; consumers must enforce equivalent cache invalidation.

## Remaining application-level release gates

The adapter and its in-process tests **do not** establish that existing 420Travel, 420Maps, 420Calendar, marketplace, merchant, or other frontends actually call this SDK, or that a public service is deployed. For each app, record the UI route and integration PR, verify its network client uses the v1 API or equivalent public projections, and test the resulting rendered UI for approximate-location geocoding, stale cards, cancelled occurrences, private venue references, and booking/payment boundaries. Recheck external map-provider logging, network TLS/authentication where appropriate, rate limiting, and cache behavior in the deployment environment. Treat those gates as outstanding until concrete integration and verification evidence is attached.
