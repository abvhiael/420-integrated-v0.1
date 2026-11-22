# BC-1.2 — Deterministic cribbage rules-engine qualification

**Status:** QUALIFIED as a repository/backend rules engine. **NOT deployed, registered for production rooms, or publicly playable.**
**Qualified engine source SHA:** `d829d52cb768a6b134bc5a3869ca6450c0c2c752` (includes the rules module, enforced room teams, optional seat policy and scoped tests).
**Frozen product contract:** `bc-cribbage-standard-121@1.0.0`; `BC-1-1-CRIBBAGE-VARIANTS.json` SHA-256 `a2b6e4695d27555546fc1b8d43e54e33c2dfba3aa50c6103393db32575d86cec`.
**Internal BC-0.7 adapter version:** `v1.0` (its strict version syntax), distinct from the BG-15 wallet/on-chain `cribbage-standard@1.0.0`.

## Engine and integration delivered

- `services/bong-goggles-account-social/classic_cribbage.go`: qualified `RuleModule` / `NewCribbageRulesAdapter`; seed-domain-separated dealer cuts (lowest rank, ties recut), 52-card Fisher–Yates shuffles, rotating clockwise dealer, 2p/3p/4p deals (including the extra hidden three-player crib card), forced discard counts, cut and starter, instant heels, pegging/Go/31 resets, rank-based pairs and longest suffix runs, automatic complete hand/crib scoring, ordered show, first-to-121 terminal outcome and skunk classifications. Team scores stay equal for opposite-seat partners. Exact card inventory and deterministic shuffle are validated on every saved state.
- `services/bong-goggles-account-social/classic_rooms.go`: four-seat Cribbage now joins the partnership room mapping `[0,1,0,1]` rather than erroneously using four separate scores. Two- and three-seat rooms remain individual.
- `services/bong-goggles-account-social/classic_rules_framework.go`: optional `RuleSeatPolicy` at initial match authorization, preserving previous adapters. The cribbage implementation rejects an inconsistent room seat/team assignment before dealing.
- `services/bong-goggles-account-social/classic_cribbage_test.go`: focused Go scoring fixtures, deterministic full games, replay and tampering, hidden-card views, invalid actions, instant-winning heels and 31, and wrong-team rejection for every supported seat count.
- `.github/workflows/bc-1-2-cribbage-engine.yml`: exact-commit checkout, Go race-qualified focused test group, frozen BC-1.1 Node contract regression. No game Play flag or bot policy registered.

**[BC-1.2 exact-source workflow #44991600408](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44991600408): SUCCESS**. All six focused Go test groups passed under `go test -race -count=1`, plus 4/4 frozen Node specification tests. The Go scorer passed the canonical perfect-29, double-run, double-double-run, zero, hand/crib flush and nobs fixtures. The component fixture for crib five-flush and nobs correctly counts additional independent fifteens in the **total**; it does not confuse component points with entire-hand points. Deterministic full-match results:

| Seats | Accepted actions | Completed rounds | Final scores / winning seat |
| --- | ---: | ---: | --- |
| Two individuals | 154 | 12 | `[118,123]`, winner 1 |
| Three individuals | 275 | 14 | `[108,109,126]`, winner 2 |
| Four opposite-seat partners | 218 | 8 | `[93,121,93,121]`, winner 3 (team 1) |

All three replayed the identical final state from their server-private initial seed and sequence-bound private action journal; altered event digests were denied. The terminal win from **31 exactly** preserves the winning count rather than falsely resetting it, and winning heels stop play before any pegging.

## Retained shared regression on the same source SHA

- [BC-0.5–0.10 Account Rooms, Sessions, Rules, Bots and Communications #44991600366](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44991600366) — **SUCCESS** (PostgreSQL 16 and Go race integration).
- [BC-0.12 Classics Test and Release Qualification #44991600382](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44991600382) — **SUCCESS**, all three jobs, including Chromium, property, account integration and zero-release safety.
- [Bong Goggles CCC Account Multiplayer #44991600431](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44991600431) — **SUCCESS**.
- [AUTH-8/9/10/11 Wallet-Independent BongGoggles Social #44991600378](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44991600378) — **SUCCESS**.

## Security and release boundary

This is a server-side deterministic rules **module**, not a new account-game deployment. It uses the BC-0.7 cryptographic seed, strict codec, private journal, event-hash verification and authorized per-seat `View` contract. Deck, cut candidates, concealed crib, opponent hands and shuffle seed cannot be obtained from another seat's view; invalid/disallowed actions fail before mutation. Public game/session event streams remain metadata-only. `maxRulesMoves=512` is the frozen BC-0.7 service replay budget and is **not weakened** by this step: the representative complete 121-point matches qualify beneath that budget, while unusually long production matches require bounded extended-journal qualification as part of later account multiplayer/recovery acceptance before live release. The backend engine itself does not impose a round cap, fake winner or substitute hand.

No Easy/Medium/Hard Cribbage AI, dedicated game screen, production resolver registration, wallet/on-chain ruleset change, wagering/reward coupling, real deployed 420ID match or public release is claimed. The catalogue remains `registry`/locked.

**Next canonical step: BC-1.3 — Easy, Medium and Hard computer-opponent policies**, not begun by this change. BC-1.4–BC-1.8 remain incomplete; BC-2 is not unlocked.
