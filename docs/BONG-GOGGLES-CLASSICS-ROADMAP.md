# BongGoggles Classics — canonical 25-game implementation roadmap

**Roadmap ID:** BG-CLASSICS (BC-0 through BC-25)
**Adopted:** 2026-11-21
**Status:** BC-0.1–BC-0.3 qualified in the repository; BC-0.4–BC-0.12 and all 25 game engines remain unimplemented. Live browser deployment is not independently attested.
**Repository:** `abvhiael/420-integrated-v0.1`
**Product:** `https://bonggoggles.420integrated.org/`

## Non-negotiable delivery contract

Implement one fully working game at a time, in the exact numbered sequence below. Complete BC-0 first, then BC-1 Cribbage, BC-2 Russian Cribbage, and so on through BC-25 Kaiser. Do not advance the active game until the preceding game meets its release gate. Each game needs complete UI, server-side rules/scoring, computer opponents at Easy/Medium/Hard, human online multiplayer, mixed bot-human seats as applicable, saved matches, resume, rematch and verified end-to-end deployment. No placeholder or registered ruleset counts as playable.

All 25 games must be individually navigable from the principal BongGoggles **Games** menu; add a dedicated **Canadian Classics** collection. Preserve existing Cross-Country Chaos, Rummy, Asshole and other unrelated catalogue entries without silently folding them into this 25-game sequence.

Games are zero-wager and require no blockchain transaction or mandatory 420Wallet for an ordinary authenticated account match. Existing wallet/on-chain BG-15 sessions remain a *separate* canonical mode with their own authority and qualified contracts; never claim an off-chain result is an on-chain result. Wallet-linked sessions are optional only when the specific integration has been qualified. Preserve 420ID authentication and the existing social, privacy, moderation, identity, safety and 420Bet authority boundaries.

## Baseline and source ownership

- `bong-goggles/web/core/classics.js` is currently an editorial collection: many entries planned, seven legacy entries marked `registry`; complete interactive engines are **not** delivered by these descriptors.
- `bong-goggles/web/core/classics-ui.js` and `bong-goggles/web/core/routes.js` serve the current Classics catalogue and Cross-Country Chaos local game; existing live navigation must not regress.
- `bong-goggles/web/core/games.js`, `games-ui.js` and `services/bong-goggles-games-v1/` contain qualified BG-15 projection/intent and versioned seven-type infrastructure; these are not proof of real online game boards or wallet-independent account multiplayer.
- `BongGogglesGameSessionRegistry420` keeps its established canonical session/move authority for eligible wallet/on-chain games. Do not mutate its existing enum or change immutable ruleset bindings casually.
- BC-0.2 makes `/games` a publicly browsable 25-game catalogue with strict game detail links. Legacy wallet/on-chain BG-15 session detail remains gated; account gameplay is still independently controlled at `/account/games`.
- Cross-Country Chaos already has local Easy/Normal/Hard computer-seat functionality. New Classics use **Easy/Medium/Hard** terminology; do not break the existing game.

## BC-0 — mandatory shared gaming platform (FIRST)

