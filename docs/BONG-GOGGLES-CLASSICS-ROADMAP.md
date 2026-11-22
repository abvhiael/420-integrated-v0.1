# BongGoggles Classics — canonical 25-game implementation roadmap

**Roadmap ID:** BG-CLASSICS (BC-0 through BC-25)
**Adopted:** 2026-11-21
**Status:** BC-0.1–BC-0.12 shared platform infrastructure repository-qualified, with the three-job BC-0.12 CI passing at exact source. No Classic title has passed its complete game-specific release gate or real production two-account match acceptance; no Classic is publicly playable. **BC-1.1 rules, BC-1.2 deterministic engine, BC-1.3 computer opponents and BC-1.4 responsive Cribbage frontend QUALIFIED (repository); BC-1.5 authenticated human multiplayer next. BC-1 remains unreleased.**
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
| BC-0.4 | Account integration — **QUALIFIED** ([evidence](games/classics/BC-0-4-QUALIFICATION.md)) | Use 420ID-backed BongGoggles identities and existing account sessions for wallet-optional games. Keep an obvious login path, log-out, session renewal and policy/block checks. No mandatory 420Wallet connection for off-chain matches. |
| BC-0.5 | Invites and seating — **QUALIFIED (repository)** ([evidence](games/classics/BC-0-5-QUALIFICATION.md)) | Private/public rooms; friend invitations; accept/decline/cancel; 2-4 or game-specific seat counts; team assignment; seat-specific human or bot control and per-bot difficulty; human-human and mixed human-bot play. |
| BC-0.6 | Authoritative off-chain sessions — **QUALIFIED (backend repository)** ([evidence](games/classics/BC-0-6-QUALIFICATION.md)) | Qualified server-side match authority for account matches: create/start/turn/validate/end/cancel/resign/timeout, strictly increasing action sequence, durable persistence, idempotency and authorization; do not treat client scores as authoritative. |
| BC-0.7 | Rules/AI contracts — **QUALIFIED (framework repository)** ([evidence](games/classics/BC-0-7-QUALIFICATION.md)) | Versioned deterministic game-state codecs and ruleset hashes; legal actions, apply/score/isTerminal, public vs per-seat/private views, seeded/replayable randomness, AI chooseMove(stateForSeat,difficulty), bounded compute budgets. |
| BC-0.8 | AI infrastructure — **QUALIFIED (framework repository)** ([evidence](games/classics/BC-0-8-QUALIFICATION.md)) | Easy/Medium/Hard per-game policy registration, legal-move-only authority, seat-private observations, cooperative compute/deadline caps, transactional single-worker scheduler and deterministic bot-v-bot qualification. Actual per-game search/probability and competitive AI belong to each game's individual release gate. |
| BC-0.9 | Shared components — **QUALIFIED (UI framework repository)** ([evidence](games/classics/BC-0-9-QUALIFICATION.md)) | Reusable card decks, private hands and tile racks, chess/checkers/Go piece boards, dice, complete configurable scorecards, seats/teams/table positions, scores, turn indicators, UTC server deadline, safe feedback, localized verified rules, self-contained symbol asset manifest, disabled controls, accessible mobile/contrast layouts. Game engines and actions remain separately gated. |
| BC-0.10 | Communications/recovery — **QUALIFIED (shared framework repository)** ([evidence](games/classics/BC-0-10-QUALIFICATION.md)) | 420ID-authenticated participant-only presence with 20-second PostgreSQL-clock leases, durable per-session replay, validated room revision + event cursor, safe reconnect and refresh, in-app turn notices, block-policy/seat invalidation, stale-client conflicts, online/visibility recovery, independent heartbeat rate limit and multi-device authorization. Production Play still gated. |
| BC-0.11 | Security/integrity — **QUALIFIED (shared framework repository)** ([evidence](games/classics/BC-0-11-QUALIFICATION.md)) | No wagers, stakes, escrow, odds or 420Bet settlement coupling. Strict server-only scores/turns and 420ID actors, command replay/nonce enforcement, legal-action validation, seed and hidden-view redaction, deep-copy rules isolation, contiguous immutable event journal and fail-closed public event schema/recovery. Per-game secrecy/scoring audits and live multi-account play remain separate gates. |
| BC-0.12 | Test/release infrastructure — **QUALIFIED (repository only)** ([evidence](games/classics/BC-0-12-QUALIFICATION.md)) | Node unit/property and fixtures, PostgreSQL 16 Go race, seeded Easy/Medium/Hard bot simulation, parallel two-account server integration, cold recovery, real Chromium desktop/mobile with two isolated browser-context transport fixtures, axe WCAG checks, bounded tests and exact-head CI; release requires separate real 420ID two-account deployed-game adapter and main-only acceptance. Zero titles released. |

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
| BC-0 | QUALIFIED (shared infrastructure repository only) | `836e8fa4c3ae54cd8e7b793aca9eb555feb1b64f` | BC-0.1–BC-0.12 source-qualified; [three-job exact-source CI #44985051985](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44985051985) SUCCESS, including 30/30 Node, Go PostgreSQL race, Chromium axe/mobile/two-context, and empty release audit | No deployed account-game engine, no 25-title E2E match or Play release accepted. BC-1 Cribbage next |
| BC-0.1 | QUALIFIED | Inventory commit `e399434763cf07d130d486cc05cfe18ae0d75b4e`; baseline `1cd6ceb5fe5f6bc47ae7662ab2d4b14a776f0eb0` | [Inventory](games/classics/BC-0-1-REPOSITORY-INVENTORY.md); [420Docs Qualification #44948290256](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44948290256) PASS at inventory SHA; 18/18 critical source files verified | BC-0.2 next; BC-0 overall incomplete |
| BC-0.2 | QUALIFIED (repository; live browser not attested) | `822dcbd40048c49e07bd2bfff79e305ed4b750ea` | [Run #44953039287](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44953039287) PASS: 363 web tests, 4 HTTP tests, both builds, assets/accessibility, secret scan; [evidence](games/classics/BC-0-2-QUALIFICATION.md) | BC-0.3 next; BC-0 deployment remains unverified |
| BC-0.3 | QUALIFIED (repository; live browser not attested) | `38732671ecf1adf22c50d605657a6dbf85476e15` | [Web Verification #44955770348](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44955770348) PASS: 373 web tests, 4 HTTP tests, both builds, scoped asset/accessibility and secret scan; [evidence](games/classics/BC-0-3-QUALIFICATION.md) | BC-0.4 next; 420ID/game authority and deployment remain separate |
| BC-0.4 | QUALIFIED (repository; live account source/CSS checked) | `ae010bdba302dab52313102fb9e875fb9511a9e7` | [Web Verification #44964060589](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44964060589) PASS: 386 web + 4 HTTP, both builds, static asset/security; [live header #44964060528](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44964060528) PASS; [evidence](games/classics/BC-0-4-QUALIFICATION.md) | BC-0.5 next; human game match acceptance separate |
| BC-0.5 | QUALIFIED (repository; live room activation not attested) | `42a47b7898990162e82c154a8366384269b55b53` | [PostgreSQL/race #44967583098](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44967583098) PASS; [Web #44967583182](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44967583182) 400 web + 4 HTTP PASS, builds/assets/secret scan PASS; [evidence](games/classics/BC-0-5-QUALIFICATION.md) | Live Account Social health HTTP 502; BC-0.6 backend subsequently qualified; live BC-0.5 activation still unverified |
| BC-0.6 | QUALIFIED (backend repository; production-disabled) | `3e61993bc3ec8c24154a43c93223ce175986586c` | [Go/PostgreSQL race and 51 Node regressions #44971482231](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44971482231) PASS at exact code SHA; [401 web + 4 HTTP, both builds #44970858419](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44970858419) PASS at earlier BC-0.6 source before concurrent oversized CCC map replacements; [evidence](games/classics/BC-0-6-QUALIFICATION.md) | Backend transport only; no qualified production rule adapter; live Account Social 502, CCC-art post-upload web failure separate; BC-0.7 next |
| BC-0.7 | QUALIFIED (framework repository; no playable titles) | `ebc3fc9c668eb7ac2bf99f851656c3df21b2486f` | [Exact-head PostgreSQL/race, Go vet/build and 51 Node regressions #44974518918](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44974518918) PASS; [evidence](games/classics/BC-0-7-QUALIFICATION.md) | Test-only rules module; production resolver nil. Live Account Social 502 and unrelated CCC map asset gate remain external; BC-0.8 next |
| BC-0.8 | QUALIFIED (AI framework repository; no playable titles) | `92b4223ae21efe68e37d280b7834695941a2bf59` | [Exact-source BC-0.5–0.8 PostgreSQL/race, Go vet/build and 51 Node tests #44975420173](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44975420173) PASS; [Account Social regression and 22 browser tests #44975420166](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44975420166) PASS; [evidence](games/classics/BC-0-8-QUALIFICATION.md) | No production game rules/policies installed; individual game strategies and verified live multi-account delivery still pending; BC-0.9 next |
| BC-0.9 | QUALIFIED (shared UI framework; no playable titles) | `84a0c563d2cf312f2613265497123acbb83878f5` | [Exact-source targeted UI and static security #44977602591](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44977602591) PASS: 51/51 scoped tests; [full-web #44977602598](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44977602598) 410/411 with **sole pre-existing CCC atlas mismatch**; [evidence](games/classics/BC-0-9-QUALIFICATION.md) | UI only; no game-specific rule/AI or action activation; actual production play unverified; BC-0.10 next |
| BC-0.10 | QUALIFIED (communications framework repository; no playable titles) | `6fb1852be6fbe1fe2d7a735fdaeec67300674944` | [Exact-head PostgreSQL16 Go race/vet/build plus 58/58 scoped Node tests #44979666977](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44979666977) PASS; [evidence](games/classics/BC-0-10-QUALIFICATION.md) | 420ID presence/lease, replay and reconnect qualified in source; 429/429 whole-web Node tests pass but independent historical app.js asset-size cap blocks whole-web qualification; no production activation. BC-0.11 next |
| BC-0.11 | QUALIFIED (server security/integrity framework; no playable titles) | `db2c218f4494485fbde2835f8859184beb8cce76` | [PostgreSQL16 Go race/vet/build and 58/58 Node tests #44982207650](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44982207650) PASS; [Account Social Go/22 browser tests #44982207654](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44982207654) PASS; [evidence](games/classics/BC-0-11-QUALIFICATION.md) | Server rejects illegal moves, replayed or impersonated requests, client scores/wagers and corrupt/secret-bearing event streams; no game-specific engine or live deployment. BC-0.12 next |
| BC-0.12 | QUALIFIED (test/release infrastructure repository; 0 playable titles) | `836e8fa4c3ae54cd8e7b793aca9eb555feb1b64f` | [Exact-head three-job CI #44985051985](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44985051985) SUCCESS: Go PostgreSQL16 race/vet/build; 30/30 Node; real Chromium desktop/mobile, axe WCAG and isolated multi-account fixture recovery; [qualification](games/classics/BC-0-12-QUALIFICATION.md) | 25 titles locked (empty evidence manifest). Separate main-only real 420ID two-account production and game-specific rule/AI acceptance are required before enabling any public Play. BC-1 next |
| BC-1 | IN PROGRESS (BC-1.1–BC-1.4 repository QUALIFIED; 0 playable releases) | [Rules](games/classics/BC-1-1-QUALIFICATION.md), [Engine](games/classics/BC-1-2-QUALIFICATION.md), [Bots](games/classics/BC-1-3-QUALIFICATION.md), [Frontend](games/classics/BC-1-4-QUALIFICATION.md) | BC-1.4 [3-job web/Go race/Chromium #45064416150](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45064416150) SUCCESS; [BC-0.12 release lock #45064416142](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45064416142) SUCCESS | BC-1.5 verified 420ID human multiplayer and bot/human live activation next; BC-1.6–BC-1.8 and public Play blocked |
| BC-1.1 | QUALIFIED (rules/variants only) | `7b4f91d20c0aaed80debe7711ed7163a43287b59` | [Rules and qualification record](games/classics/BC-1-1-QUALIFICATION.md); [exact-source 4/4 Node #44990794240](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44990794240) SUCCESS | BC-1.2 qualified; BC-1.3 next |
| BC-1.2 | QUALIFIED (deterministic rules backend only) | `50235be09204b0efee7e1f1a1d5e3404e2c85253` | [Engine qualification](games/classics/BC-1-2-QUALIFICATION.md); [exact-source Go race + 4/4 Node #44991914816](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44991914816) SUCCESS; [BC-0.12 all three jobs #44991600382](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44991600382) SUCCESS | BC-1.3 AI now qualified; BC-1.4 dedicated UI next, no production account match or activation |
| BC-1.3 | QUALIFIED (Easy/Medium/Hard source only) | `8f4c87ff69c0c9856765984d249555c506f85f86` | [Bot qualification and privacy evidence](games/classics/BC-1-3-QUALIFICATION.md); [exact-source 5 Go race groups and vet #44993822536](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44993822536) SUCCESS; six complete 2/3/4-player bot-v-bot and human-v-bot replay-qualified simulations | BC-1.4 interface now qualified; no production account match or Play release; BC-1.5 next |
| BC-1.4 | QUALIFIED (player frontend repository only; 0 playable public releases) | `66363f6bfc79ad89b52b0be2bcf8792944fbcf8e` | [UI/board/browser qualification](games/classics/BC-1-4-QUALIFICATION.md); [exact-head 7 Node tests, web package, Go race, 2p/3p/4p Chromium/axe and card-click acceptance #45064416150](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45064416150) SUCCESS; [inherited Classics zero-release gate #45064416142](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45064416142) SUCCESS | Approved leaf SVG + 120 holes/lane, 121 finish, leapfrog pegs, 1.5s confirmed score announcements, private hand/cut/discard/Go, responsive help/settings. No production Cribbage room activation or verified real two-account match; BC-1.5 next |
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
