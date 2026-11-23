# BC-2.1 — Labyrinth Cribbage: locked rules and variant specification

**Rules identity:** `bc-labyrinth-cribbage-241@1.0.0`  
**Game ID:** `labyrinth-cribbage` (legacy `russian-cribbage` room links remain compatible; distinct from standard `cribbage`)  
**Authority:** Player-approved BongGoggles house rules, 22 November 2026. These player-approved BongGoggles house rules define Labyrinth Cribbage; no universal cribbage standard is claimed.  
**Machine manifest:** `BC-2-1-LABYRINTH-CRIBBAGE-VARIANTS.json` (SHA-256 must be pinned by the eventual server adapter).  
**Compatibility:** Existing `RUSSIAN_CRIBBAGE` protocol enum and `russian-cribbage-standard` legacy engine hashes remain unchanged.  
**Release boundary:** BC-2.1 specifies the rules; server-authoritative matches, AI, browser UI and production rollout require subsequent BC-2 implementation/qualification gates. A registry entry or this manifest alone MUST NOT enable Play.

## Game and objective

Use one shuffled standard 52-card deck, no jokers; Aces low, J/Q/K count 10 when making fifteen or pegging. Win by being the **first player or partnership to reach or exceed 241 points**. An award can win immediately during heels, pegging or hand/crib counting. Stop at the winning award, do not award further points, finish a round, count another hand or declare a tie. Scores are individual for 2 and 3 players, or four-player free-for-all. Opposite-seat partners (seats 0+2 and seats 1+3) use **one shared team score** in four-player partnerships.

## 241-point pegboard

The playing board must track **240 scoring pegholes per active run**, plus the **241st winning hole** and parked starting pegs at zero. A match must never reuse the 121-point board's position/finish calculation. A four-player partnership game uses two shared scores; four-player free-for-all must display four **independent** scores, even where the approved physical board artwork provides only two parallel runs (supplementary virtual indicators may be needed). The physical labyrinth design and its peghole geometry must be qualified separately before launch, without invented holes or substituted artwork.

## Deal, crib and four-player options

| Players | Format | Initial deal per seat | Discards per seat | Directly dealt to crib | Retained per seat | Crib before starter |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 2 | Individual | 9 | 3 | 0 | 6 | 6 |
| 3 | Individual | 8 | 2 | 0 | 6 | 6 |
| 4 | **Partnerships (default)** | 7 | 1 | 2 | 6 | 6 |
| 4 | Individual free-for-all | 7 | 1 | 2 | 6 | 6 |

The host chooses 2, 3, or 4 seats before the deal. At four seats, show `Partnerships` preselected and `Individual` as the other choice; the chosen variant is persisted immutably with the session's version and hash. For partnership play, seat partners opposite one another; any award to either partner goes to the common score. In individual play, four players score independently. The dealer always owns the crib, so crib awards go to the dealer's **team** in partnerships. Deal one card at a time clockwise, starting to the dealer's left. At four players, deal the **two extra face-down crib cards directly from the deck** after the seven-card player deal; these are not assigned to any hand. All players privately select precisely the required number of discards, face down; discard completion leaves six per player and six in the crib. The public starter is cut **after all discards** are complete; do not expose it early. The starter is not played during pegging but is the seventh scoring card for every shown hand and the crib. Select first dealer by lowest cut rank, recutting any tied lowest ranks; rotate dealer clockwise each round. Never recycle discarded cards during a round.

## Pegging: ordinary cribbage rules

Beginning left of the dealer, each seat plays one retained card face up in clockwise order when permitted, adding its pip value to the sequence without exceeding 31. The six-card hand is pegged in full. An Ace is 1, 2 through 10 are face value, J/Q/K are 10. Every valid immediate award is credited **in order**: total exactly 15 = 2; exactly 31 = 2; matching last 2 ranks = 2, last 3 = 6, last 4 = 12; a longest qualifying consecutive-rank suffix of 3 or more earns its length, even if played out of rank order. Duplicate ranks invalidate that particular suffix, but a shorter suffix can still form a run. Different qualifying categories may award together.

If the active player cannot lay a card without passing 31, they must call Go; they may not call Go while a legal card exists. Pass them for the rest of that count sequence. Other players may still play. When no eligible player can continue, award **one** Go point to the player who last *laid a card* (not to the caller of Go), unless that last play made exactly 31 and already received its 2 points; reset the count and Go flags. Lead the next sequence with the next clockwise player with unplayed cards after that last player. When all hands are exhausted, give the last-card player one point if the last play did **not** make 31, then score the show; never double-award a Go and last-card point on the same final sequence. A play to 31 resets immediately with no extra Go/last-card point. If the final player on 31 ends all pegging, proceed to show.