| Substep | Gate | Required deliverable |
|---|---|---|
| BC-0.1 | Baseline inventory — **QUALIFIED** ([source-backed inventory](games/classics/BC-0-1-REPOSITORY-INVENTORY.md)) | Reconcile main, open PRs, BG-15 session/engine framework, web routes, current Classics assets/tests, account-social/420ID flows, and deployed-service boundaries. Retain exact commit provenance. |
| BC-0.2 | One coherent games menu — **QUALIFIED** ([evidence](games/classics/BC-0-2-QUALIFICATION.md)) | Make /games the principal browse destination with all 25 titles visibly present and individually navigable to /games/:slug (or equivalent routed path). Keep /classics aliases and Cross-Country Chaos; Canadian Classics has its own category. Never falsely label unfinished games playable. |
| BC-0.3 | Shared UI — **QUALIFIED** ([evidence](games/classics/BC-0-3-QUALIFICATION.md)) | Build game landing page, rules and active-variant labels, New Game, opponent/seat setup, tabletop, history, resume, results, rematch, and accessible mobile layouts. |
| BC-0.4 | Account integration | Use 420ID-backed BongGoggles identities and existing account sessions for wallet-optional games. Keep an obvious login path, log-out, session renewal and policy/block checks. No mandatory 420Wallet connection for off-chain matches. |
| BC-0.5 | Invites and seating | Private/public rooms; friend invitations; accept/decline/cancel; 2-4 or game-specific seat counts; team assignment; seat-specific human or bot control and per-bot difficulty; human-human and mixed human-bot play. |
| BC-0.6 | Authoritative off-chain sessions | Qualified server-side match authority for account matches: create/start/turn/validate/end/cancel/resign/timeout, strictly increasing action sequence, durable persistence, idempotency and authorization; do not treat client scores as authoritative. |
| BC-0.7 | Rules/AI contracts | Versioned deterministic game-state codecs and ruleset hashes; legal actions, apply/score/isTerminal, public vs per-seat/private views, seeded/replayable randomness, AI chooseMove(stateForSeat,difficulty), bounded compute budgets. |
| BC-0.8 | AI infrastructure | Easy/Medium/Hard policy adapters, per-game search/probability as appropriate; legal-move-only submission, no cheating using hidden state; single-worker/bounded runtime, reproducible bot-v-bot tests. |
| BC-0.9 | Shared components | Cards, dice, tile racks, boards, pieces, teams, table positions, scoring panels, hand privacy, feedback, timer, accessibility patterns, localized rules and image-asset manifests. |
| BC-0.10 | Real-time/recovery | WebSocket/SSE or qualified equivalent events, authorization, replay/reconnect, live status, turn notifications, stale-client conflict response, refresh recovery and server-restart resume. |
| BC-0.11 | Zero-wager/integrity | No wagers, stakes, escrow, odds, prize settlement or 420Bet coupling. Server-committed randomness, hidden information redaction, abuse limits, policy invalidation, spam protections and secure audit log. |
| BC-0.12 | Qualification pipeline | Node unit + property + fixtures + bot simulation + multi-account browser E2E + mobile + accessibility + fault injection + load budgets + exact-head CI. Gate public Play buttons behind actual game functionality and deployment validation. |

**BC-0 exit:** Existing social/Wallet/Chaos regression suites pass; all 25 entries render in the central Games menu with distinct stable links and accurate non-playable states; two real account identities can reach an authorized persistent test game through the shared session API with reconnect and anti-replay verification; bot seats and difficulty contracts exist and are tested. The generic platform may use a test-fixture ruleset, but no named game is described as fully released until its own BC-n gate passes.

## Reusable eight-gate implementation sequence (applies to BC-1 through BC-25)

1. **Rules and variants:** identify source rules; lock version, player counts, scoring and exceptional cases; obtain approval for ambiguous regional forms before coding; persist per-match ruleset/version.
2. **Rules engine:** setup/shuffle/draw or board setup; legal actions, turn state, scoring, terminal conditions, replayable actions, deterministic fixtures and strict state validation.
3. **Computer opponents:** Easy, Medium and Hard with independently chosen strength strategies and bounded resource budgets; no access to opponents' hidden information; 100% legal actions in qualification.
4. **Frontend:** dedicated landing/help/play pages with the complete board/table/rack/hand/scorecard, legal move interactions, accessible interactions and responsive screens.
5. **Human multiplayer:** invite/join, public/private lobby, seats/teams, live updates, idempotent move submission, resign/timeout and disconnected-session resume; mixed human/bot sessions.
6. **History and social:** authenticated challenge and rematch, result/score/history, notifications, current-player visibility and safe statistics. No unverified reward claims.
7. **Qualification:** rules corner cases, AI matches across all difficulties, hidden-information leakage tests, duplicate/out-of-order moves, concurrency, restart, accessibility and multi-account browser E2E.
8. **Release:** record exact commit/test/deployment/browser evidence, verify real play-to-completion and rematch against one human and all bot levels, then and only then mark the catalogue `playable` and advance to next step.

### Per-game release gate (mandatory)

- A newcomer can find the game from `/games`, read its correct rules and begin a new match.
- Game can be played start-to-finish with verified rules, full scoring and actual final result, not a mock/stub/registered ruleset.
- Each supported human/AI seat configuration works, including Easy, Medium and Hard bots; AI never submits an illegal action.
- Browser refresh, network interruption, duplicate requests and server restart neither erase the match nor award incorrect results.
- Two independent authenticated human accounts successfully complete an online match on the deployed service; a distinct browser/device path is covered.
- Privacy, integrity, accessibility, desktop/mobile presentation, history and rematch regression suites are green.
- The release record names the exact repo SHA, ruleset hash/version, tests, environment and deployment/rollback evidence. A green unit build alone is not live release proof.

## Fixed sequence — Main Classics

