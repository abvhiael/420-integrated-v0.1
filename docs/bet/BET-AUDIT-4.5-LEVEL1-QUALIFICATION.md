# BET-AUDIT-4.5 — Roulette V1 Level 1 qualification certificate

**Status: LEVEL 1 PASS — local executable audit scope.** No production wagering or deployment authority is granted.

**Canonical step:** BET-AUDIT-4.5 — European single-zero Roulette V1: inside/outside bets, zero, gross payout precision, canonical randomness and settlement.

**Exact tested implementation SHA:** `8647eb4238f608c6c8be3ff6e940322404447019`. **PR:** [#683](https://github.com/abvhiael/420-integrated-v0.1/pull/683), branch `audit/420bet-roulette-4-5-level1-20261016`.

## Verified CI at exact SHA

| Mandatory/applicable check | GitHub run | Conclusion |
| --- | --- | --- |
| Roulette Level 1 | [38956330078](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38956330078) | **PASS — 61 tests, 12/12 suites**, job 117163575431 |
| Solidity Contracts | [38956330136](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38956330136) | PASS |
| 420Bet Dice Client | [38956330402](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38956330402) | PASS |
| Keno Level 1 | [38956330326](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38956330326) | PASS |
| Plinko Level 1 | [38956330171](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38956330171) | PASS |
| ReferenceSlot Level 1 | [38956330225](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38956330225) | PASS |
| Oracle audit qualification | [38956330087](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38956330087) | PASS |
| Global Level 3 artifact preflight | [38956330298](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38956330298) | PASS (preflight only, **not** phase Level 3 qualification) |
| 420Docs Qualification | [38956330260](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38956330260) | SKIPPED, not a PASS |

Roulette job log states:
```
Qualified input SHA: 8647eb4238f608c6c8be3ff6e940322404447019
Executed 61 tests across 12/12 mandatory suites
```

## Qualified implementation

- Deterministic European single-zero pocket `0..36` generated from the wager's canonical randomness root; reproducible root-to-pocket result.
- Existing V1 bet kinds: straight-up number (including 0), red/black, even/odd, low/high, dozen and column. Canonical zero treatment, validated selections and outcome replay.
- Exact gross payout multipliers: straight 36x, dozen/column 3x, remaining outside selections 2x. Risk reservation bounded before acceptance; for a 100-unit 2x bet net liability is 100.
- Immutable game-version resolver binding at wager router; accepted parameters hash and required gross cap must match canonical Roulette V1 before nonce, escrow or reserve mutation. Generic Roulette `placeWager` is forbidden.
- Canonical `settleRoulette` computes outcome and payout from registered immutable rules, not caller-supplied economic values. Generic Roulette settlement is forbidden. Forged attempts leave escrow and liability untouched.
- Targeted end-to-end and adversarial tests plus updates to `testnet/runbooks/420BET-ROULETTE-V1-SMOKE.md`.

**Scope limitation:** V1 does not implement split, street, corner, six-line or other multiple-pocket inside bets. This certificate does not assert those bet types have been implemented or approved, and does not silently expand V1 beyond its canonical supported selections.

## Production and testnet release gates

See `docs/420BET-TESTNET-WORK-ROADMAP.md`: independent operator/economic and bankroll approval; jurisdiction restrictions; promoted manifest and reviewed roles; verified runtime bytecode, game/version/resolver and provider bindings; funded and independently replayed live wagers, randomness and settlement; required incident/expiry/void acceptance. Placeholder deployments or local mocked integrations are not live evidence.

## Qualification & reconciliation

**Level 1:** PASS for this executable scope. **Level 2:** Not requested at this ordinary step. **Level 3:** Not initiated. Global artifact preflight success does not equal Level 3 success.

Before the certificate commit, `main` contained three newer commits affecting only `assets/budtender/phase-3.16/`; those do not overlap the Roulette implementation or its executable qualification inputs. Passing results are preserved; no repeat CI or global qualification requested. A separate evidence-only certificate commit changes documentation only and inherits exact qualified implementation SHA subject to verifying that diff.

**Merge eligibility:** subject to GitHub branch policy / review and final current-main comparison. The merge outcome must be verified separately. **Next canonical step:** BET-AUDIT-4.6, only after 4.5 closeout.
