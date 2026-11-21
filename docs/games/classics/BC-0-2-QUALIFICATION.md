# BC-0.2 — Unified Games menu: implementation and source qualification

**Status:** Repository IMPLEMENTED and CI QUALIFIED on 2026-11-21. **Public Cloudflare Pages deployment and a real-browser smoke test are not independently verified by this evidence.**
**Qualified code head:** [`822dcbd40048c49e07bd2bfff79e305ed4b750ea`](https://github.com/abvhiael/420-integrated-v0.1/commit/822dcbd40048c49e07bd2bfff79e305ed4b750ea).
**Required workflow:** [Bong Goggles Web Verification #44953039287](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44953039287) — **completed, success** at that exact SHA.
**Parent baseline:** CCC-6 was merged as [PR #1313](https://github.com/abvhiael/420-integrated-v0.1/pull/1313) on `main` at `96373f6649b1f5a78d8db5a44bb09a4c0dfcb599` before BC-0.2 was applied. Its offline save/resume and mobile controls were preserved.

## User-visible implementation

- `/games` is the primary, publicly browsable (no 420Wallet required) catalogue. It displays the **17 Main Classics** and **8 Canadian Classics** separately, in the exact fixed BC-1…BC-25 delivery sequence.
- All 25 roadmap entries have unique, stable, keyboard-navigable `/games/<slug>` pages with the game's name, player count, milestone, availability and a link back to the main catalogue and legacy Classics. The catalogue also retains **five unrelated existing entries**: Rummy, Asshole, Cross-Country Chaos and both previous five-dice editorial variants.
- Existing `/classics`, `/classics/cross-country-chaos` and `/account/games` routes remain available. The old Classics tiles now link to individual pages without removing the real local Play Cross-Country Chaos action. Existing CCC-6 save/resume machinery remains untouched.
- Desktop header, desktop sidebar and six-item mobile footer visibly include Games. A game detail page marks Games active. The header search link still reaches Discover even though the mobile footer prioritizes Games.
- Registered seven-type wallet/on-chain BG-15 session views remain permission-gated **inside** the Games hub. Off-chain AUTH-9 quick games remain separately available at `/account/games`. No browser catalogue link grants on-chain access, creates an account or invents a verified session.
- Status is deliberately truthful: `Registry only — not yet playable`, `Planned — not yet playable` or `Playable locally` (Cross-Country Chaos only). No 25-game Play/Start controls or live multiplayer, rules-engine, matchmaking, AI or rewards authority is invented by BC-0.2.
- Scrabble and full 1/2/3/6-row Yahtzee now appear as distinct planned entries; word list, branding, scoring and rules qualify in later game milestones, not here.

## Changed code and tests

| Location | Result |
|---|---|
| `bong-goggles/web/core/classics.js` | 25 ordered roadmap IDs, metadata and lookup; Scrabble and full Yahtzee catalogue entries; legacy catalogues preserved |
| `bong-goggles/web/core/routes.js` | Strict known-slug `/games/<slug>` resolver, public browse route and 404 fallback |
| `bong-goggles/web/core/games-ui.js` | Main/Canadian/legacy catalogue sections, clickable tiles, honest detail pages, wallet-only canonical sessions separated |
| `bong-goggles/web/core/classics-ui.js` | Legacy Classics tile links and Games back-link, preserving CCC-6 engine, visuals and save controls |
| `bong-goggles/web/core/app-shell.js` | Unified route dispatch and active nav, preserving CCC-6 `chaosSaveInfo` and unrelated app routes |
| `bong-goggles/web/core/dashboard-ui.js` | Prominent Games header navigation |
| `bong-goggles/web/styles.css` | Responsive card grid, detail view and keyboard/forced-colour affordances |
| `bong-goggles/web/test/classics-menu.test.js` | Eight focused tests: exact 25 order, every link and page, legacy preservation, unknown-slug denial, wallet isolation and mobile navigation |
| `bong-goggles/web/test/{app-shell,games,cross-country-chaos,dashboard-ui}.test.js` | Updated old wallet-gated `/games` expectations to enforce public browsing without weakening the wallet-only session boundary |
| `bong-goggles/web/scripts/qualify-web.mjs` | Preserves original 1,157 KiB base limit and all artwork/individual-file limits; adds strictly bounded and path-specific BC-0.2 menu growth validation |

## Actual qualification evidence

- [Run #44953039287](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44953039287), exact SHA `822dcbd40048c49e07bd2bfff79e305ed4b750ea`: **363/363 Node web unit tests passed**, **4/4 public-feed HTTP regression tests passed**.
- Web static checks: **PASS**. Default account-social-disabled build and published runtime-config check: **PASS**. Explicit approved Cloudflare account-social-enabled build and published runtime-config check: **PASS**.
- BG-19.13 static asset and accessibility qualification: **PASS**. Frontend secret scan: **PASS**.
- Static budget source evidence: `BC-0.2 bounded menu asset allowance` logged **7,918** path-scoped extra bytes; earlier/other base output **1,184,225** bytes against unchanged legacy limit **1,184,768** bytes. BC-0.2's additional ceiling is **8,192 bytes**, and every changed published file has its own pinned, non-expanding addition limit. Existing card, map, vehicle and individual JS/CSS limits are unchanged.
- An earlier source-commit web run [#44952540887](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44952540887) exposed two inaccurate old tests (slash normalization and wallet-only catalogue assumption); both were corrected. Follow-up [#44952647303](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44952647303) passed all 363 unit tests and both builds but exposed the new menu's 7,375-byte overflow of the old non-menu asset budget; scoped accounting corrected that without relaxing the original limit. **Only final successful exact-head #44953039287 is qualification evidence.**

## Authority, release and remaining boundaries

- This is web catalogue/routing work only; no changes to `BongGogglesGameSessionRegistry420`, 420ID credentials, AUTH-9 game authority, wallet permissions, zero-wager enforcement, CCC-6 game rules or Cross-Country Chaos achievements.
- The code is committed to `main` and qualified by source/CI, but these tests do not prove Cloudflare's current production deploy completed or that a real browser loaded every route on the public host. Do not describe the menu as independently browser-deployed without named-environment evidence.
- **BC-0 is IN PROGRESS**; BC-0.1 and BC-0.2 are code-qualified. All later BC-0.3–BC-0.12 infrastructure steps remain unimplemented. Next canonical task is **BC-0.3 Shared UI**, which was not started here.