| Milestone | Game | Seats | Required game-specific scope |
|---|---|---|---|
| BC-1 | **Cribbage** | 2-4 | Standard cribbage; deals and crib ownership by configuration; cut and starter; pegging, go/last card, 15s, runs, pairs, flushes, nobs, heels, skunks and 121-point finish; board, scores, AI and human seats. |
| BC-2 | **Russian Cribbage** | variant-dependent | Confirm the exact named ruleset with a documented rulebook and examples before implementation; separate deals, legal moves, scoring, special outcomes, UI and AI; never silently substitute standard cribbage. |
| BC-3 | **Chess** | 2 | All legal moves, checks, castling, en passant, promotion, mate, stalemate, repetition and move-count draws; clocks, notation, resignation, AI and saved games. |
| BC-4 | **Scrabble** | 2-4 | Tile distribution, rack/bag, letter/word placement, blanks, premium squares, dictionary, challenges, passes, exchanges and endgame scoring. Resolve trademarks, board art and lexicon licensing; if unavailable use a distinct legally usable word-game identity. |
| BC-5 | **Checkers** | 2 | Chosen variant documented (e.g. English/American 8x8); mandatory captures, multiple jumps, kings, promotion, draws and tactical AI. |
| BC-6 | **Backgammon** | 2 | Dice, entering from bar, legal movement, blocked points, bearing off, doubling cube, gammons/backgammons and match scoring. |
| BC-7 | **Dominoes** | 2-4 | Selected draw/block or partnership rulesets, tile pool, shuffle, placements, open ends, draw/pass, blocked rounds and scoring. |
| BC-8 | **Crazy Eights** | 2-4 | Matching suit/rank, wild eights and suit calls, stock/discards, finishing and round scores; rule variant locks. |
| BC-9 | **Euchre** | 4 | Partnerships, trump calls, bowers, dealer/alone play, trick taking, euchre scoring and partner-aware bots. |
| BC-10 | **Yahtzee** | configured multiplayer | One full five-dice scorecard per scoring row; 1-, 2-, 3- and 6-row formats, with category/bonus/scoring rules explicitly defined for each format. Upper 1-6, upper bonus, 3/4 kind, full house, small/large straight, five-of-a-kind, chance, extra-five-of-a-kind/joker rules where applicable, totals, roll/hold UI and AI. Resolve trademark/branding rights or use an independent five-dice identity. |
| BC-11 | **Go Fish** | 2-4 | Legal rank requests, handing over cards, draw stock, books, empty hands, game completion and scores. |
| BC-12 | **Hearts** | 4 default | Pass directions, follow-suit, lead restrictions, broken hearts, Queen of Spades, moon shooting and target scoring; variants version-pinned. |
| BC-13 | **Go** | 2 | 9x9, 13x13, 19x19, liberties, capture, ko/superko, passes, territory/area scoring rules, komi, dead-stone review and AI. |
| BC-14 | **Mahjong** | 4 | Actual four-player draw/discard/meld game, NOT solitaire matching. Select/version a traditional ruleset, including tiles/wall, chi/pon/kan or equivalents, claim priority, winning hands and scoring. |
| BC-15 | **Spades** | 4 | Partnerships, bids and nil, tricks, spade breaking, bags/penalties, scoring and team AI. |
| BC-16 | **500** | 3-4 | Three- and four-player rulesets, bidding, no-trump/trump, joker/kitty as applicable, contracts, tricks and scoring. |
| BC-17 | **Canasta** | 2-4 | Stock and discards, melds, wilds, red/black threes, frozen discard restrictions, canastas, going out and multi-round totals. |

## Fixed sequence — Canadian Classics

These eight entries appear together under **Canadian Classics** while retaining their numbered build order. Traditional/house-rule ambiguity must be resolved by an explicit ruleset document with sample deals and scoring fixtures. A table selects and locks its variant before play; a match must never change variants mid-game.

| Milestone | Game | Seats | Required game-specific scope |
|---|---|---|---|
| BC-18 | **Tarabish** | 4 | Cape Breton partnerships, trump, Jass/Manille ranks, runs/declared combinations, tricks and game scoring; include local terminology. |
| BC-19 | **45s** | 2-4 where qualified | Forty-Fives rank order, trump, play legality, bidding/scoring and explicitly named regional/house variants. |
| BC-20 | **120s** | 4 default | Newfoundland/Atlantic rules documented and versioned; bids, trump rank, partnership tricks and 120s scoring, optional regional variants. |
| BC-21 | **Deux Cents** | 4 | French-Canadian partnership rules, bidding, contracts, trump, tricks, declarations and scoring; bilingual labels where useful. |
| BC-22 | **Hola** | 2 or 4 | Define and lock the selected Hola ruleset, legal plays/captures, equal-rank interactions, scoring and partner mode. |
| BC-23 | **Rook** | 4 default | Licensed or independently permissible Rook-deck art/identity, cards, kitty, bids, trump, partnerships, tricks and round totals. |
| BC-24 | **Nines** | 3-4 where qualified | Document and lock regional Nines/Le Neuf rules, deals, trump, bidding if present, tricks, scoring and AI. |
| BC-25 | **Kaiser** | 4 | Saskatchewan-style four-player partnership rules: chosen 32/34-card variant, bids, trump, special 5 of hearts and 3 of spades, tricks, contract penalties and target match scoring. |

