# Sin City High Rollers — free-spin Ashtray Wild propagation RTP qualification

**Date:** 2026-11-06. **Engine:** post-PR #1057, with restored Puff Puff Pass in Chronic Sessions. **Target:** 94–95% measured RTP. **Result:** **94.14858%** across five million completed paid-spin episodes. This is a statistical practice-game calibration, **not a certified exact theoretical RTP**.

## Before and after

| Component | Current engine before recalibration, 225k episodes | Calibrated engine, 5m episodes |
|---|---:|---:|
| Base ways | 53.99994% | 53.41019% |
| Chronic Sessions free-spin return | 84.02413% | 31.61917% |
| Hotbox Respins | 9.21129% | 9.11922% |
| **Total RTP** | **147.23536%** | **94.14858%** |

The **only gameplay math change** is `FREE_WAYS_SCALE` from `0.03375` to `0.01265`. The base ways factor `0.3125`, Hotbox progressive ladder and reel strips, all Wild persistence, Puff Puff Pass conversions on 3+ natural Ashtrays, Lowrider-triggered 2×–5× sticky Wild multiplier badges, the 50-free-spin limit, and 5,000× total-round cap remain unchanged. The paytable shown in INFO derives from the exported calibrated values.

## Complete paid-spin-episode Monte Carlo

Each episode consists of one paid initial spin plus **every** triggered free spin or respin, including retriggers, through return to base mode; payout divided by the initial paid stake, not by the number of free spins.

| Measure | First 2.5m | Independent holdout 2.5m | Combined |
|---|---:|---:|---:|
| RTP | 94.23235% | 94.06480% | **94.14858%** |
| Base return | 53.47568% | 53.34471% | 53.41019% |
| Chronic Sessions return | 31.64147% | 31.59686% | 31.61917% |
| Hotbox return | 9.11520% | 9.12323% | 9.11922% |

**Approximate pooled 95% Monte Carlo confidence interval:** **93.575% to 94.722%**; standard error **0.293 percentage points**. The point estimate is within 94–95%. The interval extends below 94%, so this evidence **does not establish that exact long-run RTP is necessarily 94% or higher**. Exact mathematical RTP still needs independent analytic qualification.

**First batch:** `420,1337,20261106,314159,271828`, 500,000 episodes per seed.
**Holdout batch:** `20261107,987654,543210,777777,424242`, 500,000 episodes per seed.

**Additional wager diagnostics** (300,000 episodes each, same three seeded scenarios): 1-credit stake **94.17840%**, approximate 95% CI **91.97–96.39%**; 50-credit stake **93.97388%**, CI **91.76–96.18%**. Sample tail variation and cent rounding create differences; these smaller samples do not independently certify wager-level RTP.

**Tail:** 0 hits to the 5,000× cap across the two main 2.5m batches; 2 and 3 outcomes respectively >=1,000×. The maximum observed 2-credit return was approximately **1,278×**.

## Evidence and repeatability

- Baseline post-Puff fix: https://github.com/abvhiael/420-integrated-v0.1/actions/runs/42333187913
- Rejected/initial 225k calibration check: https://github.com/abvhiael/420-integrated-v0.1/actions/runs/42333236437
- First 2.5m qualifying sample: https://github.com/abvhiael/420-integrated-v0.1/actions/runs/42333252603
- Independent 2.5m holdout and wager diagnostics: https://github.com/abvhiael/420-integrated-v0.1/actions/runs/42333355434
- Focused engine/UI, Vite production build and Chromium layout: https://github.com/abvhiael/420-integrated-v0.1/actions/runs/42333369483

```sh
cd clients/420bet-lobby
SPINS_PER_SEED=500000 RTP_SEEDS=420,1337,20261106,314159,271828 node tests/sin-city-rtp-audit.mjs
SPINS_PER_SEED=500000 RTP_SEEDS=20261107,987654,543210,777777,424242 node tests/sin-city-rtp-audit.mjs
```

**Scope:** Practice-credit engine only. No changes to wallets, purchases, external transactions, deployments, or other games. This result is not a fairness, randomness, security, regulatory, or real-money wagering certification.
