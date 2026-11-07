# 420Bet Sportsbook — Bud & Ball Lounge master visual contract

**ID:** BET-SPORTSBOOK-UI-01 · **Source of truth:** user-approved Bud & Ball Lounge sportsbook background, 7 November 2026. Implementation in `clients/420bet-lobby/src/sportsbook-ui.js` and `sportsbook.css`.

## Approved composition

- **Exact wallpaper:** `clients/420bet-lobby/public/assets/420bet/sportsbook/sportsbook-wallpaper.png`, uploaded by the owner and reused without recolouring, recreation or generated substitutes. Entire 16:9 visual fills the screen. Logo, neon **Sportsbook** wordmark, **Bud & Ball Lounge** lettering, stacked TVs, dog, coffee table and the blackboard are *already in this image*. Do not draw a second hero/title/header or obscure those images.
- **Chalkboard:** Fixed to the physical blackboard on the **right**, not a floating dashboard card. The art surface and HTML overlay share a scaled 1648×928 coordinate system. The image contains the engraved heading “TODAY'S ACTION”; the overlay begins inside the chalk writing area and adds a subtle **MARQUEE MATCHUPS** subtitle with up to four verified fixtures. No photo editing, no baked-in team names, no fake odds.
- **Seven controls:** All Sports, Live Betting, Game Lines, Parlays, Futures, Promotions, My Bets. Separate HTML buttons over the lower art edge, dark felt/emerald gradient, bright cannabis-green border/glow, yellow iconography and cream bold labels. Clickable, keyboard accessible; URL contract `/#game=sportsbook&tab=<slug>`. Primary landing `/#game=sportsbook`.
- **Game Lobby return:** Small restrained button at upper-left, never a second 420Bet header bar. No extra app footer on landing; avoid covering the main mural.
- **Layer pages:** Reuse same wallpaper. A dark semitransparent reading panel is permissible for detailed content but should not conceal the original mural branding when avoidable. Each layer returns to the main sportsbook via a dedicated button. No unqualified bet slip, transaction, history or quote controls.
- **Palette:** `#86FF38` leaf/neon; `#F4C650` warm brass; `#FFF9E6` cream; `#082D12` deep forest; `#020D0A` nearly black; warm wood from artwork. Gold micro-highlights, emerald glow; no flat SVG facsimiles of branded image assets.
- **Responsive:** Desktop supports 16:9 and smaller laptop heights without clipping controls. On narrow displays the background may crop, so the marquee board becomes a separate translucent green/chalk card above a two-column bottom navigation grid. Touch controls ≥44px; keyboard focus gold, reduced-motion respected.

## Marquee source contract

The static wallpaper **cannot** by itself supply real daily fixtures, odds, time or outcomes. This feature's optional same-origin, read-only endpoint defaults to:

`GET /api/420bet/sportsbook/marquee` (trusted deployment override: `BET_LOBBY_CONFIG.sportsbookMarqueeEndpoint`).

Expected JSON (example schema; names and times are **illustrative protocol placeholders, not published fixtures**):

```json
{
  "source": "verified-sports-fixtures-v1",
  "authority": "verified",
  "date": "2026-11-07",
  "timezone": "America/Regina",
  "observedAt": "2026-11-07T16:55:00Z",
  "expiresAt": "2026-11-07T19:00:00Z",
  "events": [
    {
      "id": "licensed-provider-event-id",
      "league": "NHL",
      "home": "Home Team",
      "away": "Away Team",
      "startsAt": "2026-11-07T22:00:00Z",
      "status": "scheduled"
    }
  ]
}
```

The **same-origin server** must authenticate and qualify the source through licensed schedule/data entitlements, provider identity, official event IDs/league mapping, schedule amendments, event status, stale-feed monitoring and exact timestamps; only then may it assert `authority:"verified"`. That boolean/string is *not* cryptographic proof the browser can verify independently. The browser treats it as a strictly validated server contract and suppresses all events on malformed/stale response. No provider feed / no deployed endpoint means an explicit **NO VERIFIED DAILY FEED** message; never pretend the slate is current.

