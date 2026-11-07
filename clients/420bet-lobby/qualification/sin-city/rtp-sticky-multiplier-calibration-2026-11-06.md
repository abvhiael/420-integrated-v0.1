# Sin City High Rollers — Sticky Lowrider RTP recalibration
**Date:** November 6, 2026
**Outcome:** **95.5227574% measured RTP** across **5,000,000 complete paid-spin episodes**, in the requested 95–96% simulation target. This is not mathematical or regulatory certification.

## Problem found

The merged Lowrider-to-Sticky-Wild multipliers increased the old 0.075 free-ways coefficient's RTP to **140.8221%** across an initial 225,000 paid-spin-episode baseline: base 54.0400%, Chronic Sessions 77.5776%, Hotbox 9.2045%.

## Calibrated change

Reduced the **free-spin ways paytable scalar** from **0.075 to 0.03375**. This is the only payout change. Base ways scalar remains **0.3125**, the progressive Hotbox ladder and natural gem frequency remain identical, and the entire bonus behavior from PR #1050 stays intact: Wilds lock, marked Lowrider multipliers persist, Ashtray and Lowrider ways do not treat Wilds as substitutes, the highest multiplier applies without stacking, and the 5,000× whole-episode cap is unchanged.

The intermediate 0.031 factor yielded 92.8238% across five million episodes and was rejected.

## Final independent Monte Carlo results

Every observation is a wagered base spin and **all** resulting free spins or respins through return to base mode; only its initiating stake is counted in RTP's denominator.

| Metric | First 2.5m episodes | Independent second 2.5m | Combined |
|---|---:|---:|---:|
| Total RTP | 95.98242% | 95.06309% | **95.52276%** |
| Base contribution | 53.51901% | 53.41045% | 53.46473% |
| Chronic Sessions | 33.36515% | 32.50841% | 32.93678% |
| Hotbox | 9.09826% | 9.14423% | 9.12124% |

**Approximate pooled 95% normal Monte Carlo interval:** **94.824%–96.222%** (standard error 0.357 percentage points). This demonstrates a plausible simulated 95–96% return, but cannot prove an exact theoretical RTP inside the interval.

- RNG seeds for first 2.5m: `420, 1337, 20261106, 314159, 271828`, 500,000 episodes each
- Holdout seeds for second 2.5m: `20261107, 987654, 543210, 777777, 424242`, 500,000 episodes each
- Stake for both large batches: 2 practice credits

### Wager-size diagnostics

Another 300,000 complete episodes at 1 credit returned **97.39346%**, with approximate 95% CI **94.444–100.343%**. The same RNG seeds at 50 credits returned **97.21129%**, 95% CI **94.263–100.160%**. These 300,000-episode estimates are very noisy for the rare large-pay bonus tail. Their approximately 0.18-point paired difference also reflects the engine's per-win cent rounding. Exact wager-level analysis remains outstanding.

### Evidence

- Previous unmodified bonus rules, baseline 225k episodes (140.82%): https://github.com/abvhiael/420-integrated-v0.1/actions/runs/42330867715
- Rejected 0.031 candidate, 5m episodes (92.82%): https://github.com/abvhiael/420-integrated-v0.1/actions/runs/42330992341
- **Selected 0.03375 candidate**, 5m episodes + wager checks: https://github.com/abvhiael/420-integrated-v0.1/actions/runs/42331165153
- Focused gameplay, Vite production build, artwork and headless desktop/mobile Chrome checks: https://github.com/abvhiael/420-integrated-v0.1/actions/runs/42331168816

### Reproduction

```sh
cd clients/420bet-lobby
SPINS_PER_SEED=500000 RTP_SEEDS=420,1337,20261106,314159,271828 node tests/sin-city-rtp-audit.mjs
SPINS_PER_SEED=500000 RTP_SEEDS=20261107,987654,543210,777777,424242 node tests/sin-city-rtp-audit.mjs
```

**Boundary:** This qualifies only the sampled practice-engine payouts. It does **not** certify theoretical RTP, paytable correctness to a regulator, PRNG security, fairness, financial transactions, or a real-money casino.
