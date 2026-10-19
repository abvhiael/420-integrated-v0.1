# BET-AUDIT-5A.3 — Durable exact-SHA Level 1 qualification

**Step:** Player seating, buy-ins, top-ups and chip accounting.
**Disposition:** Scoped Level 1 PASS for local ERC-20-backed seating and chip accounting. Does not qualify live custody, hand settlement or production release.

| Evidence | Verified |
| --- | --- |
| Repository | `abvhiael/420-integrated-v0.1` |
| Implementation SHA | `9884dbfd5fb28a4b44e0e538fefd381f2d3258ce` |
| Initial reconciliation base | `ede76e83971cbe5f3cb980b104ed3d1ac62ac320` |
| Branch | `audit/420bet-5a-3-seating-chip-ledger-20261018` |
| PR | https://github.com/abvhiael/420-integrated-v0.1/pull/739 |
| Level 1 workflow | `420Bet Poker Seating 5A.3 Level 1` |
| Run | https://github.com/abvhiael/420-integrated-v0.1/actions/runs/39189723255 |
| Job | `117859656405` |
| Conclusion | `completed/success` |
| Tests | **22 passed, 0 failed, 0 skipped**: `PokerSeatLedger53Test` 15/15 and `BetPokerTableRegistry52Test` 7/7 |

## Qualified implementation and scope

- `contracts/src/bet/PokerSeatLedger420.sol`: player-bound seats with uniqueness, seating epochs and sit-out state, rule-bound buy-ins and capped top-ups, token-backed escrow with exact balance-delta checks, chip totals, non-reentrant payout on exit and rejection of duplicate leave.
- Per-table action capability enforcement for buy-in, top-up, sit-out, leave and withdraw. Active table/operator and canonical poker new-table emergency halt restrict new deposits. Paused/closed table cashout remains available subject to explicit permissions.
- `contracts/test/BetPokerSeatLedger53.t.sol`: funded chip/escrow conservation, duplicate seats, bounds, authorization revocation, emergency and pause safety, successful and rejected withdrawals; also inherits 5A.2 lifecycle tests.
- `.github/workflows/420bet-poker-5a-3-level1.yml`: exact-SHA scoped Foundry qualification, including the previous table-registry regression.

## Qualification preservation and external boundaries

The evidence commit changes documentation only and does not replace the tested implementation SHA. Preserve the passing workflow/job without rerunning because of this certificate. Before merging, check actual divergence with current `main`; only materially overlapping changes warrant fresh scoped qualification.

No hand engine, private shuffle, funded pot settlement, production wagering entitlement, independent legal/risk approval or live network acceptance is established. Those gates remain under `docs/420BET-TESTNET-WORK-ROADMAP.md` and later canonical 5A steps. Level 2 and Level 3 have not been initiated.
