# CCC-5 — Championship lifecycle and verification

**Milestone:** Cross Country Chaos regional final rounds, stage scoring, stage transitions, cumulative standings, tie-breaks and championship victory. This task completes and strengthens the existing **CCC-1 frozen rules** and **CCC-ART-7 result presentation** rather than introducing a second results ledger or replacing approved artwork.

## Frozen authority

`bong-goggles/web/core/cross-country-chaos.js` is the only source of truth. Three 2,500 game-kilometre regional stages proceed in order from St. John's through Montréal and Kenora to Vancouver. Individual mileage is the clamped sum of played mileage plus bonuses, minus slowdown and permanent detour losses. Once a driver reaches **2,500 effective km**, the remaining driver's actions/discards in the current complete starting-seat cycle must resolve before scoring. The final-round latch is irreversible, even if a subsequent sabotage or immediate self-risk detour drops the first finisher below 2,500.

The CCC-5 repair makes the threshold latch **immediately when a risky 400/500 km drive or legendary Shortcut awards distance, before the action's mandatory random regional hazard resolves**. This prevents a self-detour from retracting a finish already reached. It does not suppress the hazard; its losses still apply to final regional standings. All ordinary repair, upgrade, speed risk and draw/discard rules remain frozen.

The public read-only `chaosFinalRoundProgress(s)` projects the number of driver turns still to resolve (including the current driver), following the canonical rotating `roundStart` seat. The UI displays an accessible final-round countdown on the public highway board without exposing any private hand.

## Banked scoring and regional resets

On each stage finish, standings are ordered by **effective km descending**, then **raw mileage descending**, with true equal-effective/equal-raw ties sharing the recorded stage victory. Every stage winner banks exactly **2,500 championship km**, even if that driver's final effective km dropped below the finish line after latching. All others bank at most 2,500 effective km. No placement points are awarded. `results[].standings[].banked` and each driver's `score` are the same underlying engine awards, never recomputed by the UI.

The explicit Continue control calls the existing `advanceChaosLeg` only in the `between` phase. It rotates the stage's opening driver and resets hands/deck/discard/spent piles, fresh powers, played mileage, bonuses, slow/detour losses, statuses, installed/used upgrades and shields. Player identity, selected vehicle, human/computer controller and difficulty, cumulative banked scores, stage wins, permanent legendary retirements, and past results persist as already qualified. Each new regional stage gets its own fresh physically allocated regional deck. The final stage transitions only to `finished`; no stage 4 is possible.

## Standings and championship victory screen

The existing CCC-ART-7 regional result screen displays winner graphics, individual stage scoreboard and historical records. CCC-5 adds **provisional cumulative standings after stages one and two**, with banked championship kilometre totals and stage wins. These use the already authoritative `chaosLeaders` order and are explicitly labeled provisional, with no premature championship award. The public screen remains read-only and excludes player hands and future stock.

At the end of the West region, CCC-ART-7's existing podium and final scoreboard remain the victory surface. The final champion is decided by **(1) cumulative banked championship km, (2) number of regional wins, (3) Western-stage banked km**. If all three factors tie, the result is **joint grand champions**; array/seat order is merely stable display order, not an extra tie-break. All four positions remain visible in the table, with no cash, on-chain reward or wallet implication.

## Qualification and exit

`test/ccc-5-championship.test.js` exercises actual engine finish thresholds on risky self-detours and legendary shortcuts, later rival detours below the goal, final-round turn countdown for four-player and rotated first-player cycles, all three stages with exact banked score reconciliation and all reset fields, human/computer seat preservation, immutable historical standings, provisional ranking, final mileage/win/Western tie-break precedence, joint champions, and private-hand/name escaping. Previously passed CCC-1–4, CCC-ART-1–8 and public feed assertions remain in force.

The existing `scripts/qualify-web.mjs` gains a narrow source-integrity check requiring the finish latch, countdown and provisional presentation. **No change** to the frozen card/map/vehicle inventory, image manifest, branding, individual file limits or baseline byte budgets. No network, SSO, Wallet, online session, gambling or crypto dependency.

Exact PR-head qualification: Bong Goggles Web Verification including both production builds and BG-19.13 asset/privacy/accessibility checks; 420Docs Qualification and wallet-independent social regression if triggered. Source implementation and GitHub CI do not prove a live Cloudflare deployment or physical device acceptance.

**Status and next milestone:** Complete only after actual exact-head CI evidence is recorded. Do not infer, define or begin a CCC-6 phase without a canonical assignment. Merge only after a separate explicit user request.
