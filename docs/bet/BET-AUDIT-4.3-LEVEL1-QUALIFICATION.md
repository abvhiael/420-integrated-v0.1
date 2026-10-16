# 420Bet BET-AUDIT-4.3 — Level 1 qualification certificate

**Roadmap step:** 4.3 — Plinko V1: verify board configuration, deterministic ball paths, payout slots, multiplier commitments and settlement.

**Level:** 1, ordinary app-audit step.

**Qualified implementation SHA:** `af3f70ba3d631818b50d4b97f3cd61588f5ac4c1`

**Reconciliation base (current main at comparison):** `375d11f9df22a5062bd4a9a52f463c16103067f6`. The branch compared **5 commits ahead and 0 behind** main; GitHub indicated mergeable.

## Requirements and implementation

- Retained deterministic 12-row Plinko board, one left/right path decision per row, 13 payout buckets, and binding of complete payout slots to the immutable wager params hash.
- Added `PlinkoPaytableAuthority420`: immutable game-version, ruleset, version, manifest and multiplier schedule digest; capability-governed, single-use activation and exact per-slot payout validation.
- `WagerRouter420` now rejects legacy generic Plinko wagering and verifies Plinko payouts and maximum gross liability **before** stake escrow, nonce consumption or risk reservation.
- `SettlementEngine420` rejects generic caller-selected Plinko payouts and derives terminal outcome and amount from `PlinkoV1420.resolve`.
- End-to-end negative tests reject forged payout terms and forged settlement while asserting unchanged player escrow, nonce and bankroll liabilities.

## Exact-SHA qualification

All listed workflows were automatically triggered at the above executable SHA. No repeat global Level 3 dispatch was performed.

| Owner | Run | Conclusion |
|---|---|---|
| 420Bet Plinko Level 1 | [38924125088](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38924125088) | **PASS** — 60 tests in **12/12** mandatory suites |
| Solidity Contracts | [38924124840](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38924124840) | **PASS** |
| Dice Client | [38924124865](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38924124865) | **PASS** |
| 420Bet Keno Level 1 | [38924125274](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38924125274) | **PASS** |
| 420Oracle audit qualification | [38924125485](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38924125485) | **PASS** |

420Docs was automatically skipped and is not treated as a Level 1 PASS.

## Qualification / release boundary

The qualification certifies executable local Plinko acceptance, outcome reconstruction, settlement and negative security checks—not a production payout-policy approval or live-network acceptance. Independently authorized production multipliers, applicable jurisdictional permissions, testnet/prod deployment receipts and live consumer proof are separate release gates. No production wagering or capital movement is authorized here.

This certificate is **evidence-only**. Its commit SHA is different from the qualified implementation SHA and inherits the above evidence without claiming tests ran on the evidence commit. No Level 2 or Level 3 closeout is claimed.

**Next canonical roadmap step:** BET-AUDIT-4.4, only after the step is merged or otherwise closed under repository policy.
