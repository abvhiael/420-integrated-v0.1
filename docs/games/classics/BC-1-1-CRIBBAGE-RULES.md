# BC-1.1 — Cribbage rules and variant contract

**Status:** BC-1.1 specification only; no playable game, AI or production release is authorized.
**Canonical machine contract:** [BC-1-1-CRIBBAGE-VARIANTS.json](BC-1-1-CRIBBAGE-VARIANTS.json).
**New account-game ruleset:** bc-cribbage-standard-121@1.0.0, 2–4 seats, 121-point finish.
**Separate authority:** This is NOT the existing BG-15 wallet/on-chain CRIBBAGE game type, its cribbage-standard@1.0.0 descriptor, or a 420Bet / wagering session.

## 1. Sources, scope and rule selection

Primary reference: [American Cribbage Congress 2025 rulebook](https://www.cribbage.org/NewSite/rules/default.asp), [ACC terminology](https://www.cribbage.org/NewSite/tips/glossary.asp), and [Pagat six-card cribbage with 3- and 4-player forms](https://www.pagat.com/adders/crib6.html). Where traditions disagree, the choices **below** are the normative product behavior; do not silently infer house rules. Terminology: box = crib; cut card = starter = turn-up; dealer's left = next seat clockwise; show = counting of held hands and crib. These synonyms change no scoring.

One unbiased standard 52-card pack, no jokers, one card per rank and suit. Ace is low, including runs, and never wraps above King. Pip values A=1, 2–10 face value, J/Q/K=10, but the face ranks remain distinct for pairs and runs. The target is **at least 121**, not exactly 121. Auto-counting is authoritative. Two physical pegs per scoring track represent current/previous totals; game events retain original increments.

Every match durably pins the new off-chain ruleset ID, version, SHA-256 digest of the **raw UTF-8 bytes of the canonical JSON rules manifest**, variant ID, ordered seats/teams, target, initial dealer and server-protected shuffle seed/commitment. A client cannot alter these mid-match. A variant lookup is an explicit allowlist; a client-supplied rule hash, alternate team mapping, scoring switch or BG-15 legacy ID cannot override it.

| Locked variant | Seats / scoring tracks | Cards dealt | Crib contribution | Kept cards |
| --- | --- | --- | --- | --- |
| standard-2p (default) | 2 individuals; teams [0,1] | 6 each | 2 each | 4 each |
| standard-3p | 3 individuals; teams [0,1,2] | 5 each **plus 1 card privately dealt from the stock directly to crib** | 1 each | 4 each |
| standard-4p-partners | 4 players, 2 partnerships opposite one another; teams [0,1,0,1] | 5 each | 1 each | 4 each |

Every configuration produces **exactly four** private cards in the dealer's crib and four cards for each player to peg; starter is a fifth card **only for the show**. In four-handed play a partner's scores credit the same team, and the dealer's crib credits the dealer's team; there is NO four-player free-for-all in this version. Any seat may eventually be occupied by a qualified human or Easy/Medium/Hard bot; BC-1.1 does not implement or qualify bots.

## 2. First deal, deal rotation, crib and public starter

At match creation all seats cut a shuffled pack to choose the first dealer: **lowest rank deals**; those tied for the lowest must recut until a unique lowest is found. No suit-based tiebreak. Do not reuse those cut cards for the first deal: a fresh full shuffled deck starts the round. At each new round the deal rotates one **physical seat clockwise**, including both partnership members in four-handed play. The dealer deals cards one at a time, clockwise, beginning with the player to their left. The three-handed extra stock card is dealt directly and face down to crib; none of the three players can see it. Every seat selects exactly the required number of held cards and places the discards privately into the dealer's crib. The server validates ownership, unique card identities, count, action ordering and single submission. No hidden crib/deck content is sent to other seats, spectators, bots or public logs.

Only after all required discards are valid may the player at dealer's left cut the remaining stock, server-mediated, and expose exactly one **public** starter. It is not played during pegging. Every retained hand and the dealer's crib use this same fifth card when scored. If starter is **any Jack**, dealer (or dealer's partnership) scores **2 for heels immediately**, before anyone pegs. If this reaches 121, the game ends immediately and no pegging or show takes place. Starter-Jack cannot also award nobs for itself.

## 3. Pegging and Go / final card

Starting left of dealer, the seats take turns **clockwise** laying one retained card at a time, announcing a public running total of pip values. The count begins at 0 and cannot exceed 31. An active seat MUST play a legal held card if one fits. If none fits, declare **Go**; passing voluntarily when any card fits is illegal. A seat that said Go cannot re-enter the **same** count sequence. Seats with no remaining hand cards are skipped. The last player still able to lay may continue playing cards when their turn returns.

Award points instantly to the **player placing the scoring card**, credited to their team if partners:
- Exactly **15**, +2; exactly **31**, +2.
- The final 2/3/4 **adjacent plays** having identical **rank** (not just equal ten-point pip values), +2/+6/+12 respectively.
- The **longest contiguous suffix** (last consecutive plays without a rank duplicate) containing at least 3 ranks that form a consecutive run **in any order**, +1 per card in that suffix. The sequence is limited to cards played since the last count reset. No points for shorter run subsets when a longer terminal run exists. Ace-low only.
- Scores from different eligible categories on one play are additive. No pegging points for flush/nobs.

On **31 exactly**, award 2 and reset count and adjacent-play history to zero; no further Go/last-card point for that same sequence. When no seat with unplayed cards can place another card without exceeding 31, award **one Go point** to the seat who laid the **last** card in that sequence, and reset. On the **last card of the entire hand** (when 31 is not reached), give its player **one last-card point** and transition to show; do NOT duplicate a Go award. After each reset, the next clockwise seat **after the last player to lay a card** with remaining cards leads. A prior Go never gives a point to the passer. A seat that has run out of cards may have scored the prior sequence's last card.

All pegging awards have authoritative sequential order, score and win evaluation **immediately after each award**. At 121 or above stop without laying remaining cards or entering the show. An attempt to play beyond 31, play a missing/previously played card, declare Go while holding a playable card, act out of turn or replay a stale action is rejected with no new scoring or history.

## 4. The show: count order and exact categories

Only after all retained cards have been pegged **and** the game has not already ended: count individual retained four-card hands clockwise **starting left of dealer**, with dealer's hand **last**; count the dealer's four-card crib **after all hands**. In 2p this is nondealer, dealer, dealer crib. In 3p it is left of dealer, next clockwise, dealer, dealer crib. In 4p partners it is dealer-left, dealer's opposite-seat partner, dealer-right, dealer, dealer crib. Every score credits the relevant seat/team **as soon as that particular hand or crib is counted**. Stop on the first score event crossing the finish; do not score later hands or crib.

Consider the four actual hand/crib cards plus the single starter. Count every distinct physical-card combination, not simply rank combinations:

1. **Fifteens:** +2 for each subset of **two or more** cards totalling exactly 15 (subset may have 2, 3, 4 or 5 cards). A card may participate in multiple combinations.
2. **Pairs:** +2 for each distinct unordered pair of identical ranks. Triple = 3 pairs = **6**; quadruple = 6 pairs = **12**.
3. **Runs:** Find **the greatest possible** run length from 3 to 5 of consecutive distinct ranks in the five cards. Count each distinct way to choose that many physical cards, awarding its length each time. Do **not** count the embedded shorter runs. Duplicate ranks produce a double/triple/double-double run (example 2,2,3,4,4 yields four runs of three plus two pairs).
4. **Flush:** If all **four held cards** share a suit, a *hand* gets +4, plus +1 if starter matches. The *crib* only receives a flush if **all five** are the same suit, worth +5; four-card crib flush is **zero**.
5. **His nobs:** +1 if a held **Jack** has the starter's suit. Applies to a hand or crib. The starter does not count as a held Jack. This is independent of heels.

All applicable categories add together. Server computes and stores components and the award; client-declared totals, undercounts, overpegs, false claims, manual muggins and competing guesses are not authoritative. An automatic zero-point hand advances the show without moving a peg. Negative points are impossible. If an award would take a winner beyond 121, retain its real increment in the audit event and display the front peg at the 121 finish hole rather than off-board.

## 5. Victory, skunks and unusual outcomes

The **first seat or partnership to reach or exceed 121** on an individual score event wins instantly (heels, a pegging award, a hand or the crib). Serialization makes ties impossible, even if two sides could have scored in the same deal. Do not finish/show/score subsequent cards after a win. Three-player games have one winner and two independent losing seats; four-player games have one winning team and one losing team. Classify each defeated seat or team at the **instant of victory**:

| Losing score | Classification |
| --- | --- |
| 0–60 | Double skunk |
| 61–90 | Skunk |
| 91–120 | Ordinary loss |

These labels do **not** add peg points, multiply game wins, pay 420 tokens or imply any gambling/settlement. No game point penalty is assumed for an alternate tournament league format. Forfeits, resignation, timeout and cancellation use the existing authenticated account-games match result/reason (not fabricated scores or skunks): a forfeiture does **not** automatically peg a winner to 121. A disconnected seat resumes their existing protected authoritative state; there is never a fresh deal or opponent-hand reveal merely because a client reconnects. Bots must use only their own legal seat observations, not the server's shuffle/crib/other hands.

Strict server rejection with **no mutation**: invalid actor or team, out-of-turn card, Go with legal play, card value above 31, repeated/foreign card, duplicate/disputed discard, wrong rules ID/hash/version/phase, illegal 3p stock crib exposure, modified client score, or inconsistent deck/hand/journal. An identical idempotent request returns its stored receipt; same id and different payload fails. BC-0.6/0.7/0.10/0.11 locking, replay, sequence validation, timeouts and event privacy remain authoritative. A corrupted deck, snapshot or journal fails closed pending verified replay from the seed and accepted actions, never a speculative card substitution. All cards must reach the show only once, and no new round can begin after match finish. Neither anonymous/public guest views nor unrelated account sessions can discover private hand, crib or undealt cards.

## 6. Canonical scoring/exception fixtures for BC-1.2 engine

Suit codes C/D/H/S are clubs/diamonds/hearts/spades. Hand is four retained cards; starter is the cut card. Points shown are **component** totals, with any other categories counted independently unless the total is explicitly stated.

| Scenario | Hand | Starter | Expected |
| --- | --- | --- | --- |
| Perfect 29 | 5C 5D 5H JS | 5S | 16 from fifteen subsets + 12 pairs + 1 nobs = **29** |
| Double run | 3C 4D 4S 5H | 9C | 2 three-runs (6) + one pair (2) = **8** |
| Double-double run | 2C 2D 3H 4S | 4C | 4 three-runs (12) + two pairs (4) + one fifteen (2) = **18** |
| Zero, not an actual 19 | AC 3D 7H 9S | KC | **0** |
| Four-flush in hand | 2H 4H 6H 8H | KC | flush **4** |
| Same cards in crib | 2H 4H 6H 8H | KC | flush **0** |
| Five-flush in crib | 2H 4H 6H 8H | 9H | flush **5** |
| Nobs | JS 2C 4D 8H | 9S | nobs **1** |
| Heels | any eligible round | JS | dealer +2 **before** first pegging play |

Pegging: 5H then TD makes 15 (+2); 4C/4D makes a pair (+2); 3C/3D/3H makes three-of-a-kind (+6); 6C/6D/6H/6S makes four-of-a-kind (+12); 3C/5D/4H makes a run (+3); 4C/6D/5H/7S a run (+4); TC/TD/TS/AC yields 31 (+2 **but no additional Go**). Card played last below 31 yields exactly +1, not Go plus last card. The three- and four-player variants award Go once when **all others** with cards cannot play, not once per passer. Reset loses pair/run history. A score of 120 followed by a 2-point award wins immediately; 3p and 4p count order cannot award dealer crib after an earlier player pegs out. For skunks test losing scores at 60/61/90/91, and heels winning at 119/120 so no pegging starts.

## 7. Regional and house variants (explicitly unsupported, not guessed)

Standard North American/Canadian **2p**, **3p free-for-all** and **4p opposite-seat partnerships** are the available configurations; only dealing/team ownership differs. Labels such as box/crib, his heels/nibs and his nobs do not change gameplay. The 1.0.0 selector rejects rather than imitates: manual muggins claims, 61-point game, five-card cribbage, 4p individual/cutthroat, six-handed partnerships, no-cut, alternative skunk game-point weighting, and **Russian Cribbage** (separate BC-2 with its own still-unapproved rules). If these are requested later they require a separately identified source, approval for contested regional details, version/hash and scoring examples; no mid-match variant toggle is allowed.

**Exit / handoff:** This rules document and its checked machine manifest lock BC-1.1 only. BC-1.2 must implement/validate the deterministic real shuffle/deal, legal moves, scoring, 2/3/4-seat turn and reveal authority, immutable replay and the above edge fixtures. The public Classics game remains marked **unreleased/registry only**, with no activated Play, AI, live multiplayer or rewards. Do not advance to BC-2 from BC-1.1.
