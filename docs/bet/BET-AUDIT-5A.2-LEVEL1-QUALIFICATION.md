# BET-AUDIT-5A.2 — Durable exact-SHA Level 1 qualification

**Step:** 5A.2 — Table registry, creation, configuration and lifecycle.
**Disposition:** Scoped Level 1 **PASS** for the table-registry implementation; no live gameplay, custody, seating or deployment acceptance is claimed.

| Evidence | Verified value |
| --- | --- |
| Repository | `abvhiael/420-integrated-v0.1` |
| Qualified implementation SHA | `4c982316f2a8a4d9e119afe9dea5587511e8136e` |
| Reconciliation base | `d141f012332302bc469d81cb8cd456d95d064733` |
| Branch | `audit/420bet-5a-2-table-registry-20261018` |
| PR | https://github.com/abvhiael/420-integrated-v0.1/pull/737 |
| Level 1 workflow | `420Bet Poker Table Registry 5A.2 Level 1` |
| Run | https://github.com/abvhiael/420-integrated-v0.1/actions/runs/39183757330 |
| Job | `117843902881` |
| Conclusion | `completed/success` |
| Foundry result | `BetPokerTableRegistry52Test`: **7 passed, 0 failed, 0 skipped** |

## Qualified scope

- `contracts/src/bet/PokerTableRegistry420.sol`: non-custodial NLHE cash-table registry with version-bound and chain-bound configuration commitment; immutable operator, vault, asset, blind, buy-in, rake/trust-policy identifiers; registered/approved/open/paused/closed lifecycle and terminal closure.
- Per-table and per-action capability checks through `BetAuthorization420.scopeForTable` and distinct creation, approval, opening, suspension, closure actions; no unilateral operator settlement or implied gambling permission.
- Active operator requirements for registration and reopening, with `BetEmergencyState420` `POKER_NEW_TABLES` emergency-halt protection at registration/opening, leaving safe closure available.
- `contracts/test/BetPokerTableRegistry52.t.sol`: registration uniqueness, configuration commitment, state transitions, authority rejection/revocation, operator suspension, emergency safety, invalid rule/version/configuration, unauthorized alternate table scope and terminal close.
- `.github/workflows/420bet-poker-5a-2-level1.yml`: scope-limited exact-SHA Foundry job.

## Assurance boundaries

The table OPEN lifecycle state is configuration status only. Seating, secure private deal/shuffle, hand action sequencing, escrow accounting, side pots, disputes and external funded settlement require separate implementation and future qualifications. Regulatory/eligibility/operator, independent security and economics, and real testnet evidence remain blocked by the release gates in `docs/420BET-TESTNET-WORK-ROADMAP.md`. Production wagering is not enabled.

**Qualification Level 2:** not required/dispatched for this ordinary step. **Level 3:** not initiated.
This document is evidence-only and does not replace the tested SHA. Preserve the successful run and job, and do not rerun tests solely to commit evidence. Reconcile against current `main` and confirm GitHub merge eligibility separately.