The page makes one initial GET and re-reads every five minutes while mounted. It uses `cache:no-store`, same-origin credentials, text-only DOM, at most four events and real time-zone formatting, with no HTML injection. Do not expose bookmaker odds in this fixture feed. **Live quoted prices, bets, market availability, and account history require their own 5D signed-provenance/contract testnet gates**. Never reuse an illustrative sports pick, generated artwork number, or expired fixture as a live quote.

## Implementation/qualification

- User artwork path: `/assets/420bet/sportsbook/sportsbook-wallpaper.png`.
- UI files: `clients/420bet-lobby/src/sportsbook-ui.js`, `sportsbook.css`.
- Focused tests: `clients/420bet-lobby/tests/sportsbook-ui.test.mjs`.
- Full route and each subpage remain **practice/view-only**. No wallet signing, betting, settlement or real-time odds enabled.
- Reuse `docs/bet/BET-AUDIT-5D.1-SPORTSBOOK-ARCHITECTURE.md` and `docs/bet/BET-AUDIT-5D.3-ODDS-INGESTION-PROVENANCE.md` for future sportsbook backend work, rather than inventing a client-authoritative engine.

## The Odds API adapter (2026-11-07)

420Bet's public, *read-only* fixture provider is now implemented in the Cloudflare **Pages Functions** of the 420Bet lobby project:

- `clients/420bet-lobby/functions/api/420bet/sportsbook/marquee.js`
- `clients/420bet-lobby/functions/api/420bet/sportsbook/lines.js`
- `clients/420bet-lobby/server/sportsbook-provider.mjs`

The `THE_ODDS_API_KEY` binding is a **Cloudflare encrypted runtime secret** (never Vite `VITE_*`, browser config, or GitHub source). Pages must be deployed with **project root** `clients/420bet-lobby`, build `npm run build`, output `dist`, and Pages Functions enabled. If 420Bet instead runs as a Workers static-assets deployment, use a compatible Worker entrypoint and route; Pages Functions are not automatically compiled into a static-only Worker build. Production and Preview secret settings can differ. Validate that the live domain returns JSON rather than an SPA HTML fallback. Do not print or log upstream URLs containing the key.

The chalkboard calls `GET /api/420bet/sportsbook/marquee`. The server fetches **quota-free** `/v4/sports/{sport}/events` for NHL, NBA, NFL, MLB and MLS (partial league outages permitted), filters to the current **America/Regina** calendar day, includes at most four genuinely listed future fixtures, labels every card scheduled rather than guessing “in-play”, and coalesces repeated requests within each isolate for ten minutes. This makes *no paid odds calls*. The public JSON is scoped to a strict text-only schema and contains no credential, wager, source signature or price. Provider observation supports factual display, not authorization under the existing SportsOddsIngestion420, signed source verifier and funded ticket contracts.

The Game Lines frontend requests `GET /api/420bet/sportsbook/lines`. This is deliberately **KV-cache-only**, binding name `SPORTSBOOK_ODDS_CACHE`. Public website traffic can never directly trigger a billable `/odds` request: it returns 503 until a *separately scheduled and budget-controlled upstream ingestion process* has inserted a fresh `sportsbook:lines:v1` record. The record is `{source:"the-odds-api-v4-display-only",validUntil:<Unix milliseconds>,events:[{id,league,home,away,startsAt,prices:[{bookmaker,outcome,american,updatedAt}]}]}`. This remains non-clickable **bookmaker-observed indicative data**, not an executable sportsbook quote. No odds refresh job is deployed or represented as running by this implementation; first choose a schedule and enforce a central monthly quota gate, not request-driven cache miss fetching.

