# Cannabis Cowboy — payout calibration and extreme-tail qualification
**Date:** 2026-11-07  
**Scope:** practice engine only; no wallet or real-money settlement.  
**Target:** estimated RTP 94–96% at supported wagers.  
**Code:** `src/cannabis-cowboy-engine.js`, `src/cannabis-cowboy-road-trip.js`.  
**Reproduction:** `node scripts/qualify-cannabis-cowboy-rtp.mjs --spins=800000 --seed=20261107 --bet=20`

## Changes
- Base cluster awards: original cluster-bracket multiples × **2.23**. Updated the exported `CLUSTER_PAYS` so the in-game paytable shows the real base pays.
- Endless Harvest cluster awards: original cluster-bracket multiples × **2.00**, as a separate `HARVEST_CLUSTER_PAYS` table.
- **No change:** reel weights, doubled bonus Wild frequency, non-sticky Wilds, persistent +1-to-10× Harvest frames, scatter/road probabilities, bonus awards and retriggers, five-stop Road Trip, additive multipliers, illustrations, animations or player-controlled spins.
- Both payout tables calculate integer credits per wager bracket; no changes to payout safety limits.

## Seeded Monte Carlo
Each trial samples an independent base-game board and cascade; any feature is fully resolved by the production engine. Road Trip picks are sampled uniformly among three cases at each of five stops. Rejected rounds are tracked separately (none observed). Payouts are divided by all *attempted* wager credits.

| Wager | Spins | Base RTP | Harvest RTP | Road Trip RTP | Combined RTP | Rejected |
|:--|--:|--:|--:|--:|--:|--:|
| 20 | 800,000 | 49.5725% | 18.2107% | 27.5936% | **95.3767%** | 0 |
| 10 | 200,000 | 49.9692% | 18.1875% | 26.9538% | **95.1104%** | 0 |
| 50 | 200,000 | 49.6510% | 18.4945% | 26.3980% | **94.5434%** | 0 |

The 800,000-spin run uses seed `20261107`. The two smaller runs use seeds `13579` (bet 10) and `97531` (bet 50). The approximate normal 95% CI for the 800,000-spin combined RTP is **94.27%–96.49%**. This is a Monte Carlo uncertainty interval, not a regulated certification.

### Analytical cross-check
The exact (under independent symbol draws) three-or-more-Road-Tickets trigger probability uses a binomial tail with 48 positions and per-position probability 0.008. The five-stop random case-selection model yields an **analytical Road Trip RTP of approximately 27.0021%** at wagers 10, 20 and 50, compared with the observed 27.5936%, 26.9538% and 26.3980% respectively.

## Frequency, tail and large-award risk (800,000 spins at bet 20)
- Endless Harvest triggered **16,046** times (2.0058%); Road Trip triggered **5,399** times (0.6749%).
- **165,640** feature spins played, including **27,728** extra free spins from retriggers. No feature reached the 100-free-spin cap naturally.
- **554,456** rounds (69.31%) returned zero; **660,734** (82.59%) returned less than the wager.
- Payout quantiles in wager multiples: p95 **3.6×**, p99 **14.5×**, p99.9 **80.6×**, p99.99 **144.4×**.
- **427** rounds reached at least 100× bet; **2** reached at least 250×; **0** reached 500× or 1,000×.
- Highest observed round **5,072 credits** (253.6× bet); highest Harvest feature **5,072 credits**, Road Trip **5,040 credits**, base round **4,208 credits**.
- Top 1% of spins contributed **41.25%** of all returned credits; top 0.1% contributed **11.42%**. RTP is materially sensitive to rare wins.

## Deliberately constructed extreme cases
- Forced scatter retriggers to the hard cap: **100 played / 100 awarded**, safe integer **7,216 credits** and no sticky Wilds.
- Forced endless cascade using an all-identical board and refill RNG=0: safely **rejected at 200 cascades**; not treated as a paid game.
- Road Trip five-stop upper bound at bet 20: **5,040 credits (252×)** from either two 10× cases + three 84-credit cases (20× × 252) or three 10× cases + two 84-credit cases (30× × 168).
- Selecting all five multiplier cases produces 50× but zero collected coins, hence zero award, consistent with the additive rules.

## Acceptance / limitations
The observed RTP lies in the 94–96% design window at wagers 10, 20 and 50 and no naturally generated rounds failed. All payouts in this qualification were model simulations; the full Node and browser test suites and production deployment were not independently executed as part of these calculations. This is **not** a theoretical full-game certification, nor a substitute for independent gambling compliance and statistical audit. Re-run on all supported wagers and increase the sample before financial deployment.