## AI acceptance standard

| Level | Playing behavior |
|---|---|
| Easy | Legal beginner play; basic immediate gain and occasional strategically poor but legal decisions. |
| Medium | Competent casual play with tactical lookahead, card/move tracking and informed probability. |
| Hard | Stronger bounded search/probabilistic/information-set reasoning as appropriate; partnership coordination; not hidden-hand cheating. |

Measure skill differentiation through repeatable simulations over representative seeds, team compositions and turns; stronger strategies should generally outperform weaker ones, but no forced outcome or guaranteed win is permitted. Hard bots are never allowed to see undealt cards, other players' concealed tiles/hands or hidden draw order. Hidden-state games must expose only the per-seat legal observation view to bot engines.

## Game page and navigation contract

Each milestone creates a stable game landing route (proposed `/games/<slug>`), versioned rules/help, player-count/variant selector, human vs AI seat configuration, difficulty per bot, lobby/invite/status, responsive live tabletop, scoring/turn panel, result/history and rematch. Before launch, the stable route may display an honest `Coming soon` or `Registry only` state; it must never render an inert `Play` button that falsely suggests a working match.

The main `Games` link must be accessible to logged-out visitors for browsing, 420ID players for account matches, and wallet-connected players for eligible legacy canonical game-session details. Avoid blocking the entire catalogue behind a Wallet-required message. Preserve `/classics` and `/classics/cross-country-chaos` as working addresses.

## Versioning, scoring and rights gates

- **Russian Cribbage:** no unambiguous default ruleset should be invented. Explicitly identify/approve a reference or supplied rules before BC-2 passes gate 1.
- **Scrabble and Yahtzee:** these are branded games with potentially protected marks, art and associated word data. Verify appropriate licensing; otherwise implement legally distinct branded equivalents while preserving specified gameplay and scorecards.
- **Yahtzee scorecard:** support 1, 2, 3 and 6 scoring rows, each with a *complete* upper and lower section, bonus categories and totals. Define per-row bonus and card-completion behavior before implementation; all formats use the full scorecard, not a shortened or example sheet.
- **Mahjong:** real four-player Mahjong with a selected regional ruleset; never replace it with tile-pair solitaire.
- **Go:** explicit 9x9, 13x13 and 19x19 selection, correct ko/komi/scoring and dead-group adjudication.
- **Canadian Classics:** version rules for Cape Breton/Maritime/Prairie/French-Canadian variants; do not assert disputed regional rank/bid details without documented fixtures and validation.
- Do not confuse existing `/games` canonical seven-type enum with the new off-chain 25-game catalogue. Contract compatibility and old session identifiers must be maintained.

## Proposed source placement

- `docs/BONG-GOGGLES-CLASSICS-ROADMAP.md`: **this canonical execution contract**; log each BC-n status and evidence here.
- `docs/games/classics/`: approved rulebooks, variant definitions, deterministic fixtures, release records.
- `bong-goggles/web/core/classics.js` and `core/classics-ui.js`: discoverability, classification, statuses and presentation (preserve existing unrelated games).
- `bong-goggles/web/core/games/`: proposed individual game components, shared setup/table/history UI; choose final layout based on BC-0 inventory.
- `bong-goggles/web/assets/games/`: approved card, tile, board and sound assets with allowlisted manifests.
- `services/bong-goggles-games-v1/`: reuse qualified foundational code and add rules engines, account-game API integration, bot policies, persistence, replay and tests, or create a separately qualified account-games service if necessary to preserve BG-15 contract invariants.

## Evidence ledger and operating instructions

