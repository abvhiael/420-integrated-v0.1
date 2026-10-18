# BET-AUDIT-5.5 — Exact-SHA Level 1 Qualification Certificate

**Canonical step:** 5.5 — Implement wager liability, payout calculations and canonical settlement.

**Disposition:** Scoped Level 1 PASS for the frozen tested implementation SHA; no independent production or official-testnet acceptance asserted.

- **Repository:** `abvhiael/420-integrated-v0.1`
- **Qualified implementation SHA:** `1f994348ca5376e8f3c4d126e9a4818896c49119`
- **Workflow:** 420Bet Video Poker Liability and Settlement Level 1
- **Run:** https://github.com/abvhiael/420-integrated-v0.1/actions/runs/39099628996
- **Job ID:** `117593051897`
- **Conclusion:** completed / success; 32 passing and zero failing tests.
- **Suites:** funded Video Poker settlement/expiry/liability 3/3; secure draw and adversarial 22/22; paytable and classification 7/7.

## Qualified changes

The canonical SettlementEngine420 checks that a Video Poker wager's active risk reservation matches the immutable accepted wager ID, vault, game version, risk profile, stake and covered gross exposure before funds, fees or recorded outcome are mutated. The funded expiry fixture uses the correct game version. An additional adversarial funded test verifies that a cross-version reservation is rejected without any payout, reserve release, fee finalization or settlement recording. Existing 5.3/5.4 payout/draw regressions remain covered.

## Evidence identity and inheritance

This certificate is documentation-only. The actual qualified executable input is the implementation SHA recorded above, not the subsequent evidence commit. Preserve the successful scoped CI without rerunning it solely for this non-executable certificate. Material changes to tested contracts, tests, workflow, dependencies, interfaces or deployment inputs require explicit qualification impact review.

## Remaining gates

Independent bankroll/liability and mathematical approvals, official testnet funded custody/settlement and expiry proofs, controlled replacement RNG authority, external legal/operator/release approval and production activation remain OPEN in `docs/420BET-TESTNET-WORK-ROADMAP.md`. This certificate is not Level 2 or Level 3 and does not authorize real wagering.

## Merge integrity

Confirm current-main non-overlap, PR merge eligibility and that the final merged tree retains the qualified source and certificate. Record the merge commit separately.