The provider's official API usage guide confirms free `/sports/{sport}/events` requests and chargeable `/sports/{sport}/odds` requests (one credit per region per market). **500 monthly free credits do not support continuously refreshed in-play multi-league prices.** A paid-odds ingester must use an independently configured, controlled scheduler and a persistent cross-region cache/budget authority before it is activated.

The live deployment must verify the Cloudflare secret binding, route activation, endpoint response, source licensing and server-side quota monitoring. No live upstream request has been asserted solely by committing these files. No real-money wagering or production settlement is enabled.

## Cloudflare Workers deployment correction (2026-11-07)

**Confirmed actual deployment:** Cloudflare Workers Builds, production Worker **`420bet`**, root `/clients/420bet-lobby/`; existing build `npm install --no-audit --no-fund && npm run build` and deploy `npx wrangler deploy --assets ./dist --name 420bet ...`. This is *not* Cloudflare Pages; the previous `functions/api/...` files alone cannot activate API routes on this platform.

The repository now supplies **`clients/420bet-lobby/wrangler.jsonc`** with `main: "./worker/index.js"`, the same Worker name `420bet`, an `ASSETS` binding targeting the existing `dist` build, and a narrowly scoped `assets.run_worker_first` route for `/api/420bet/sportsbook/*`. This keeps game/JS/image requests on direct asset serving instead of paying the overhead of a request-level middleware. The Worker code dispatches exactly:
- `GET /api/420bet/sportsbook/marquee` to the existing quota-free sports events adapter, with `env.THE_ODDS_API_KEY` encrypted secret.
- `GET /api/420bet/sportsbook/lines` to the existing *cache-only*, read-only Game Lines endpoint. **It will return HTTP 503** until a separately budgeted refresh job and `SPORTSBOOK_ODDS_CACHE` KV binding exist.

No API key value is in the committed configuration. Cloudflare's **Production** settings screenshot established that the secret binding named `THE_ODDS_API_KEY` already exists and is encrypted. Wrangler `keep_vars:true` avoids overriding existing dashboard plaintext vars, and the Wrangler docs state that encrypted Worker secrets are preserved during ordinary deployments. The Worker config contains no `routes`, so the operator's existing custom-domain route is not replaced. The current Worker build/deploy command should automatically pick up `wrangler.jsonc` from the build root. **Do not create a second Cloudflare site** or switch this project to Pages.

### After merging

1. In **420bet → Production → Deployments**, check a successful build of the merge commit. The build log must bundle a Worker module (from `worker/index.js`), not only a static `dist` folder. If Workers Builds ignores the Wrangler config because of explicit dashboard CLI overrides, change **only** the deploy command to `npx wrangler deploy` (the checked-in config already supplies name, main, date and assets). Do not modify the production secret or domain.
2. Open `https://420bet.420integrated.org/api/420bet/sportsbook/marquee`. Correct behavior is JSON with `source:"verified-sports-fixtures-v1"`, `events`, `observedAt`, and `expiresAt`; empty events is valid if none are scheduled today. HTML indicates a Worker routing/deployment issue; `sports_feed_not_configured` indicates a missing *runtime* secret; `sports_feed_unavailable` indicates a provider fetch/response failure. Make sure this matches the actual production deployment SHA.
3. Open `https://420bet.420integrated.org/#game=sportsbook` and verify the original wallpaper, image assets and other casino games still work. The chalkboard populates only actual provider event names, not paid odds or invented lines.
4. The `/api/420bet/sportsbook/lines` endpoint should still return `odds_cache_not_configured` until a bounded, shared KV/scheduled provider-odds ingestion is delivered. **That 503 is deliberate and not part of the Worker deployment bug.**
5. If a deployment fails, roll back from the 420bet Worker's **Deployments** screen; do not reset all 420Integrated site builds.

The focused Level 1 workflow tests direct API dispatch, unknown-route fail closed, preservation of casino assets, missing-secret behavior, and a Wrangler `--assets ./dist --name 420bet --dry-run` entrypoint bundle.
