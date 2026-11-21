# CCC-ART-4 — Illustrated tabletop graphics and repair feedback

**Scope:** finished play-surface treatment for the existing **local 2–4 player** Cross-Country Chaos Canadian road-trip card game. This is visual presentation only; it does not change any rules or state inside `core/cross-country-chaos.js`.

## Working tabletop

CCC-ART-4 takes the already-qualified CCC-3 public player mats and CCC-ART-1 vintage Canadian atlas direction into a physical-feeling card table. Graphics are **first-party CSS textures and small, original inline SVG detail**, using the 49 previously approved card illustrations as the **only** illustrations of card faces. No new external images, fonts, web requests or SVG files are published.

The live regions, artwork and rules from CCC-1 through CCC-ART-3 are preserved. The new `bong-goggles/web/ccc-tabletop.css` is an explicitly published, standalone stylesheet; the formerly qualified `classics.css` is unchanged and remains below its 35,000-byte regression limit. Every new rule is scoped under `.ccc-wrap--roadtrip`.

| Graphic area | Finished presentation | Authoritative source of its state |
| --- | --- | --- |
| Draw pile | Vintage face-down deck with layered edges, letterpress CCC badge, card count | `game.deck.length` |
| Discard pile | Face-up, approved card illustration on a slightly rotated card-paper stack with actual card count | `game.discard.at(-1)` |
| Recently played tray | Low-contrast inset felt tray, illustrated repair/hazard/power cards, five most recent | `game.spent.slice(-5)` |
| Player mats | 2–4 sewn-felt/oak-trim layouts with seat-colour chip and current mileage | `game.players` |
| Mileage stacks | Offset cream-card layers, sorted from largest denomination downward, exact multiplicities | `player.played` |
| Road-condition slot | Enamel roadwork hazard slot, approved active hazard picture and STOP/SLOW category, or a stamped clear-road state | `player.status` |
| Vehicle equipment | Dedicated dashed-border rack of equipped upgrade cards with accurate READY/USED stamps | `player.upgrades`, `player.used` |
| Legendary defenses | Caution-gold shield emblem and readable remaining shield count | `player.shield` |

**Interactive pile surfaces:** the face-down pile is a real **Draw two** button only when the current player has revealed their hand and `game.step==='draw'`. The face-up top discard is a real **Take discard and draw one** button only when it exists and that same draw permission applies. Existing accessible buttons beneath the board are retained; both control paths call the previously qualified `data-chaos-action="draw"` and `takeChaosTurn` engine. During a private handoff, other phases, or an empty discard, both stacks render as public non-interactive card illustrations. No draws can be initiated using the unrevealed board.

## Genuine repair feedback (not rules authority)

`core/chaos-table-art.js` exports `deriveChaosTableFeedback(before,after,move)`. It compares **the previously qualified before/after engine objects** only *after* a successful action. It never updates the game, card roster, scores, statuses, or player actions. A temporary `chaosRepairCue` stays in the application UI state and is forwarded through the existing route rendering boundary; it is **not** persisted in game state or sent to social services.

The animation shows on the affected player's public mat and consists of a roadside-work token, small sparks, an illustrated inline wrench graphic, and fully legible status text. It is triggered by:

- Valid common repair cards when an ongoing hazard actually clears.
- Emergency recovery after spending the normal action, including the proper two-discard penalty.
- The navigation `Local Knows a Shortcut` fix as its own **+150 km shortcut** cue; it never claims to erase permanent detours or existing unrelated hazards.
- The `A Guy I Know Has a Truck` legendary power when it clears the active hazard, and the `Would You Look at That!` weather-clearing power on precisely the affected driver seats.
- The automatic `Indestructible Station Wagon` mechanical repair at the beginning of its owner's turn.

Only a successfully accepted move can create the presentation cue. Failed actions, unrelated pass/drive/draw moves, and non-clearing events do not create fake repair successes. Handoff reveal, next stage, new championship, route changes and failed moves clear the ephemeral cue so old events cannot replay on unrelated screens. Card names and cue text are HTML-escaped; opponents' concealed hands remain absent from public markup.

## Accessibility, textures and publication

- Scenery uses a low-contrast felt weave and oak edge. Major data remain text, not art-only. Decorative paper edges and overlays do not obstruct action controls.
- All clickable piles have a native `button`, specific accessible names, keyboard focus, and a visible pointer/focus state; static versions are plain non-interactive containers.
- Repair notification uses `role="status"`, `aria-live="polite"`, and truthful text. Animations are CSS-only, do not use timers, and are **disabled entirely by `prefers-reduced-motion: reduce`**. High-contrast/forced-colours styles substitute real system colours, borders and transparent alternatives.
- Responsive card trays and mats preserve narrow screens and 2–4 seated players, keeping the live SVG road, existing 960×415 geometry and 2,500-km rule untouched.
- `scripts/build.mjs` explicitly copies `ccc-tabletop.css` to the public static bundle; `index.html` loads it from the same origin; the unchanged asset allowlist rejects any unexpected art files.
- The base-only static asset cap increases by **16 KiB** from `1032*1024` to `1048*1024`, covering the new UI module, board mark-up, and isolated table stylesheet. The previously qualified **49-card, six regional-map, six vehicle-token and per-file JS/CSS limits remain unchanged**. The production qualification checks the published stylesheet, its reduced-motion and forced-colours fallbacks and lack of remote imports.

## Qualification

`test/ccc-art-4-tabletop.test.js` tests the graphics/public-only privacy boundary, legal draw options, empty discard behavior, 2–4 player boards, mileage grouping, regional hazard slots, all eight power cards, true common repairs, shortcut versus repair distinction, emergency recovery, weather/legendary and automatic vehicle repairs, escaped cue text, CSS accessibility and final asset publishing contract.

Existing CCC-1/2/3/ART-1/2/3 tests and latest account-social build configuration remain authoritative. Exact-head CI and recorded PR evidence are required before marking CCC-ART-4 qualified. **No merge or deployment is included.**

**Next canonical milestone:** CCC-ART-5, detailed scope subject to the authoritative art-roadmap entry; no unapproved new features are added here.
