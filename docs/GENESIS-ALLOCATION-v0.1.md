# Genesis Allocation — Three Founders Amendment (Working Draft)

Modeled Genesis supply: **42,000,000 $420**. The existing Founders/Core Contributors allocation remains **1,000,000 $420** (2.380952% of supply). The three beneficiaries replace the earlier ten; no additional coins are created.

| Founder role | Share | Total $420 | Directly liquid at Genesis | Locked in 0x0427 |
| --- | ---: | ---: | ---: | ---: |
| Founding Administrator | 50% | 500,000 | 250,000 | 250,000 |
| Andrew | 25% | 250,000 | 125,000 | 125,000 |
| Janet | 25% | 250,000 | 125,000 | 125,000 |
| **Total** | **100%** | **1,000,000** | **500,000** | **500,000** |

**Unchanged vesting rules:** 13 installments at 14-day intervals, starting 14 days after the Genesis timestamp and completing at day 182. Each beneficiary claims from their own verified wallet; there is no administrator bypass or changeable beneficiary slot. Fractional smallest-unit rounding is included in the final payout.

**Genesis delivery:** allocate 500,000 native $420 to the existing FounderVestingRegistry predeploy at `0x0427`, and distribute the other 500,000 directly to the three role-bound personal wallets. The personal wallet addresses remain unknown and cannot be invented. Founder verification and per-network Genesis commitments are required before deployment.

**Frozen configuration gate:** This change to the canonical `config/genesis-allocations.json` is a **candidate amendment**, and no longer matches the preserved signed `FROZEN_V3` `contracts/config/genesis-config-commitment.json`. Mainnet/testnet must obtain an explicit new Genesis configuration commitment and regenerate the exact predeploy runtime/storage and alloc records. Do not reuse historical V3 qualification to authorize this candidate.

Community rewards, Treasury Operations, Contingency, validator-credit funding, and the separate recurring 50/25/25 developer revenue splitter remain distinct and are not silently debited from the Founders allocation.
