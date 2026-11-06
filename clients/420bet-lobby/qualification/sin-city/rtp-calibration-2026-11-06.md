# Sin City High Rollers — practice-engine RTP recalibration
**Date:** 2026-11-06
**Result:** **95.5323264% measured RTP** across 5,000,000 complete paid-spin episodes (two independent 2.5-million-episode batches).
**Status:** candidate Monte Carlo target achieved; **theoretical certification remains outstanding**. Practice credits only; no wallet or real-money settlement.

## Before and after

| Source | Previously measured | Recalibrated |
|---|---:|---:|
| Base game ways and triggers | 168.47293% | 53.45589% |
| Chronic Sessions free spins | 419.36581% | 32.97291% |
| Hotbox Respins | 78.37222% | 9.10352% |
| **Total** | **666.21097%** | **95.53233%** |

The original baseline used 450,000 initiating paid spins. The calibrated result uses 5 million, so the uncertainty bands are not directly comparable. Independent 2.5m-spin batches returned **95.90379%** and **95.16087%**. Approximate pooled Monte Carlo **95% confidence interval: 94.85671%–96.20794%** (standard error 0.34470 percentage points).

## Actual changes, made in requested order

1. **Base-game payout:** global base ways coefficient 0.3125 relative to the original uncapped candidate paytable; all 3/4/5-of-a-kind values are now transparently shown in the game's INFO modal.
2. **Chronic Sessions:** separate lower feature ways paytable (0.075 times the original values) compensates for all Wilds becoming permanently sticky and any Lowrider on the free-spin board triggering a random 2×–5× payout multiplier. All twenty positions can still accumulate Wilds. The original 8/12/20-spin triggers, five-spin retrigger, 50-spin feature limit and entire initiating round payout cap remain.
3. **Hotbox:** first reel has one GEM position rather than two; other reels have two each, on their original 42-position circular strips. Three visible gems still trigger the feature. The final collection ladder (3..20 gems, multiplier of initiating total wager) is `0.2, 0.4, 0.6, 0.8, 1, 1.4, 1.8, 2.4, 3.2, 4, 5, 6, 8, 10, 15, 25, 50, 100`. This preserves the **100× all-twenty-gems** award and three-resetting-respin behavior.
4. No reliance on reducing the 5,000× payout cap. That cap is unchanged. No animation, symbol art, or transaction code was changed.

## Actual audited outcomes

| Metric, 5,000,000 paid-spin episodes | Value |
|---|---:|
| Initiating free-spin features | 37,054 (~0.741%) |
| Initiating Hotbox features | 186,491 (~3.730%) |
| Completed free-spin rounds | 311,800 |
| Completed Hotbox respins | 1,855,780 |
| Lowrider-multiplied free-spin rounds | 181,842 |
| Extra awarded retrigger spins | 7,400 |
| Outcomes >= 100× | 4,168 |
| Outcomes >= 500× | 152 |
| Outcomes >= 1,000× | 19 |
| 5,000× cap hits | 0 |
| Maximum observed paid-spin outcome | 1,917.525× |

Independent random seeds: `420, 1337, 20261106, 314159, 271828`, plus independent holdout `20261107, 987654, 543210, 777777, 424242`; 500,000 initiating paid-spin episodes per seed. Each triggered bonus is played to completion, with the engine's exact whole-sequence credit accounting and payout cap.

**Additional bet-size diagnostic:** 300,000 episodes at wager 1 returned 93.53387% (approx. 95% CI 91.07–96.00), while the *same seeded 300,000 outcomes* at wager 50 returned 93.30192% (95% CI 90.84–95.76). These small diagnostic samples have considerable tail uncertainty; a roughly 0.23-percentage-point paired difference reflects cent rounding. Larger and exact bet-level mathematical qualifications remain appropriate.

## Reproduce the measurements

```sh
cd clients/420bet-lobby
SPINS_PER_SEED=500000 RTP_SEEDS=420,1337,20261106,314159,271828 node tests/sin-city-rtp-audit.mjs
SPINS_PER_SEED=500000 RTP_SEEDS=20261107,987654,543210,777777,424242 node tests/sin-city-rtp-audit.mjs
```

**Evidence:** [5-million-episode audit, plus wager-size diagnostics](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/42285297518); [focused gameplay, Vite, artwork and browser qualification](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/42285303417).

## Release boundary

This is a **successful provisional practice-engine Monte Carlo calibration**, not proof of exact theoretical RTP or real-money suitability. Full independent statistical/mathematical review (including exact reel/feature probabilities, extreme-tail bounds, wager-size invariance and regulatory qualification where relevant) remains necessary before any wagering enablement.
