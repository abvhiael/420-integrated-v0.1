# BET-AUDIT-5.7 — Durable exact-SHA Level 1 and Level 2 qualification

**Canonical step:** 5.7 — Adversarial hardening, cross-game convergence and targeted qualification.

**Disposition:** Level 1 PASS; cross-game Level 2 PASS on the same implementation SHA. Not a Level 3 phase-closeout certificate or live-testnet approval.

| Field | Verified evidence |
| --- | --- |
| Repository | `abvhiael/420-integrated-v0.1` |
| Implementation SHA (immutable) | `35841f36ec2886dfc3441155ab1e99b6c54a174c` |
| Branch | `audit/420bet-video-poker-5-7-hardening-convergence-20261018` |
| PR | https://github.com/abvhiael/420-integrated-v0.1/pull/733 |
| Initial branch base | `3c488fcc64190490acc0f79e51d9f1d9f24dceae` |
| Level 1 workflow | 420Bet Video Poker Adversarial Convergence Level 1 |
| Level 1 run / job | https://github.com/abvhiael/420-integrated-v0.1/actions/runs/39172298904 / `117813206577` |
| Level 1 verified result | 45 passed, 0 failed: VideoPokerHardening57Test 33/33, BetSettlementEngine420Test (Video Poker) 3/3, BetVideoPokerPaytable54Test 7/7, BetCasinoConvergence420Test 2/2 |
| Level 2 workflow | 420Bet Cross-Game Level 2 |
| Level 2 run / job | https://github.com/abvhiael/420-integrated-v0.1/actions/runs/39172298962 / `117809823177` |
| Level 2 verified result | 127 passed, 0 failed, across 19/19 canonical casino, settlement, risk, randomness, solvency and invariant suites |
| Total reported scope | 172 passing test invocations across both workflows; overlapping tests are not asserted to be distinct |

## Scope and exit evidence

- `VideoPokerViewsV1420.inspect` rejects forged terminal results, outcome substitutions, mismatched recorded gross payouts and non-exact VOID stake refunds; terminal VOID is inspectable only after immutable wager identity, game version, ruleset, committed parameters and recorded settlement checks.
- `VideoPokerV1420.validateWager` remains unchanged and rejects terminal VOID wagers for active game entry; no authorization broadening, replay or payout-state mutation.
- `VideoPokerHardening57Test` verifies the terminal refund path, wrong versions/rulesets and parameters, cross-game version separation, absence of fabricated unrevealed outcomes, and independent result integrity. Inherited 5.3/5.6 lifecycle and authority tests remain included.
- Level 1 also tests funded Video Poker settlement, paytable and casino version compatibility; Level 2 runs the retained 19-suite convergence inventory against the exact same SHA.
- Qualified implementation files: `contracts/src/bet/VideoPokerViewsV1420.sol`, `contracts/test/VideoPokerHardening57.t.sol`, `.github/workflows/420bet-video-poker-5-7-level1.yml`.

## Inherited exact-SHA evidence

The certificate commit is documentation-only. Its commit SHA is evidence metadata, **not** a replacement for the qualified implementation SHA. Do not rerun Level 1 or Level 2 solely because this document was added. Compare with current `main` and verify mergeability before merging; only materially overlapping changes require scoped reconsideration.

## External acceptance boundaries

Independent provider/key control, live-testnet commitments and receipts, funded settlement, independent mathematical and bankroll approvals, release/legal/operator authority and production controls remain on `docs/420BET-TESTNET-WORK-ROADMAP.md`. Simulated results do not constitute live qualification. Level 3 has not been performed for this step and is governed by the canonical phase-boundary policy.
