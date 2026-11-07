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