| Milestone | Status | Exact SHA | CI / E2E / deployment evidence | Remaining blockers |
|---|---|---|---|---|
| BC-0 | IN PROGRESS | — | BC-0.1–BC-0.3 repository qualified; BC-0.4–BC-0.12 not implemented | BC-0 shared platform and release criteria remain open |
| BC-0.1 | QUALIFIED | Inventory commit `e399434763cf07d130d486cc05cfe18ae0d75b4e`; baseline `1cd6ceb5fe5f6bc47ae7662ab2d4b14a776f0eb0` | [Inventory](games/classics/BC-0-1-REPOSITORY-INVENTORY.md); [420Docs Qualification #44948290256](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44948290256) PASS at inventory SHA; 18/18 critical source files verified | BC-0.2 next; BC-0 overall incomplete |
| BC-0.2 | QUALIFIED (repository; live browser not attested) | `822dcbd40048c49e07bd2bfff79e305ed4b750ea` | [Run #44953039287](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44953039287) PASS: 363 web tests, 4 HTTP tests, both builds, assets/accessibility, secret scan; [evidence](games/classics/BC-0-2-QUALIFICATION.md) | BC-0.3 next; BC-0 deployment remains unverified |
| BC-0.3 | QUALIFIED (repository; live browser not attested) | `38732671ecf1adf22c50d605657a6dbf85476e15` | [Web Verification #44955770348](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44955770348) PASS: 373 web tests, 4 HTTP tests, both builds, scoped asset/accessibility and secret scan; [evidence](games/classics/BC-0-3-QUALIFICATION.md) | BC-0.4 next; 420ID/game authority and deployment remain separate |
| BC-1 | NOT STARTED | — | — | Prerequisite milestone and per-game release gate |
| BC-2 | NOT STARTED | — | — | Prerequisite milestone and per-game release gate |
| BC-3 | NOT STARTED | — | — | Prerequisite milestone and per-game release gate |
| BC-4 | NOT STARTED | — | — | Prerequisite milestone and per-game release gate |
| BC-5 | NOT STARTED | — | — | Prerequisite milestone and per-game release gate |
| BC-6 | NOT STARTED | — | — | Prerequisite milestone and per-game release gate |
| BC-7 | NOT STARTED | — | — | Prerequisite milestone and per-game release gate |
| BC-8 | NOT STARTED | — | — | Prerequisite milestone and per-game release gate |
| BC-9 | NOT STARTED | — | — | Prerequisite milestone and per-game release gate |
| BC-10 | NOT STARTED | — | — | Prerequisite milestone and per-game release gate |
| BC-11 | NOT STARTED | — | — | Prerequisite milestone and per-game release gate |
| BC-12 | NOT STARTED | — | — | Prerequisite milestone and per-game release gate |
| BC-13 | NOT STARTED | — | — | Prerequisite milestone and per-game release gate |
| BC-14 | NOT STARTED | — | — | Prerequisite milestone and per-game release gate |
| BC-15 | NOT STARTED | — | — | Prerequisite milestone and per-game release gate |
| BC-16 | NOT STARTED | — | — | Prerequisite milestone and per-game release gate |
| BC-17 | NOT STARTED | — | — | Prerequisite milestone and per-game release gate |
| BC-18 | NOT STARTED | — | — | Prerequisite milestone and per-game release gate |
| BC-19 | NOT STARTED | — | — | Prerequisite milestone and per-game release gate |
| BC-20 | NOT STARTED | — | — | Prerequisite milestone and per-game release gate |
| BC-21 | NOT STARTED | — | — | Prerequisite milestone and per-game release gate |
| BC-22 | NOT STARTED | — | — | Prerequisite milestone and per-game release gate |
| BC-23 | NOT STARTED | — | — | Prerequisite milestone and per-game release gate |
| BC-24 | NOT STARTED | — | — | Prerequisite milestone and per-game release gate |
| BC-25 | NOT STARTED | — | — | Prerequisite milestone and per-game release gate |

Use explicit status vocabulary `NOT STARTED`, `IN PROGRESS`, `IMPLEMENTED`, `QUALIFIED`, `DEPLOYED` and `BLOCKED`; record exact SHAs and named-environment proof. A milestone is **COMPLETE** only once it is qualified and deployed with browser verification. Do not tick a task or claim it finished merely because this document exists. Check branch/main and PR status before editing; do not overwrite concurrent work. Keep the main BongGoggles roadmap linked and updated whenever this workstream advances.

## Final acceptance

**All 25 games** are individually linked from the primary Games catalogue, have rule-correct and fully interactive frontends, durable authoritative computing backends, three legal/non-cheating computer difficulties, complete human/mixed multiplayer, responsive and accessible game tables, verified game history and resume/rematch, and successful real production or named-release-environment qualification. The eight Canadian Classics are a clearly separated collection. No requirement of a wallet, wager or unqualified blockchain action is introduced for ordinary 420ID game play.
