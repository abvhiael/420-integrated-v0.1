# 420Bet unified lobby — BET-AUDIT-6.1

Standalone Vite browser shell for discovery, category filtering and immersive navigation. Run `npm install && npm run dev` from this directory, `npm test` for catalogue tests and `npm run build` for a production bundle.

The lobby does **not** implement game logic, authentication, wallet signing, funding, betting, odds or settlement. Original clients remain authoritative. The repository has a Vite Dice client (`clients/420bet-dice-v1`), a standalone fantasy browser build (`clients/420bet-fantasy/daily`) and a Python sportsbook client (`clients/420bet-sports`); no public production route is assumed for any of them.

For an operator-controlled same-origin deployment, set `window.BET_LOBBY_CONFIG = { routes: { dice: '/games/dice/' }, status: { dice: 'preview' } }` before `src/main.js` executes, by adding a configuration script to the host page. URLs must be same-origin root paths; no default routes are enabled. The status setting is a discovery/launch hint only, **not** wagering authorization. Deployment must independently authorize eligible sessions and validate all transactions server-/chain-side. Do not mark games available solely because a bundle exists.

Returning to the lobby removes the embedded game iframe. **Active funded game sessions must not be launched through this initial embedded integration until the respective game client implements and verifies safe exit/session recovery.** Later stages 6.2–6.11 own that wiring. This shell does not silently execute exits, refunds, settlements or wallet operations.

No prediction market catalogue entries. User decision: BET-AUDIT-6.9 cancelled; retain numbering. Artwork uses CSS placeholders, never substitutes for canonical uploaded game artwork.
