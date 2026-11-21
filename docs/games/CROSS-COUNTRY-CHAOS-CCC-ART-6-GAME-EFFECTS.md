# CCC-ART-6 — Live card-game animations and end-of-stage celebration

**Implemented scope:** visual feedback for accepted local Cross-Country Chaos card-game transitions: travel, breakdowns, detours, slowdown, repairs, activated upgrades, four unique legendary powers, checkpoint arrival and regional/final finish-line celebrations. The game remains a **2–4 human-player local pass-and-play championship**. No blockchain, network, reward, payout or rules alteration.

## Animation authority boundary

`core/cross-country-chaos.js` remains the **single rules authority** for all three stages of 2,500 game km, movement, breakdowns, permanent detours, risk hazards, protection, repairs, free power activation, retired legendaries, banked championship kilometres and results.

`core/chaos-game-effects.js` compares only the **before** and **after** states of a **successfully accepted** `takeChaosTurn` operation. It emits immutable, public, ephemeral descriptions and from/to mileage, never writes to the game, and never performs any random draw. Rejected moves, absent status changes and ordinary card draws do not invent effects. The visual source is a closed inventory of 12 effect kinds: `drive`, `breakdown`, `detour`, `slowdown`, `defended`, `repair`, `shortcut`, `power`, `legendary`, `shield`, `checkpoint`, and `finish`.

| Requested effect | Authoritative occurrence | Presentation |
| --- | --- | --- |
| Animated vehicle travel | Actual effective `player.km` increases on mileage or power | Smooth SVG transform on the existing illustrated player piece, following sampled 960×415 region highway curves |
| Detour and backwards travel | Actual `detourLoss` and effective `km` decrease | Amber warning badge; **backwards** driving motion follows the same qualified route, not a teleport |
| Breakdown or slowdown | Accepted hazard changes `status` to `block` or `slow`, or an actual slow loss | Caution-coloured public badge and pulsing vehicle halo; no phantom hazards |
| Shield/equipment defense | Authorized power spends a real `used` slot or shield | Protective glow and named defense; no fake breakdown |
| Repairs and recovery | Accepted repair/recovery actually clears `status` | Existing CCC-ART-4 wrench repair effect plus noninteractive vehicle halo; emergency action/discard cost remains |
| Power-card activation | Upgrade installed in public `upgrades` | Illustrated power-star badge with actual card name; free replacement draws still count as activation |
| Legendary activation | Unique `retiredLegendaries` roster genuinely changes | Distinct violet legendary star, actual power title, and any verified extra result (repair, shields, risk hazard, +km) |
| 2,500-km checkpoint | `finishPending` becomes true after a car arrives | Finish-line marker announces completion of the **current turn cycle**, not premature results |
| Stage or championship finish | Authoritative `results` gains a new standings result and phase becomes `between` or `finished` | Road-atlas gold finish banner and brief confetti; actual `winners` receive correct name/2,500 banked text |

Stage and championship leaders remain determined by the engine's original completed-turn tie-breakers. An effect never modifies or accelerates a game turn. The old five-minute-afterglow repair model was not introduced: visual event objects are consumed after one page render, so page refreshes triggered by unrelated account/settings updates cannot replay a previous turn.

## Road movement, accessibility and information security

The **native SVG** layer remains the identical approved CCC-3 path coordinates, named stops and coloured, numbered vehicle tokens. `core/chaos-motion.js` reads `chaosRoutePosition(region,km)`, takes up to **28 road interpolation segments**, and uses SVG `animateTransform` `translate` and `rotate` on only the already-rendered vehicle nodes. The final SVG car transform is already the **authoritative post-move location**, so animations never leave the piece stranded if the browser omits SMIL support.

The app performs playback only after rendering a successful game state and skips it when the user's display setting is `motion:reduce` or the OS requests `prefers-reduced-motion: reduce`. CSS animations for public hazard/power ribbons, auras and confetti also stop in both reduced-motion modes; forced-colours replaces decoration with legible system-colour borders and text. There are no timers, custom media downloads or external animation scripts. The result announcement stays readable without movement, and all badges preserve semantic text and `role="status"`. Decorative spark and aura SVGs use `pointer-events="none"` and `aria-hidden="true"`.

The event payload records only public status changes, played card names and game-kilometre values; **no unrevealed hand contents** are rendered. All text that may contain user names or card text is HTML-escaped. Existing private reveal/handoff guards stay in place. A new game, stage, route change or failed action cancels transient motion and effect events. Any animation is bound to one local tab only.

## Repository contents and qualification

- `bong-goggles/web/core/chaos-game-effects.js`: immutable accepted-event interpreter, public notices and finish celebration markup.
- `bong-goggles/web/core/chaos-motion.js`: SVG road interpolation, rotation and motion opt-out; no game-state writes.
- `bong-goggles/web/core/chaos-board.js`: 2–4 public per-vehicle effect auras behind live car and town markers.
- `bong-goggles/web/core/classics-ui.js`, `core/app-shell.js` and `app.js`: pass only current render's event; consume it after rendering; preserve hand privacy and clear it on failure/handoff/route changes.
- `bong-goggles/web/ccc-tabletop.css`: original vintage road-ribbon, caution/legendary badges, glow and confetti with reduced-motion and high-contrast alternatives.
- `bong-goggles/web/scripts/qualify-web.mjs`: validate the twelve-effect catalog, local SVG/source-only dependencies, reduced-motion protections and increased **base-only static allowance** from `1057*1024` to `1077*1024` (**+20 KiB**). All previous 49-card **4 MiB**, 6-map **780 KiB**, 6-vehicle **16 KiB**, per-JS/CSS limits and exact source SHA allowlists remain unchanged.
- `bong-goggles/web/test/ccc-art-6-game-effects.test.js`: focused before/after actual-engine tests for all types above, free drawn power with replacement, legendary allocation, checkpoint-versus-results distinction, SVG route sampling/heading/lanes and immediate reduced-motion opt-out; public handoff privacy, accessibility, CSS and build gates.
- Existing CCC-ART-4 and ART-5 budget-limit tests updated to check the new **explicit numeric upper bound**, never removed or skipped.

**Exit:** exact PR-head web tests and production asset/accessibility gates, account-social regression and repository documentation qualification pass; direct GitHub file verification and recorded PR evidence. **Merge and deployment are separate user-authorized actions.**

**Next canonical milestone:** CCC-ART-7, if present in the authoritative art roadmap. Its scope is not invented by CCC-ART-6.
