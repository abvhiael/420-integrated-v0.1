# Cross-Country Chaos — CCC-1 frozen local rules (v2.5)

Status: **implementation rules baseline**. This document defines the browser-only Canadian Classics rules engine. It does not authorize wager games, online player sessions, Wallet permissions, payments or blockchain activity.

## Championship

- 2–4 local human-controlled seats, three regional stages: The Down East Disaster (St. John's → Montréal), The Never-Ending Ontario (Montréal → Kenora), and Prairie Madness & Mountain Mayhem (Kenora → Vancouver).
- **Every stage is 2,500 game kilometres**, regardless of real geographic road distances.
- The stage's starting seat rotates by one for fairness. Each driver receives one opening turn in that stage with the seven cards dealt to them.
- After any player achieves 2,500 effective km, latch the final round: finish the current complete seat cycle. Do not untrigger the finish even if a later detour lowers the first finisher's mileage. All card effects and final discards must resolve.
- At the stage finish, rank by effective km, then raw played mileage. The stage winner banks exactly **2,500 championship km**; each other driver banks their own final effective km capped at 2,500 (nobody can bank more than the winner). Exact ties on both effective and raw km are shared stage victories and each tied winner banks 2,500.
- Championship score is the **sum of banked km** after three stages, not placement points. Tie-breakers: stage wins, then Western-stage banked kilometres, then joint champions.
- Stage transition discards hands, draw/discard/spent piles, current mileage, detour/slowdown penalties, active hazards, installed upgrades and remaining shields. **Only scores, stage wins, previous stage results and permanently retired legendary identities persist.**

## Inventory and regional deck isolation

Each stage uses exactly **one face-down regional draw deck** plus one face-up discard pile. There are no separate mileage, hazard or power draw decks.

Each deck has these standard cards:

| Type | Copies per regional stage |
| --- | ---: |
| Mileage 100 km | 30 |
| Mileage 150 km | 26 |
| Mileage 200 km | 22 |
| Mileage 250 km | 18 |
| Mileage 300 km | 14 |
| Mileage 400 km | 10 |
| Mileage 500 km | 6 |
| Eight named regional hazards | 9 each = 72 |
| Six common fixes | 12 each = 72 |
| Eight unique upgrades | 1 each = 8 |
| **Standard deck** | **278** |

Exactly **four different legendary cards exist across the entire championship**, not four in each regional deck. Randomly assign one to each stage and the fourth to one of the three stages before shuffling. Therefore decks contain 279, 279 and 280 cards (random stage order). No initial upgrade or legendary entitlement is dealt separately. All cards enter only via ordinary seven-card opening deals and subsequent regional-deck draws. A played legendary is retired permanently; unused ones expire at their stage boundary and are never inserted into another stage's deck.

The stock is deterministically shuffled from a validated seed; each physical card has a unique instance ID. When the stock empties, reshuffle eligible discards **except the top face-up discard**. Already played mileage, attacks, fixes, installed upgrades and activated legendary cards never reenter the regional deck.

## Turn phases

1. **Opening turn for each seat:** their seven dealt cards are already ready, so no additional draw.
2. **Subsequent turn draw:** from their five retained cards, choose (a) two blind cards from the regional deck, or (b) the top face-up discard and one blind card. If the stock is truly exhausted, fewer than two may be available; never invent cards. The hand cannot exceed seven.
3. **Optional just-drawn power activation:** newly drawn upgrade/legendary cards (including the selected top discard) may be activated immediately for free; draw one replacement from the same stock. If the replacement is another power, the chain can continue. A power saved for a later turn costs the normal action. The seven-card opening deal counts as a draw for immediate power activation on that player's first turn; unused opening powers become saved cards and cost a normal action on a later turn.
4. **One normal play:** drive one mileage card, attack another seat with one hazard, clear an eligible active hazard with one matching common fix, take the 150 km **Local Knows a Shortcut** action, play one saved power, or spend the action clearing an ongoing hazard.
5. **Discard:** normally discard one hand card face-up. A pass or a no-card recovery requires discarding two cards. The normal end-of-turn hand size is five, barring genuine draw-pile exhaustion. The next driver's hand remains private.

A free power activation never replaces the mandatory normal play/discard. Card selection, player turn and phase are validated before any state transition; failed moves must leave the supplied state unchanged.

## Mileage, hazards, repairs and power

- Display played mileage face-up, sorted highest denomination first. `effectiveKm = max(0, rawPlayedKm + bonusKm - slowdownLoss - detourLoss)`.
- Playing a 400 or 500 km mileage card invokes **one random regional hazard against the driver** after mileage and any optional once-per-stage Shortcut Specialist bonus have been applied. If an ongoing hazard already exists, random hazard selection is limited to eligible immediate detours.
- **Breakdown**: prevents playing mileage until cleared. **Slowdown**: reduces the next mileage play by up to its printed amount, then expires; a suitable repair may clear it before driving. Only one ongoing breakdown/slowdown per vehicle; a second ongoing hazard cannot stack.
- **Detour**: immediately and permanently reduces effective progress by its printed amount, bounded by current progress (no negative future debt). Record the loss for the entire stage; multiple detours may apply, including to an already blocked vehicle. There is **no detour recovery** by a common repair.
- Fixes are only played on the **owner's turn**, never reactively: Emergency Repair Kit (mechanical), Clear Skies & Plows (weather), Emergency Jerry Can (fuel), Alternate Route (road), Roadside Assistance (any ongoing hazard). **Local Knows a Shortcut** is a separate normal action for +150 safe kilometres even while blocked; it does not restore detour losses. Manual emergency recovery clears one active hazard but consumes the whole normal action.
- Upgrades are installed as separate displayed equipment, each usable once and removed at the next stage. Duct Tape blocks a mechanical hazard, Dad's Road Atlas navigation, Winter Tires weather, Jerry Can fuel, CB Radio road, and Bottomless Thermos any hazard. The Station Wagon automatically clears one mechanical breakdown **at the beginning of its owner's turn**. Shortcut Specialist adds +100 km once to a normal mileage play. A duplicate already installed upgrade cannot be activated again.
- The four unique legendary powers are: Truck (clear own ongoing hazard and +100 km), Rodeo (two automatic hazard shields), Shortcut (+300 km and self hazard roll), Sunshine (clear all current weather hazards and +100 km). Legendary shields expire at stage end. Protective upgrades and shields activate automatically against eligible incoming attacks; these are not out-of-turn repair-card plays.
- Power effects and newly crossed finish thresholds resolve before the subsequent discard phase.

## Board and consumer boundary

The current local renderer must show exact 2,500 km stage targets and **championship kilometres**, never the obsolete 5/3/2/1 placement points. A player's hand is revealed only at their private pass-and-play turn. The game controller must expose explicit draw choice, action, and discard controls, including hand power cards. User-selected names remain escaped. Uploaded card-art mappings and the existing unauthenticated local Canadian Classics route remain unchanged.

**CCC-1 exit conditions:** deterministic legal state transitions, deck/card counts, all three stage boundaries, exact score tally, power/legendary uniqueness, permanent detour tracking, non-reactive repair, privacy-safe UI/controls, and targeted local test qualification. Illustrative regional maps, vehicle art, computer opponents and unrelated online/canonical games are subsequent roadmap steps, not CCC-1 execution.
