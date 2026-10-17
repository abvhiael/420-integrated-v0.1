# High Country — Cultivar moderation, governance and naming escrow Level 1 certificate

**Disposition:** PASS — scoped Level 1 evidence only. **PR:** [#677](https://github.com/abvhiael/420-integrated-v0.1/pull/677) (draft, unmerged when certified).

## Immutable evidence identities

**Corrected implementation SHA:** `cc1bf36749fd06514ac64044530a5a8a0cbe4f87`
**Original escrow-tested implementation SHA:** `44e7b2e7d750876b10ba9f31afe21336bab97eec`

| Exact-SHA CI workflow | Run | Conclusion | Tested SHA |
|---|---|---|---|
| High Country Cultivar Moderation Level 1 | [38987939559](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38987939559) | completed / success | `cc1bf36749fd06514ac64044530a5a8a0cbe4f87` |
| High Country Cultivar Governance Service Level 1 | [38987939596](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38987939596) | completed / success | `cc1bf36749fd06514ac64044530a5a8a0cbe4f87` |
| Solidity Contracts | [38987939585](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38987939585) | completed / success | `cc1bf36749fd06514ac64044530a5a8a0cbe4f87` |
| High Country Cultivar Naming Escrow Level 1 | [38983872048](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38983872048) | completed / success | `44e7b2e7d750876b10ba9f31afe21336bab97eec` |

## Why preserved escrow evidence remains applicable

The only change between `44e7b2e7d750876b10ba9f31afe21336bab97eec` and `cc1bf36749fd06514ac64044530a5a8a0cbe4f87` is the assertion in `scripts/highcountry/cultivar-moderation-policy.test.mjs`, replacing an obsolete unpriced reviewer reward expectation with assertions for 50% reviewer allocation, 50% High Country prize-vault allocation, conserved 100% sum, and preserved anti-deletion-incentive, no-self-review, no-duplicate-payment and no-auto-transfer requirements. The escrow contract, its test inputs, and escrow qualification workflow are unchanged. The earlier escrow run therefore remains historical qualified evidence **at its own tested SHA**, not falsely reported as having run on the corrected SHA.

The successful corrected-SHA Cultivar Moderation Level 1 test is the required repair of the earlier failed policy assertion. The successful corrected-SHA governance service and Solidity Contracts checks supplement that result. No manually initiated global qualification rerun is required solely because of the policy test update.

## Scope and deferred acceptance

This certificate covers only the tested Level 1 scope of cultivar naming/moderation policy, governance service, escrow contract and Solidity compilation/tests. It is **not** a Level 2/Level 3 phase closeout, a deployed live moderation backend, a complete browser-to-local-chain integration qualification, a trusted production price oracle, a prize-vault disbursement certification, a testnet signoff, or permission to enable paid naming. Remaining local work and genuinely testnet-gated acceptance remain tracked in `docs/highcountry/HIGHCOUNTRY-TESTNET-WORK-ROADMAP.md`.

**Certificate commit is evidence-only**: do not substitute its Git SHA for either recorded implementation SHA or launch/repeat tests on account of this documentation commit.
