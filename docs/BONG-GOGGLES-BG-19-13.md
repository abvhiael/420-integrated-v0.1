# BG-19.13 — performance, accessibility and reliability qualification

Status: STATIC / UNIT QUALIFICATION IMPLEMENTED; BROWSER AND LIVE-SERVICE RELEASE GATES OPEN.

## Exact implementation

- `bong-goggles/web/core/reliability.js`: bounded, retryable **read-only** service recovery (at most 3 retries), deterministic 250/500/1000 ms backoff by default, abort and stale-response discard, fixed degraded reason without exception text; account/chain/route/session-epoch scope keys.
- `bong-goggles/web/test/reliability.test.js`: transient read, exhaustion, nonretryable policy failure, abort, privacy, and scope invalidation regression tests.
- `bong-goggles/web/scripts/qualify-web.mjs`: static build cap of 256 KiB per JS/CSS asset and 1 MiB total distribution; checks document language, viewport, main landmark, visible focus, reduced motion, forced colors and fail-closed noindex default.
- `.github/workflows/bong-goggles-web.yml`: invokes these checks after building.

## Authority and recovery constraints

This recovery helper must be wired only into idempotent public or account-authorized reads when qualified browser-facing transport is available. The caller must independently authorize each read, use an account/chain/session-specific cache key, invalidate previous responses on account, network or session changes, and abort on route changes. Never retry Wallet transactions, reward claims, moderation writes, game moves or 420Messenger sends using this read helper. Do not cache decrypted messages, session secrets, private keys, bearer capabilities or signed media URLs. A stale, denied or failed response must not be promoted to canonical UI state. The helper returns no exception body or private data to UI or telemetry.

## Release gates not yet proven

1. Wire qualified feed/search/profile/game/messaging/notification transports and exercise independent media/indexer/messaging/notifications failure, bounded reconnect and authorization downgrade in a deployed browser. The unit helper by itself does not supply network integration.
2. Record real mobile and desktop route loading, p75 LCP, INP, CLS, measured feed/search/profile render latencies, and loaded asset transfer sizes from deployment. Static asset byte caps are not page-load evidence.
3. Run keyboard-only tab/shift-tab, focus restoration after navigation and modal close, screen-reader naming/live region checks, 200–400% zoom/reflow, color contrast and touch-target verification at phone/tablet/desktop widths; include Chromium, Firefox and WebKit/Safari browsers. Static markers alone do not establish WCAG compliance.
4. Verify media lazy loading and qualified responsive derivative selection with production media fixtures; no private signed URL caching. The current UI primarily uses placeholders.
5. Exercise refresh/reconnect during pending Wallet submissions and prove that confirmation requires a canonical receipt and refreshed projection. Do not resubmit writes automatically.
6. Preserve `noindex,nofollow` for private pages and fail-closed rendering while public SSR/HTTP 404/410 policy remains incomplete.

BG-19.13 should not be called production-qualified until these deployment/browser gates and the earlier BG-19 live integration/security gates are evidenced on the exact release candidate.
