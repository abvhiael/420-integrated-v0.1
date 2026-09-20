# BG-19 public DISCOVER-feed HTTP adapter — partial integration

This increment adds `services/bong-goggles-indexer-v1/src/publicFeedHttp.js`, tests in `services/bong-goggles-indexer-v1/test/publicFeedHttp.test.js`, and a dedicated regression step in `.github/workflows/bong-goggles-web.yml`. It reads existing `materializeState()` maps; it does not invent or persist canonical records. The adapter returns a versioned, no-store, read-only response from `GET /v1/public-feed?feedClass=DISCOVER&limit=20` with a maximum limit of 50. It excludes non-public audiences, non-POST objects, withdrawn objects, inactive authors, and fields not on an explicit browser-safe allowlist. An independently qualified server-side visibility/moderation callback must return exactly `true` for each object. A missing or failing policy, missing canonical snapshot, or unusable feed index fails closed.

**This is an internal route function, not a running HTTP server or qualified public endpoint.** There is no production social indexer origin configured in the web runtime, no deployed route, no CORS/HTTP ingress hardening, no verified current canonical snapshot/finality/freshness, and no independently qualified implementation of the visibility/moderation callback in this increment. The browser shell and `qualified-read.js` are deliberately not pointed at an invented host, and anonymous responses cannot authorize private/account-scoped feeds, messaging, relationships, Wallet actions, rewards, or moderation controls. The bounded response is an initial DISCOVER sample, not a complete paginated feed; `hasMore:false` signals the absence of a qualified cursor implementation, not proof that no other content exists. Do not use the sample as a full feed until pagination is qualified.

## Required next gates

1. Bind `getView` to the deployment-owned *current* canonical checkpoint on the expected chain; enforce replay/reorg, staleness, and source-health policy.
2. Implement, test, and independently qualify `canShowPublicObject` against canonical public audience, all relevant block/mute/moderation/author/content restrictions and any public repost/source-object dependencies. Never trust a caller-supplied client policy.
3. Register the route in a real HTTP server behind tested host/origin/CORS, auth separation, rate limits, size/time bounds, HTTPS, error redaction, observability and access logs that exclude account/private data.
4. Publish a deployment-attested service origin and versioned response schema; configure a distinct social projection service in the web runtime instead of assuming the generic 420Indexer `/v1` API has this route.
5. Wire `app.js` through a strict browser validator and qualified-reader boundary; test real browser happy-path, empty/denied/error/stale cases, moderation/reorg invalidation, and canonical refresh.
6. Implement qualified cursor semantics before exposing the complete feed; then expand to authenticated HOME/FRIENDS/FOLLOWING, profile and community projections, write intents and the remaining BG-19.14/19.15 release evidence.

PR #350 remains open and BG-19 is **not** at production closeout merely because the route adapter passes unit tests.
