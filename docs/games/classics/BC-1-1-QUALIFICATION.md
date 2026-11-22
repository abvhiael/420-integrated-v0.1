# BC-1.1 — Cribbage rules and variants qualification

**Status:** QUALIFIED for BC-1.1 *specification only*. The BC-1 game itself is NOT playable, released or deployed.

## Pinned authoritative contract

- Rules: [BC-1-1-CRIBBAGE-RULES.md](BC-1-1-CRIBBAGE-RULES.md).
- Machine-readable variants: [BC-1-1-CRIBBAGE-VARIANTS.json](BC-1-1-CRIBBAGE-VARIANTS.json).
- New off-chain ruleset: **bc-cribbage-standard-121@1.0.0**, independent from frozen BG-15 cribbage-standard versioning.
- UTF-8 manifest SHA-256 (exact bytes, including final newline): **a2b6e4695d27555546fc1b8d43e54e33c2dfba3aa50c6103393db32575d86cec**. Git blob SHA-1: **e97822a5fb9e11fb63e52483b8a7d8f57d9b3243**.
- First complete implementation source: **7b4f91d20c0aaed80debe7711ed7163a43287b59** on feature/bc-1-1-cribbage-rules.
- [Exact-source focused GitHub Actions run **#44990708529**](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44990708529): **SUCCESS**, all steps, including SHA assertion, Node 22, four focused Node tests.

## Verified test matrix

| Check | Result |
| --- | --- |
| Independent off-chain ruleset ID/version, separate BG-15 authority, machine manifest parsing and documented identity | PASS |
| Two-/three-/four-handed seat maps, opposite-seat teams, dealing/discarding/crib arithmetic and card conservation | PASS |
| Pegging and show award constants, heels, auto-count policy, 121-point finish and 60/61/90/91 skunk boundaries | PASS |
| First dealer, Show and reset ordering, reconnect/replay policy, explicit rejection of Russian/muggins/4p cutthroat variants, rulebook coverage | PASS |

All four tests also passed in local Node 22. The canonical GitHub workflow reruns only the focused specification test, and validates the exact branch commit under test. Existing seven-type on-chain rule descriptor, game menus, API, ledger and deployment paths are unchanged.

## Scope and next gate

BC-1.1's deliverables are normative *decisions*, not a scored playable engine. Neither zero-wager account-game Play nor a wallet-linked match was activated. No new reward or 420Bet authority was introduced. No real two-account matches, bot games, mobile play or live deployment is claimed. The next canonical step is **BC-1.2 deterministic game engine**, which must implement state validation, deck/deal/replay, pegging/Go, hand/crib scoring and full deterministic fixtures for **all 2-, 3- and 4-player** variants before any later BC-1 stage is started. BC-1 remains in progress; BC-2 remains blocked behind the complete BC-1 release gate.
