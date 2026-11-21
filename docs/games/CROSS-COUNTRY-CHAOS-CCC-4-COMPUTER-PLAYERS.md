# CCC-4 — Local computer opponents (Easy, Normal and Hard)

**Implementation:** local, human-versus-computer Cross Country Chaos with 2–4 total drivers, at least one human, and individually selected Easy / Normal / Hard computer seats. The existing human-only pass-and-play choice remains the default. No account, Wallet, wager, network play or server service is required.

## Rules and privacy boundary

The frozen CCC-1/CCC-2 engine at `core/cross-country-chaos.js` remains the **only** game authority for 2,500 km regional stage targets, legal move options, seven-card draw rules, hazard/repair behavior, upgrades, four unique legendaries, regional resets, and banked championship kilometres. CCC-4 does not change that engine, the randomized regional stock, card inventories, public board mileage geometry, results, approved card images, or any prior CCC-ART-1–8 assets.

`core/chaos-computer.js` accepts and validates a seat-controller roster at game start, requiring exactly 2–4 controllers with at least one human. Computer identity and difficulty are cosmetic/local metadata stored on the corresponding player objects and carried by the engine's existing state cloning/round-transition behavior. There is **no arbitrary action execution**: the computer selects from `chaosActionOptions(s)`, passes only the selected legal action/index/target/draw choice (and, where qualified, the existing Shortcut Specialist `useBoost` flag) to `takeChaosTurn`, and relies on all its original validations.

**Information boundary:** the computer decision function reads only its **own** hand and public current player status, opponents' publicly visible mileage, score, hazards, equipment and shields, current stage/turn count, and the **public** top discard. It never reads `game.deck`, RNG seed, another driver's hand, future cards, or unrevealed stock state. Easy's deterministic choice variation is mixed from public stage/turn/seat information, never the actual stock shuffle seed; changing the hidden deck or rivals' hands does not change its choice. The controller's own action still triggers the authoritative engine's ordinary deck draw and occasional random self-hazard, exactly as for a human.

## Opponent behavior

- **Easy:** deliberately imperfect, deterministically varied legal actions and discards; may miss opportunities. Does not get hidden information.
- **Normal:** scores currently legal drives, risky 400/500 km choices, matching repairs, shortcuts, basic power installations, public attacks, and retains useful cards when discarding. Selects a public top-discard draw when more useful than an ordinary blind draw.
- **Hard:** stronger risk-adjusted drive choices, immediate finish priority, tactical damage to threatening stage leaders, avoidance of already protected targets, early equipment/legendary use, emergency breakdown repairs, tailored discard retention, and timing of the once-per-stage Shortcut Specialist bonus. It remains constrained to the same legal options and hidden-information boundary, not an omniscient solver.

Both strategic difficulties respect free just-drawn power activations, draw-to-seven and mandatory discard phases, and automatic end-of-round rules. All decisions are read-only until passed to the frozen engine.

## Interactive game and turn progression

- `core/classics-ui.js`: adds a labeled controller selector (Human, Easy, Normal, Hard) for each configured seat, keeping the six existing vehicle choices. Every displayed driver is identified as human or computer. On a computer turn, the board still displays **public** cards/vehicles/road progress, but hand-reveal and human draw/drive/hazard/repair/discard forms are **absent**, even when a renderer receives a stale `revealed=true`. A keyboard-accessible retry control appears only if automatic play fails.
- `app.js`: validates and stores seat controllers at game start, schedules locally bounded, cancellable-by-route computer batches after state rendering, and hands play back to the human with their private hand concealed. A computer batch never acts on a human turn or skips an inter-stage results page. No manual human action is allowed on a computer seat. New game / region transitions and route changes preserve existing UI/animation cleanup semantics. Each executed action goes through `takeChaosTurn`; terminal changes may still derive a single cosmetic effect from the last accepted action.
- `ccc-tabletop.css`: locally scoped controller labels, visible computer-turn status, narrow-device scaling, keyboard focus, and forced-colours support. Original approved SVG highway/vehicles, PNG/WebP card exports, game effects and results remain unchanged.

## Qualification and exit criteria

`test/ccc-4-computer-players.test.js` validates controller rosters, difficulty choices, actual engine legality through draw/play/discard, deterministic Easy without hidden information, Hard repair/sabotage/finish/boost, Normal safe driving, no stock or opponent hand access (guarded proxies), bounded automatic multi-seat turns, staged persistence, human-turn handoff, public/private rendering and responsive/accessibility wiring. Previously qualified CCC-1–3 and ART-1–8 suites remain intact.

Bong Goggles static asset base allowance changes **only +16 KiB (1125 → 1141 KiB)** for local AI strategy/seat UI. Previously pinned 49 card WebP and PNG masters, six atlas layers, six vehicle images, source-manifest SHA, individual JS/CSS and other asset budgets are unchanged. Preserve exact PR-head GitHub Actions Web Verification, 420Docs, and wallet-independent Account Social evidence. Do not merge or deploy without explicit separate authorization.

**Next canonical step:** determine from authoritative roadmap/assignment; no unverified CCC-5 requirements are introduced or started here.
