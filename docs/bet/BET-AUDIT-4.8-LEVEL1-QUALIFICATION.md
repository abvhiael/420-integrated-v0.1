# BET-AUDIT-4.8 — Crash V1 Level 1 qualification certificate

**Disposition:** Level 1 PASS — locally executable Crash V1 audit scope. This is not authorization for production or live wagering.

**Canonical requirement:** 4.8 Crash V1 — verify deterministic crash points, multiplier progression, committed auto-cashout, timing boundaries and payout safety.

**Exact qualified implementation SHA:** `2f2bdf0bcd49f3841b2770116eaea56b8390c756`.
**Branch:** `audit/420bet-crash-4-8-level1-20261016`. **PR:** [#691](https://github.com/abvhiael/420-integrated-v0.1/pull/691).
**Reconciliation:** At certificate preparation branch was five commits ahead of current `main` and zero behind; no intervening main changes.

## Successful exact-SHA GitHub Actions evidence

| Workflow | Run ID | Disposition |
| --- | --- | --- |
| Crash Level 1 | [38993407701](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38993407701) | **PASS: 68 tests in 12/12 mandatory suites** |
| Solidity Contracts | [38993407634](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38993407634) | PASS |
| Global Level 3 Artifact Preflight | [38993407623](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38993407623) | PASS preflight only; not Level 3 qualification |
| Dice Client | [38993407611](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38993407611) | PASS |
| Keno Level 1 | [38993407647](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38993407647) | PASS |
| Mines Level 1 | [38993407615](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38993407615) | PASS |
| ReferenceSlot Level 1 | [38993407670](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38993407670) | PASS |
| Roulette Level 1 | [38993407660](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38993407660) | PASS |
| Oracle audit | [38993407683](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38993407683) | PASS |
| Plinko Level 1 | [38993407653](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38993407653) | PASS |
| Blackjack Level 1 | [38993407620](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38993407620) | PASS |
| 420Docs Qualification | [38993407680](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38993407680) | SKIPPED, not PASS |

The Crash Level 1 job `117280501966` records `Qualified input SHA: 2f2bdf0bcd49f3841b2770116eaea56b8390c756` and `Executed 68 tests across 12/12 mandatory suites`.

**Retained Crash test suites:** BetCrashV1420, BetCrashProgression420, BetCrashSettlementAdapter420, BetCrashViewAdapter420, BetWagerAcceptance420, BetRandomness420, BetRandomnessTerminal420, BetSettlementEngine420, BetBankrollRisk420, BetTerminalPathInvariant420, BetCasinoSettlementInvariant420 and BetCasinoSolvencyConvergence420.

## Implementation and safety invariants

- Crash V1 uses wager-, version-, ruleset- and randomness-root-bound deterministic crash points, capped multipliers and monotone time progression.
- Parameter commitment restricts V1 to precommitted **auto-cashout only**. Manual cashout remains disabled because public randomness would otherwise enable unfair after-reveal decisions.
- WagerRouter420 immutably binds canonical Crash resolver by game-version, rejects generic Crash wager admission and enforces exact committed payout reservation and pre-funds checks.
- SettlementEngine420 immutably binds canonical Crash resolver, rejects generic caller-selected Crash outcomes and derives terminal auto-win or crash-loss and payout from canonical session only; enforces configured liability ceiling.
- CrashSettlementAdapter420 forwards to `settleCrash(wagerId)`; adapter regression mocks were updated to retain terminal/payout/authority assertions.
- Dedicated `.github/workflows/420bet-crash-level1.yml` owns exact-SHA Crash and shared security qualification.

**Changed executable paths:** `contracts/src/bet/WagerRouter420.sol`, `contracts/src/bet/SettlementEngine420.sol`, `contracts/src/bet/CrashSettlementAdapter420.sol`, `contracts/test/BetCrashSettlementAdapter420.t.sol`; qualification workflow `.github/workflows/420bet-crash-level1.yml`.

## Qualification boundaries and downstream obligations

**Level 2:** not invoked for this ordinary audit step. **Level 3:** not invoked; preflight PASS is not a Level 3 certificate.

**Deferred independent live/testnet acceptance:** trusted live randomness-provider and fallback evidence, deployed access/authorization, bankroll and economic math sign-off, casino jurisdiction/age/identity controls, production treasury custody, safe round timing/latency, external timing/oracle validation, operator rollout authorization and real-network payout reconciliation. Track these through the canonical 420Bet testnet work roadmap; mocked/stubbed local integrations are not production acceptance.

**Evidence inheritance rule:** this certificate must be committed as documentation-only; its SHA is separately recorded as the evidence SHA. No executable input, tests, workflow, fixtures or configuration may change as part of that evidence commit. Completed exact-SHA CI evidence is retained without reruns. Merge after verifying the actual diff and current-main eligibility.
