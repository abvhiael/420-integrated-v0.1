# BC-4.1 — Word Salad rules and variants

Rules identity: word-salad-v1. Canonical specification for BongGoggles; not a playable-release attestation. Free off-chain individual competition, no wagers or token rewards. Public title Word Salad; preserve historical internal scrabble identifier until compatible migration. Trademark and dictionary licensing clearance remain release gates.

## Boards and seats
| Board | Seats | Bag | Rack | Full Harvest | Blanks | Hybrids |
|---|---|---|---|---|---|---|
| Quick Hit 11x11 | 2 | 80 | 7 | 50 | 2 | 15 |
| Personal Stash 13x13 | 2–3 | 100 | 7 | 50 | 3 | 19 |
| Classic 15x15 | 2–4 | 120 | 8 | 60 | 3 | 23 |
| Big Bud 17x17 (default) | 2–4 | 140 | 8 | 60 | 4 | 32 |
| The Grow Room 19x19 | 2–6 | 180 | 8 | 60 | 5 | 42 |
| Mega Stash 21x21 | 2–6 | 220 | 8 | 60 | 6 | 54 |

Exact eightfold-symmetric board patterns and deterministic tile distributions are defined in bong-goggles/web/core/word-salad-rules.js and word-salad-tiles.js. The profiles are initial balance baselines; changes require new version. Centre is Mother Plant. All boards use 26 single letters, 15 hybrids QU TH PH SH CH GH CK NG WH SC ST TR LL SS OO, and blank. No numeric tiles. Hybrids occupy one square and rack position, read both letters in printed order horizontally and vertically, never split. Blank permanently assigned one A–Z letter when placed, worth zero, no reclaim or hybrid assignment.

## Modes and regional variants
Classic Salad: general English plus cannabis lexicon, automatic cannabis 2x bonus. Extra Dank: same rules, at least one newly formed cannabis word per placement turn. Straight Greens: general English only, no cannabis bonus. Pass/exchange permitted in all modes. Ranked standard Big Bud Classic Salad, same rules/dictionary/timing per queue. Other configurations casual. Canadian, British and American spellings share one lexicon, as do verified regional cannabis slang and cultivar aliases. No separate regional scoring or partnership variants. Local, live, asynchronous and mixed human/bot seats follow identical rules.

## Setup and turns
Shuffle bag and seat order with unbiased authoritative randomness; retain private replay seed and draw order. Deal in seat order to rack capacity. First seat starts; turns advance clockwise among active seats. Timing: untimed local/casual; live 120 seconds per turn; asynchronous 24 hours per turn. Separate ranked queues for timing profiles. Server deadline authoritative, never reset on reconnect; timeout counts as pass. No midmatch seat replacement.

Placement uses at least one owned physical rack tile; new cells share row or column, no overlap or gaps between extreme new cells after considering occupied squares. First move covers centre and forms a word spanning at least two cells. Later moves connect orthogonally to existing board and form at least one word spanning two cells; diagonal alone insufficient. Read maximal contiguous horizontal/vertical runs containing new tiles, left-to-right/top-to-bottom; deduplicate by direction and endpoints. All formed runs must be legal. A single placed tile can create two runs; a lone hybrid occupying one cell is not a word by itself. Existing tiles cannot move or rotate. Maximum 42 characters across 21 cells; physical fit controls placement.

## Lexicon
Canonical uppercase A–Z keys, 2–42 letters; remove spaces, hyphens and apostrophes only for approved entries; no digits, unapproved aliases or punctuation. Exact full-word membership, never substring. Approved strain names and abbreviations exempt from ordinary proper-name restriction only in cannabis-enabled modes. Recognized cannabis meanings of ordinary words qualify regardless of intended sense. No automatic inflection generation. Store source, category, aliases, bonus eligibility, license/provenance. Pin both dictionary versions/hashes and rules/board/bag identity at match creation. No midmatch update. Herbarium search and nominations do not mutate active matches. Target 21,000 candidate entries before deduplication, not a verified complete dictionary.

Automatic validation before commit replaces bluff challenges: invalid move rejected atomically, board/rack/bag/score/revision unchanged; clock continues. Challenges are pinned dictionary lookups or defect reports; no undo or score penalty for already accepted plays.

## Scoring
Sprout 2L; Flower 3L; Concentrate 4L; Hotbox 2W; Harvest 3W; Mother Plant 2W. For each newly formed run sum tile face values with letter premiums on newly placed tiles only, multiply by all new word premiums, then double for exact cannabis eligibility in enabled modes. New premium applies independently to every formed run containing it; never reused in later turns. Blank zero even on letter premium, but triggers word premium. Hybrid entire printed value multiplied once. Sum formed-word scores then add Full Harvest once for playing full rack capacity physical tiles (not emptying partial rack). No scoring unchanged words. Multiple cannabis categories never multiply more than once per word. Integer arithmetic, reject overflow. Example SH(3) on 4L plus A,T,T,E,R (1 each) gives 17; cannabis SHATTER 34, or 102 with additional 3W. HIGH as H,I,GH gives 14 with cannabis bonus, no board premiums. Extra Dank needs one eligible formed word even if zero points. Straight Greens only accepts general dictionary membership.

After legal placement replenish to rack capacity or bag exhaustion. Exchange one or more owned tiles only if pre-exchange bag has at least rack capacity and requested count; draw replacements first, return exchanged tiles then shuffle remaining bag replayably. Pass/exchange zero score. Zero-point placements count as scoreless. Positive placement resets streak. Invalid actions do not count.

## Ending and exceptions
End immediately when bag empty and legal placement empties rack, or six consecutive completed scoreless turns (passes, exchanges, zero-point placements, timeouts). Going out: deduct remaining face values from other active seats, credit sum to finisher. Scoreless ending: deduct each active seat's own remaining face values, no credit. Blank zero; hybrid printed value. Negative scores allowed. Highest adjusted score wins, ties share rank/win.

Resignation: mark forfeited, deduct own remaining face values once, remove rack from circulation without transferring points, exclude from winning. Continue with remaining active seats; sole survivor wins by forfeit without normal going-out adjustment. All forfeited/cancelled: no winner. Resignation does not change scoreless streak. Cancel before first accepted turn without competitive result; after start only administrative integrity cancellation, no fabricated scores or winner. No voluntary undo of committed moves.

Disconnect preserves rack, score and deadline; reconnect restores authoritative state and private rack. No hidden automatic placements. Duplicate commands idempotently replay original result; stale/invalid commands rejected; concurrent actions serialized by revision. Terminal state immutable. Missing/corrupt pinned rules, dictionaries or state fail closed. Persist board, bag, racks, turn, scores, deadline, rules identity and journal atomically. Opponents and bots cannot access private racks, bag order or seed. Public view settled board, scores, rack counts, bag count, turn and deadline. Replay reproduces draws, moves, scores and outcome.

## Scope boundary
BC-4.1 specifies rules, supported variants and exceptional behavior. Full authoritative engine, licensed dictionary corpus, AI, UI, multiplayer, history and release are later milestones. No production Play activation. Newly specified timing, exchanges, scoreless ending, resignation and challenge policies are design decisions, not claims of already implemented gameplay.
