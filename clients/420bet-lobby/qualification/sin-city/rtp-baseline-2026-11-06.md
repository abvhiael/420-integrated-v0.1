# Sin City High Rollers — RTP qualification baseline (6 November 2026)

**Result: FAIL — not suitable for real-money wagering.** This is the current non-transactional practice engine on `main` before calibration.

Method: `node tests/sin-city-rtp-audit.mjs` against `src/sin-city-engine.js`, three seeded RNG streams (420, 1337, 20261106), 150,000 completed **paid-spin episodes** per seed, including all bonus rounds and the existing 5,000× initiating-stake payout cap. 450,000 paid spins total.

## Monte Carlo findings

| Metric | Measured |
|---|---:|
| Total RTP | **666.21097%** |
| Base game contribution | 168.47293% |
| Chronic Sessions contribution | 419.36581% |
| Hotbox Respins contribution | 78.37222% |
| Free-spin trigger episodes | 3,372 (0.7493% of paid spins) |
| Hotbox trigger episodes | 22,877 (5.0838%) |
| Free-spin rounds played | 28,347 |
| Hotbox respins played | 248,651 |
| Lowrider multiplier occurrences | 16,436 free spins |
| Additional retriggered free spins | 695 |
| Payout cap hits | 25 |
| Outcomes at or above 100× | 2,533 |
| Outcomes at or above 500× | 1,134 |
| Outcomes at or above 1,000× | 521 |
| Largest observed single paid-spin episode | 5,000× (cap) |

Independent seed returns: 651.82030%, 660.19733%, 686.61527%.

**Approximate pooled 95% Monte Carlo confidence interval:** 641.5%–690.9%, based on the three seed-level within-run standard errors (ignores modest between-run uncertainty). This interval does not establish theoretical RTP.

## Interpretation

1. The base game pays 168% of the initiating stake before any bonus: its base ways, Wild substitutions and/or paytable must be reduced independently.
2. Chronic Sessions contributes another 419% of the stake, with all-Wild accumulation, substantial ways wins and one-car Lowrider multipliers compounding returns. It is the largest calibration problem.
3. Hotbox contributes 78% of stake; the collection ladder and frequent triggering are materially expensive.
4. The 5,000× cap is reached, but the cap alone does not contain the mean RTP below 100%.
5. The engine has no qualifying mathematical model, analytic feature distribution, or certified RTP. Do not infer wagering suitability from this green workflow run: the audit successfully **measured an unacceptable payout**.

No payout rules, reel strips or UI behavior were modified by the audit.

## Reproduction

```sh
cd clients/420bet-lobby
SPINS_PER_SEED=150000 RTP_SEEDS=420,1337,20261106 node tests/sin-city-rtp-audit.mjs
```

Keep the same seeds and sample count for before/after comparison. Before any RTP qualification, use larger tail samples, exact base-game enumeration where feasible, and an explicit theoretical method for sticky-Wild feature distributions.

Evidence: https://github.com/abvhiael/420-integrated-v0.1/actions/runs/42282374493
