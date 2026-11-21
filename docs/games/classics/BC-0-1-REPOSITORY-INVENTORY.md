# BC-0.1 — Repository reconciliation and reusable-component inventory

**Scope:** BC-0.1 only — inspect and reconcile the game platform baseline, not implement BC-0.2 or launch new games.
**Evidence snapshot:** `main` at `1cd6ceb5fe5f6bc47ae7662ab2d4b14a776f0eb0` (2026-11-21; authoritative source inspection).
**Repository:** [abvhiael/420-integrated-v0.1](https://github.com/abvhiael/420-integrated-v0.1).
**Result:** Source-backed inventory and reuse decisions completed. No gameplay, deployed service, new ruleset or production readiness is asserted by this inventory.

## 1. Branch and delivery reconciliation

| Item | Verified repository position | Reconciliation consequence |
| --- | --- | --- |
| Current `main` | `1cd6ceb5fe5f6bc47ae7662ab2d4b14a776f0eb0` at initial inventory snapshot | All source claims below were checked against `main`; later commits require a new inventory check if relevant files changed. |
| BG-15 games foundation | [PR #321](https://github.com/abvhiael/420-integrated-v0.1/pull/321) **merged** 2026-09-17 | Treat the seven-session/ruleset foundation as reusable, not as complete playable games. |
| BG-19 web application | [PR #350](https://github.com/abvhiael/420-integrated-v0.1/pull/350) **merged** 2026-09-20 | Existing master roadmap's September "PR #350 open" wording is a historical snapshot, not current status. |
| Cross-Country Chaos CCC-5 | Merged to `main`; `core/cross-country-chaos.js` and `ccc-5-championship.test.js` present | Preserve stage, championship and finish-latch behaviour. |
| CCC-6 | [PR #1313](https://github.com/abvhiael/420-integrated-v0.1/pull/1313) **open, unmerged** at inventory time | Save/resume, replay journal and mobile controls described by that PR must NOT be claimed present on `main`. Do not overwrite, cherry-pick or merge it as part of BC-0.1. |
| New Classics program | [Canonical roadmap](../../BONG-GOGGLES-CLASSICS-ROADMAP.md), BC-0 through BC-25 | BC-0.1 is inventory only; BC-0 remains incomplete until all twelve platform gates, including real service qualification, pass. |

## 2. BG-15 contract and game-service inventory

| Source | What exists and can be reused | Hard boundary / implementation gap |
| --- | --- | --- |
| `contracts/src/bonggoggles/BongGogglesGameSessionRegistry420.sol` | Canonical on-chain `invite`, `accept`, `decline`, `commitMove`, `finish`, `cancel`; session/player identity, two players, immutable `rulesetHash`, randomness reference, strictly monotonic move number, move commitments, winner, lifecycle, events and zero-wager rejection. | Exactly seven enum values: `CRIBBAGE`, `RUSSIAN_CRIBBAGE`, `CHESS`, `WORD_GAME`, `CHECKERS`, `BACKGAMMON`, `DOMINOES`. Does not implement rules, bot seats, account UUIDs, 3–4 player tables or wagering. Do **not** expand enum in place or reinterpret a wallet address as 420ID. |
| `contracts/src/bonggoggles/BongGogglesAuthorization420.sol`, `BongGogglesProfileRegistry420.sol`, `BongGogglesRelationshipGraph420.sol`, `BongGogglesSocialPolicy420.sol` | Actor capabilities, active-profile, blocked-relationship and invite eligibility checks used by the on-chain registry | Keep canonical authorization; off-chain account matches require independently enforced current 420ID/profile/block policies. |
| `services/bong-goggles-games-v1/src/sessionProjection.js` | Normalizes on-chain game sessions; participant-policy projections; game-list grouping; invite/action intent builder; resolver | Expects wallet addresses and two-party on-chain sessions; cannot authorize UUID-based account matches. |
| `src/rulesetRegistry.js` and `src/v1Rulesets.js` (same service) | Versioned descriptor registry, rule hash resolution, deterministic stable-JSON move/state codec, digest and replay that accepts a caller-supplied reducer; seven fixed v1 descriptors | **No actual cribbage/chess/etc. legal-move generator or scoring reducer is present here.** Factories instantiate generic `DeterministicClientEngine`; the "seven engines" are metadata/replay scaffolding, not playable rules. |
| `src/moveCommitmentBridge.js` | Canonical move sequence, payload hashing, commitment replay and divergence rejection | Depends on canonical wallet/session evidence; no online off-chain per-game move processor or multiplayer network transport. |
| `src/gameExperience.js` | Challenge/rematch intents, game card and turn/clock projections | Presentation/intents, not a durable multi-seat account lobby or engine. |
| `src/randomnessHiddenState.js` | On-chain randomness-reference binding and commitment/reveal validation | Must not leak concealed draws; a separately authorized cryptographic server RNG is needed for account games. |
| `src/historyDiscovery.js` | Finished-session history, statistics, leaderboards, social/profile discovery projections | Outputs derive from verified canonical source. Do not silently combine off-chain game outcomes with chain-backed rewards or standings. |
| `src/spectatorPresenceMessaging.js` | Public-only spectator projection, presence and verified 420Messenger route binding | Private hands must stay excluded; account game chat is not an authorization shortcut. |
| `src/integrityHardening.js` | Rechecks current player/profile/block eligibility; rate limits; state reconciliation; telemetry redaction; zero-wager checks | Reuse patterns but not wallet identity assumptions in account service. |
| `src/productionCloseout.js` | Bounded load-evidence and fault-drill evaluation | Qualification helpers are not real-world throughput or launch evidence. |

**Contract decision:** On-chain games retain `BongGogglesGameSessionRegistry420` as authority; ordinary 420ID Classics will have an explicit, separately verified server-side off-chain match authority with its own multi-seat schema. Neither surface may claim the other's identity, reward, wallet or result authority.

## 3. Existing 420ID account and session integration

| Source | Verified capability and secure integration boundary |
| --- | --- |
| `services/420id/account.go`, `auth.go`, `session.go`, `sso.go`, `sso_http.go` | 420ID owns off-chain account IDs, verified email/passkey, account sessions and scoped SSO. A consumer receives an app-specific UUID subject, **not** an Ethereum address or unrestricted internal 420ID account ID. |
| `services/420id/app-gateway/` | Approved app/client boundary and gateway implementation/tests; use the established SSO client registration and consent, not a new password system. |
| `services/bong-goggles-account-social/session.go` | Same-origin `/auth/start` and `/auth/callback` flow; HttpOnly Secure host-only app cookie; encrypted server-side SSO bearer; active-session introspection on each request and failure-closed revocation behaviour. |
| `services/bong-goggles-account-social/http.go` | Authenticated `/v1/me`, API dispatcher and SSO-backed caller identity; no caller-selected game actor; same-origin writes, bounded JSON and restricted edge gateway. |
| `bong-goggles/web/core/account-social.js`, `account-social-controller.js` | Bounded `/social-api` same-origin `credentials:'same-origin'` client; read-only retry for temporary service errors, not mutation replay. Reuse client transport and status model. |
| `bong-goggles/web/core/account-extras.js` | Existing wallet-independent account games page, verified-session checks, invite/view/respond/move controller, escaped UI and zero-rewards/zero-wager labels. Only the two existing quick-game rulesets are supported. |
| `bong-goggles/web/core/runtime-config.js`, `web/ACCOUNT-SOCIAL-BUILD-ACTIVATION.md` | Account-social and account-games switches depend on explicit activation; missing switches are disabled. Build opt-in `BG_ACCOUNT_SOCIAL_ACTIVATION=true` is distinct from actual deployed configuration. |
| `bong-goggles/cloudflare/social-proxy/` | Same-origin Cloudflare Worker route `bonggoggles.420integrated.org/social-api/*` to protected Render social service; separate edge secret, strict host trust and authenticated ingress. |

**Credential contract:** Keep the 420ID SSO token and app cookie out of JavaScript storage and gameplay messages. Games must always identify an actor from the verified backend session, recheck member blocking and authorization, and fail closed when SSO introspection is unavailable. Login uses the existing same-origin route `/social-api/auth/start`; game code must not invent new independent credentials.

## 4. Existing off-chain games service and API inventory

**Implementation:** `services/bong-goggles-account-social/account_games.go`, `account_extras_http.go`, `store.go`, migration `migrations/002_account_messages_games.sql`.

**Existing games:** `tic_tac_toe` (3×3, three-in-a-row) and `connect_four` (7×6, four-in-a-row); strictly **two human 420ID members** in a persisted PostgreSQL match. Server controls invitations, responses, moves, legal-cell/column validation, expected move number, row locks, blocking checks, terminal status and move history. No Classics engine, bots, multi-seat partnerships or shared ruleset registry currently exists in this service.

| Same-origin public browser path | Method | Implemented behaviour |
| --- | --- | --- |
| `/social-api/auth/start` | GET | Begin central 420ID SSO redirect (cookie-bound state and PKCE). |
| `/social-api/auth/callback` | GET | Redeem approved one-time 420ID auth flow and issue scoped app session. |
| `/social-api/v1/me` | GET | Resolve current authenticated app member; denies missing/revoked session. |
| `/social-api/auth/logout` | POST | Invalidate app session, attempt central revocation. |
| `/social-api/v1/account-games` | GET | List caller-accessible account games, never unrelated matches; `onChain:false,wager:false,rewards:false`. |
| `/social-api/v1/account-games` | POST | Invite `{target,kind}` for one of the two supported quick-game kinds. |
| `/social-api/v1/account-games/{id}` | GET | Authenticated participant detail and historical moves. |
| `/social-api/v1/account-games/{id}/respond` | POST | Invited player responds with `{accept:boolean}`. |
| `/social-api/v1/account-games/{id}/move` | POST | Active player's `{position,expectedMove}` with database conflict rejection. |

`account_extras_http.go` uses explicit 400/403/404/409/503 error states; failed/stale sessions are not accepted. The browser currently uses a feature flag and separate `/account/games` route; this is **not** `/games` and has no bots or 25-game catalogue integration.

**Existing chain-backed API status:** `bong-goggles/web/core/games.js` and `games-ui.js` normalize session *projections* and prepare wallet intents. `docs/BONG-GOGGLES-BG-19-9-IMPLEMENTATION.md` explicitly records that `app.js` does not yet load a qualified BG-15 games HTTP projection or enable live interactive boards. Do not infer a working BG-15 HTTP endpoint from helper functions or build flags.

## 5. Browser catalogue, navigation and Cross-Country Chaos

| Path | Verified behaviour / reuse |
| --- | --- |
| `bong-goggles/web/core/routes.js` | Fixed routing table and wallet-required `/games` route; public `/classics` and `/classics/cross-country-chaos`; public `/account/games` (own 420ID auth guard). `resolveRoute` matches exact listed paths only. |
| `core/games.js`, `core/games-ui.js`, `core/app-shell.js` | BG-19 seven-type wallet hub with incoming/outgoing invites, history and guarded session presentation. New challenge intentionally disabled without qualified canonical integration. `/games` is blocked for wallet-disconnected visitors. |
| `core/classics.js`, `core/classics-ui.js`, `web/classics.css` | Editorial Classics/Canadian Classics collections with explicit `planned`, `registry`, `local` states. At present only Cross-Country Chaos has a Play link from the Classics tiles. |
| `core/cross-country-chaos.js` | CCC-1 and CCC-5 local deterministic engine: three regional legs, 2–4 participants, hand/deck/hazard rules, scoring, championship finish latch. Maintains local state within a browser tab (not a durable server match). |
| `core/chaos-computer.js` | CCC-4 actual local legal bot choices `easy`, `normal`, `hard`, built from current player's hand and public board only. `advanceChaosComputerTurns` is bounded. Reuse legality, hidden-hand tests and AI architecture ideas; implement new Classics difficulty label `medium` without changing CCC's existing `normal` compatibility. |
| `core/chaos-board.js`, `chaos-results.js`, `chaos-game-effects.js`, `chaos-card-art.js` and `core/classics-ui.js` | Tabletop renderer, concealed-hand handoff, scores, finish effects and artwork mapping. Reuse design patterns and asset validation, not CCC-specific game rules. |
| `web/app.js` | Wires CCC gameplay/CPU as local browser state and account-games client through its own controller. No authorized real-time 25-game service, per-game server authority, matchmaking or bot service. |
| `web/assets/games/cross-country-chaos/{cards,maps,vehicles}/` | Approved CCC-specific art assets; maps include regional underlays/foregrounds and vehicles include six SVGs. Shared cards/tiles/boards for other games are not delivered by the presence of CCC images. |

**Catalogue gaps verified:** The current `classics.js` does not have a distinct `Scrabble` or complete `Yahtzee` catalogue entry. Instead it has legacy `WORD_GAME` (only in the seven-type BG-15 enum) and two editorial five-dice entries (one-row and six-row), omitting specified 2/3-row formats and a unified full scorecard. `/games` has no 25-title game listing and no game-detail routes for them. Fix as BC-0.2; avoid changing these in BC-0.1 to preserve the requested milestone order.

**CCC branch boundary:** CCC-6 PR #1313 proposes replayed save/resume and stronger mobile controls; it is not on `main` at the captured snapshot. Do not call `main` CCC crash-resumable until the PR is merged and qualified.

## 6. Existing regression tests and qualification entry points

| Family | Tracked tests | Behaviours covered in source |
| --- | --- | --- |
| Solidity canonical game authority | `contracts/test/BongGogglesCasualGames420.t.sol` | Invite/accept, immutable ruleset, zero wager, sequential move commitments, block precedence, legitimate finish/winner. |
| BG-15 service unit tests | `services/bong-goggles-games-v1/test/{sessionProjection,rulesetRegistry,moveCommitmentBridge,gameExperience,randomnessHiddenState,historyDiscovery,spectatorPresenceMessaging,integrityHardening,productionCloseout}.test.js` | Resolvers, hashes, stable codecs/replay, hidden-reveal, history, current policy, safe spectators, bounded closeout. |
| BG-19 browser games | `bong-goggles/web/test/games.test.js`, `app-shell.test.js` | Exactly seven legacy game types, zero wagers, guarded wallet hub, route permissions and fail-closed board. |
| 420ID | `services/420id/{auth_test.go,session_integration_test.go,sso_http_integration_test.go}`; `services/420id/app-gateway/client.test.mjs` | Passwordless auth, session/consent, SSO and app-gateway boundaries. Some Go integration suites require a designated database and build tags. |
| AUTH-9 account games | `services/bong-goggles-account-social/{account_extras_test.go,account_extras_integration_test.go}`, `bong-goggles/web/test/account-extras.test.js` | Deterministic quick games, invite/policy, outsiders, concurrent moves, replay rejection, 420ID consent and fail-closed frontend. |
| 420ID login and frontend recovery | `bong-goggles/web/test/420id-login-ui.test.js`, `account-social-wake-recovery.test.js` | Same-origin login controls, transient read-only retry, session expiry, auth security and no private cached posts. |
| CCC rules, AI, art and championship | `bong-goggles/web/test/{cross-country-chaos,ccc-2-card-deck,ccc-3-board,ccc-4-computer-players,ccc-5-championship,ccc-art-1-visual-style,ccc-art-2-regional-maps,ccc-art-3-vehicles,ccc-art-4-tabletop,ccc-art-5-scenery,ccc-art-6-game-effects,ccc-art-7-results,ccc-art-8-asset-qualification}.test.js` | CCC deck/game rules, legal no-peek CPU turns, hand privacy, finish latch, stage results and asset manifests. |
| Code-level CI workflows | `.github/workflows/{bong-goggles-games,bong-goggles-web,docs-qualify,auth-1-shared-account}.yml` plus related game/media/login checks | Existing verification targets; re-run only those impacted by real future code changes. |

**Evidence distinction:** CI and tests already present are *tracked test sources*. Their presence alone is not a claim that all suites were executed at this inventory SHA. As baseline, GitHub Actions `420Docs Qualification` [run #44947827020](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44947827020) completed successfully at `1cd6ceb5fe5f6bc47ae7662ab2d4b14a776f0eb0`. The preceding `Bong Goggles Web Verification` [run #44947108604](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44947108604) failed at earlier `0d09e75150858f9b2c4d4c17252232d6d458c526`; it was not re-run by this documentation-only BC-0.1 task and is not cited as a current exact-head result. The present commit's documentation check must be evaluated separately.

## 7. Reuse matrix for subsequent BC-0 tasks (NO implementation started here)

| Subsequent gate | Reuse | Current missing requirement |
| --- | --- | --- |
| BC-0.2 — Games menu | `routes.js`, `classics.js`, `classics-ui.js`, `games-ui.js`, design system | Public 25-title navigation and individual stable pages; maintain legacy chain games and existing Chaos aliases. |
| BC-0.3 — Shared UI | Current CCC handoff/tabletop and account-extra state components | Generic multi-game table, per-seat human/bot setup, rules/help, results and responsive components. |
| BC-0.4 — Auth | 420ID SSO, account-social app cookie/introspection, frontend session client | Bind unified Games route to 420ID identity while retaining separate wallet-qualified chain hub. |
| BC-0.5 — Invites/seating | Account Games invite/respond SQL locking, BG-15 challenge metadata | 2–4/more-person games, team seats, bot configuration, private/public rooms. |
| BC-0.6 — Off-chain authority | Postgres account-games store and transactions, BG-15 replay patterns | Generic authoritative multiseat game schema, server-side moves, persistence/recovery, result authorization. |
| BC-0.7 — Rules framework | BG-15 versioned codecs/hashes, CCC deterministic state machine | True per-title legal actions, transition and score engines; distinguish 420ID sessions from on-chain records. |
| BC-0.8 — AI | CCC easy/normal/hard heuristics with no hidden-peek testing | Per-title Easy/Medium/Hard policies and legal bot scheduler with compute bounds. |
| BC-0.9 — Shared visuals | CCC cards, results, handoff, artwork manifest, accessible components | Game-independent cards, dice, board pieces, Yahtzee scorecards and asset rights. |
| BC-0.10 — Realtime/recovery | Authenticated account-games HTTP & move history; BG-15 divergence/recovery helpers | Authorized push/update channel, reconnect state replay, server restart resume and cross-device play. |
| BC-0.11 — Integrity | BG-15 move/hidden commitments and zero-wager checks, AUTH-9 row locks/policy, SSO introspection | Correct cryptographic game RNG, hidden-per-seat views, bot isolation and anti-replay for all Classics. |
| BC-0.12 — Qualification | Existing Node/Go/Solidity/CCC suites and docs CI | Shared multiaccount E2E, game-specific rules/AI fixtures, release gates, exact-head production smoke. |

## 8. BC-0.1 completion evidence and unresolved next-step boundaries

The inventory requirement is met when the BC-0.1 artifact is committed, linked from the canonical roadmap, and verified for the exact main source snapshot above: BG-15 code, 420ID session, off-chain account games/API, web routes, CCC, tests, CI and pending CCC-6 are individually identified. No gameplay code was changed by this task, and existing statuses remain explicitly separated.

**Do not promote BC-0 or any BC-1+ game:** There is not yet a 25-game interactive frontend or multi-seat online account-game backend. Exact deployed SSO/proxy/flag health and 420ID two-account live browser journeys were **not** retested as part of this source inventory. They must be separately verified in their relevant implementation/release gates. The next assigned canonical step, when authorized, is **BC-0.2 — One coherent games menu**; do not start it as part of BC-0.1.

### Verified qualification (2026-11-21)

- **Inventory implementation SHA:** [`e399434763cf07d130d486cc05cfe18ae0d75b4e`](https://github.com/abvhiael/420-integrated-v0.1/commit/e399434763cf07d130d486cc05cfe18ae0d75b4e); the baseline source snapshot is the parent `1cd6ceb5fe5f6bc47ae7662ab2d4b14a776f0eb0`.
- **Exact-head documentation CI:** [420Docs Qualification run #44948290256](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44948290256) — **completed / success** at `e399434763cf07d130d486cc05cfe18ae0d75b4e`.
- **Triggered retained media regression:** [Bong Goggles Media Verification run #44948290241](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44948290241) — **completed / success** at `e399434763cf07d130d486cc05cfe18ae0d75b4e`.
- **Repository structural verification:** 18 critical contract/service/web/auth/test source paths retrieved successfully from `e399434763cf07d130d486cc05cfe18ae0d75b4e`; canonical and master roadmap references to this inventory were fetched and confirmed; all three changed files and their commit verified via GitHub.
- **Qualification scope:** documentation/source reconciliation only. No new gameplay tests, live multiaccount browser journeys, chain qualification, deployment promotion or CCC-6 merge are claimed. BC-0.1 is **QUALIFIED**; BC-0 remains **IN PROGRESS**, and BC-0.2 is the next unstarted milestone.
