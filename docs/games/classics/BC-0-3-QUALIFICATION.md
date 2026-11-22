# BC-0.3 — Shared game screen framework and source qualification

**Scope:** Shared game introduction, rules, Play, opponents, tabletop, results, history, rematch and resume affordances, not implementation of 25 individual rules engines, account-game authority, matchmaking or live deployment.
**Status:** Repository source **QUALIFIED** on 2026-11-21; live production/browser deployment not independently attested.
**Qualified code commit:** [`38732671ecf1adf22c50d605657a6dbf85476e15`](https://github.com/abvhiael/420-integrated-v0.1/commit/38732671ecf1adf22c50d605657a6dbf85476e15).
**Exact-head workflow:** [Bong Goggles Web Verification #44955770348](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44955770348) — **completed, success** at the above SHA.
**Reconciled base:** [`a64ce8e095f92d8754be79319de9ccc8980848d7`](https://github.com/abvhiael/420-integrated-v0.1/commit/a64ce8e095f92d8754be79319de9ccc8980848d7) (BC-0.2 complete, CCC-6 already merged); no outstanding game-session contract changed. The concurrent [CCC account-multiplayer PR #1314](https://github.com/abvhiael/420-integrated-v0.1/pull/1314) was open during inventory and not modified or merged by this task.

## Delivered interfaces

- Every game has eight direct-link screens: `/games/<id>` (introduction), `/games/<id>/rules`, `/play`, `/setup`, `/table`, `/results`, `/history`, `/rematch`. Only exact known game IDs and screen segments resolve; unknown or nested segments remain 404.
- An accessible horizontal in-page navigation uses native anchors, `aria-current`, keyboard focus and the existing same-origin SPA routing. It requires no wallet for public browsing, and preserves the BC-0.2 Games sidebar/header/mobile navigation.
- **Introduction** uses each game's allowlisted name, player count, availability, milestone and existing safe description. **Rules** distinguishes unavailable rulesets from a verified future rulebook, labels the active variant or states that none has been selected, and shows known pending options for Yahtzee's 1/2/3/6 full-scorecard rows and Go's board sizes without inventing a complete ruleset.
- **Play** has a real link to the already working `/classics/cross-country-chaos` local game; all other titles show explicitly disabled Play and Resume buttons, without creating a match or implying a server exists.
- **Opponent setup** lays out participant counts and seats, human/computer selectors, per-computer Easy/Medium/Hard choices and pending ruleset selection. The form and Create Game action are disabled until the authenticated account-game service and bot policies exist, with a visible explanation that the preview saves nothing.
- **Game table** accepts only an explicitly marked, game-ID-bound, bounded future server projection; displays a public-only 1–19-cell-per-axis grid, turn label and per-seat scores. Unverified/wrong-game/wrong-source views show no board or private data. Hidden hands are not rendered from generic views.
- **Results, history and rematch** display verified winner/scores and up to 40 newest validated history entries from a qualified view. Unverified views get truthful empty states. Rematch remains disabled until an authorized session/invitation handler exists; no rewards or finished games are invented.
- Desktop/mobile layout, scrolling navigation, visible keyboard focus and forced-colour board/controls are scoped to shared games. All external text including names, rules and board cells is escaped; no client data becomes an authorization or transaction.

## Changed files

| File | Qualified change |
|---|---|
| `bong-goggles/web/core/shared-game-ui.js` | New reusable eight-screen UI, qualified projection guards, seat setup, variant/rules surfaces, public game table, results/history/rematch and disabled resume |
| `bong-goggles/web/core/routes.js` | Explicit seven game subroutes plus existing intro, strict game ID/segment allowlisting |
| `bong-goggles/web/core/games-ui.js` | Invokes shared template for each game while preserving original BC-0.2 details and zero-wager labels |
| `bong-goggles/web/core/app-shell.js` | Passes resolved screen to the game page and retains CCC-6 save/resume wiring |
| `bong-goggles/web/styles.css` | Responsive, accessible shared game panels, seats, controls, board and results/history views |
| `bong-goggles/web/test/shared-game-ui.test.js` | Ten targeted test cases covering 30 game entries, all 8 pages, bogus deep links, disabled actions, public-only board projection, escaping, bounded history and visual affordances |
| `bong-goggles/web/scripts/qualify-web.mjs` | Independent 16KiB source-scoped shared-screen allowance with unchanged original base, BC-0.2, card/map/vehicle and individual-file limits |

## Qualification evidence (actual runs)

- First-source run [#44955337921](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44955337921) found one overly broad new XSS test expression (372/373 pass). The test was corrected to reject raw executable tags while affirming escaped text; application security logic was not weakened.
- Interim exact-head run [#44955432975](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44955432975) passed all 373 web tests, 4 HTTP tests, both builds, assets/accessibility and frontend secret scan. A final scoped review also added disabled Resume, active-variant feedback and latest-history ordering, requiring a final exact-head run.
- **Final source qualification [#44955770348](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44955770348)**: **373/373 web unit tests passed**, **4/4 HTTP regression tests passed**, static checks **PASS**, default disabled-feature build **PASS**, explicitly activated account-social build **PASS**, runtime config verification **PASS**, BG-19.13 static assets/accessibility qualification **PASS**, frontend secret scan **PASS**.
- Final build logged **BC-0.3 UI growth 13,709 B / 16,384 B**, prior BC-0.2 menu growth **7,918 B / 8,192 B**, and original legacy base **1,184,225 B / 1,184,768 B**. There were 151 qualified published files. Cross-Country Chaos's 49 cards, six maps and six vehicles remained under their pinned size and hash checks.

## Non-authority and future integration boundaries

Rendering a `view.verified` projection does not establish authentication itself. The future session adapter (BC-0.4–BC-0.8) must enforce 420ID identity, per-seat visibility, versioned rules, authoritative game actions and rematch authorization **before** passing the view to this renderer. Existing seven-type wallet/on-chain BG-15 sessions remain separately governed and are not silently converted into account games.

**What BC-0.3 does not deliver:** playable Cribbage or another new rules engine, server persistence or resume, live online opponents, real AI, push updates, operational 420ID account integration, verified actual game outcomes or Cloudflare production browser acceptance. These are deliberately deferred to the existing later BC-0 and BC-1+ roadmap steps, not mislabeled complete.

**BC-0 remains IN PROGRESS. Next canonical step: BC-0.4 — Account integration.** It was not started in BC-0.3.