## Seven-card show and counting

Show each of the six retained cards together with the same public starter (seven total). Score all combinations of **two or more** distinct cards whose pip total is exactly 15 for 2 points each. Score every distinct equal-rank pair for 2 points (three equal = 6, four = 12). Find the **longest possible run length** among seven-card subsets: each distinct subset of that *maximum* length which is a consecutive set of ranks earns one point per card. Repeated ranks multiply runs through distinct card subsets. Do not add shorter runs once longer ones exist. Aces are low only (Q-K-A is not a run). A Jack among the six kept cards matching the starter's suit earns one point for nobs. A starter Jack awards the dealer two points immediately for heels, before pegging, and can end the game.

**Approved flush rule:**
- **Non-crib hand:** Six matching-suit retained cards = **6 points**. If the starter is also of that suit, the flush is **7 points**. Five matching cards do not score a flush.
- **Crib:** All six crib cards **and** the starter must share the same suit to award **7 points**. Six matching crib cards with a nonmatching starter score **0 flush points**.
- A hand's flush, fifteens, pairs, runs and nobs are cumulative. There is no maximum 29-point limit: a seven-card count can exceed the ordinary five-card hand maximum. Test exhaustive subsets, not standard cribbage's hardcoded five-card combinator.

After every pegging card has been played, score hands **clockwise from dealer's left**, counting the dealer's hand last, followed by the dealer's six-card crib. Show the crib only when legitimately counted; don't leak hidden opponent hands or hidden crib cards before show. A zero-point hand is counted but does not advance the pegs. If any point award reaches 241, stop counting immediately.

## Loss classification and display

Automatic counting is mandatory; manual Muggins is **off** in v1. When the winner reaches 241 by normal play, losing players/teams are classified by their scores at that instant: **double skunk at 120 or fewer**, **skunk at 121–180**, **ordinary loss at 181–240**. Classification is for result display and does not change pegged points. Timed-out, resigned or cancelled matches carry explicit forfeit outcomes and no skunk classification. Optional regional scoring changes, different target scores, alternative pegging targets, automatic 31 bonuses, no-cut rounds and manual Muggins are not selectable in this ruleset.

## Exceptional situations, security and test contract

1. Validate every complete deck as a unique permutation of 0–51; never deal duplicate cards, allow too many discards, expose an undealt crib card, or accept an off-turn card. Required dealt/crib/starter total is at most 52 in every format.
2. A seven-card show must correctly count overlapping fifteens, many simultaneous runs, same-rank multiplicities, Jack starter/heels, nobs, and the **six/seven-card flush threshold**. Nonmatching crib starter never produces flush points.
3. The legal move validator enforces 31, Go, replay/duplicate suppression, dealer rotation and immediate victory during any award including a starter Jack.
4. The ruleset ID, version, manifest SHA and the precise variant ID must be retained in the authoritative match journal and checked during reconnect, restart, replay, invitations and rematches; **never** reinterpret a 121-point match as a 241-point one or vice versa.
5. The 2/3/4-player modes must run with humans, bots at Easy/Medium/Hard, and mixed seats only after dedicated BC-2 server/AI qualification. No bot is allowed to see private opponent hands or the face-down crib; no browser may authoritatively calculate scores or reveal secret state.
6. Enforce opposite-seat shared scoring only for the partnership choice; free-for-all has four independent scores. Default is partnerships, including in solo practice setups with four seats. Reconnect restores the exact chosen format.
7. No pay, wallet, wager or token reward integration: this is an off-chain account game. Do not enable a live Play button until the entire BC-2 game release gate passes independently of BC-1.

## Acceptance examples

- Two-player: deal `9 + 9`, each discards 3, six-card crib; each counts six retained cards plus starter.
- Three-player: deal `8 + 8 + 8`, each discards 2, six-card crib.
- Four-player in **either** format: deal `7 × 4`, each discards 1, add 2 directly dealt crib cards, giving six in crib; four individual scores or two opposite-seat shared scores.
- Six hearts in a non-crib hand and a **spade starter** score 6 flush points; a heart starter scores 7. Six hearts in a crib and a spade starter score 0; a heart starter scores 7.
- Five hearts among six retained cards score **no flush**.
- Counting a winning 241st point as heels, pegging or a show ends the match at that specific award before remaining events.
- All permutations and subsets used in scoring are deterministic and reproducible across server restarts.
