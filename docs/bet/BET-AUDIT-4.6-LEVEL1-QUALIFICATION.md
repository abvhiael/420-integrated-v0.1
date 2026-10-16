# BET-AUDIT-4.6 — Blackjack V1 Level 1 qualification certificate

**Disposition: LEVEL 1 PASS, local executable scope.** This certificate does not authorize funded production play or certify a live deployment.

**Canonical step:** 4.6 — Blackjack V1: dealing, hand values, dealer rules, hits, stands, doubles and splits where supported, naturals, busts and payouts.

**Exact tested implementation SHA:** `ce5a337d7ab0db1ab57cf4c1f9397118988e6dc5`. **PR:** [#687](https://github.com/abvhiael/420-integrated-v0.1/pull/687), branch `audit/420bet-blackjack-4-6-level1-20261016`.

## Verified exact-SHA CI

- [Blackjack Level 1 run 38977458577](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38977458577), **PASS: 59 tests across 12/12 mandatory suites**, job `117230225601`. Job log: `Qualified input SHA: ce5a337d7ab0db1ab57cf4c1f9397118988e6dc5`, `Executed 59 tests across 12/12 mandatory suites`.
- [Solidity Contracts 38977458564](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38977458564): PASS.
- [Keno Level 1 38977458431](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38977458431): PASS.
- [Plinko Level 1 38977458507](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38977458507): PASS.
- [Roulette Level 1 38977458418](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38977458418): PASS.
- [ReferenceSlot Level 1 38977458523](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38977458523): PASS.
- [Dice Client 38977458503](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38977458503): PASS.
- [Oracle audit qualification 38977458540](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38977458540): PASS.
- [Global Level 3 Artifact Preflight 38977458423](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38977458423): PASS (preflight only; **not** a full Level 3 qualification).
- [420Docs Qualification 38977458447](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38977458447): SKIPPED, not counted as a PASS.

## Qualified behavior and scope

- Existing BlackjackV1420 six-deck European-no-hole-card rules, deterministic committed draw stream, player/dealer card values with soft aces, dealer stands on all 17, player hit and stand, bust and natural handling, push/loss/win, and 3:2 natural profit (5/2 gross) with exact even-base-unit stake requirements.
- V1 ruleset implements one hand and **does not support doubles or splits**. No inference of implementation or approval for unsupported actions.
- Immutable Blackjack resolver bound by authorized game-version registration; matching game/module/ruleset/registry; wagers admitted only through `placeBlackjackWager` with canonical parameters hash and exact maximum gross payout before nonce/stake/reserve mutations.
- Caller-selected generic `placeWager` and generic `settle` rejected for Blackjack; `settleBlackjack` reads only actual terminal hand outcome and gross payout. Adversarial tests demonstrate malformed admissions, forged settlements and premature settlements cannot release liability or stake escrow.
- Relevant changes: `contracts/src/bet/WagerRouter420.sol`, `contracts/src/bet/SettlementEngine420.sol`, `contracts/test/BetBlackjackVerticalSlice420.t.sol`, and `.github/workflows/420bet-blackjack-level1.yml`.

## Merge reconciliation / preservation

Before this evidence-only commit, the audit branch was 4 commits ahead and 14 behind `main`. All 13 changed paths introduced on intervening `main` are Budtender Phase 3.16 artwork names/assets, disjoint from this PR's contract/test/workflow modifications. No modified shared executable inputs or tests overlap. Qualified CI results are retained against their **actual tested SHA**; the certificate commit has its own SHA and must be verified as documentation-only. Merge readiness and resulting merged tree must be checked separately.

**Level 2:** Not required for this ordinary step. **Level 3:** Not started. **External/testnet gates:** Live funded provider/reveal/hand-settlement acceptance, production policy, compliance and risk approvals remain under `docs/420BET-TESTNET-WORK-ROADMAP.md`; no mocked fixture is live proof. **Next canonical step:** BET-AUDIT-4.7, only after 4.6 closure.
