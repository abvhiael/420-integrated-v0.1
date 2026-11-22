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

## Canonical 42,000,000 $420 supply reconciliation (GOV-PRE-01)

Only the `allocations[]` entries of `config/genesis-allocations.json` are additive Genesis allocations. The funding-purpose subdivision inside `protocol-reserve` is **not** a second distribution, a newly minted balance or a funded Treasury Vault.

| Additive Genesis allocation | $420 | Canonical destination |
| --- | ---: | --- |
| Founders, 500,000 liquid + 500,000 locked | 1,000,000 | Verified wallets (pending) and 0x0427 |
| Validator bootstrap reserve | 3,000,000 | 0x042e |
| Attention bootstrap | 4,200,000 | 0x0421 |
| Development bootstrap | 4,200,000 | 0x0422 |
| Community validator-credit reserve | 6,300,000 | 0x0425 |
| Community/testnet reward reserve | 2,100,000 | 0x0426 |
| Public distribution, three 4.2M tranches | 12,600,000 | 0x042a |
| Protocol Reserve, **including** founding earmarks | 8,600,000 | 0x0424 |
| **Total, additive** | **42,000,000** | |

**Protocol Reserve's 8,600,000 (non-additive internal purposes):** 4,200,000 founding Operations; 840,000 founding Contingency; 3,560,000 remaining unearmarked Protocol Reserve. Thus 4,200,000 + 840,000 + 3,560,000 = 8,600,000; these three lines are never added to the 42M total again. This explicitly identifies the source instead of silently taking 5.04M from another allocation. No validator, public-distribution, Attention, Development, founder or Community Reward reserve is reduced.

**Not yet funded:** All 8.6M remains assigned to the frozen ProtocolReserve predeploy at 0x0424 in the candidate model. Operations and Contingency are proposed internal earmarks, not separately funded Vault balances. Actual transfers into two dedicated Treasury Vaults require the real Genesis V4 plan, authorized governance/Treasury permissions, funded Vault identities and receipt/accounting evidence. The ledger's earmarks do not grant control of the reserve or waive the current release gate.

**Validator capacity:** Community/Testnet's 8.4M is the *sum* of 6.3M validator credit and 2.1M reward funds. Actual 21,000-420 matched credits can fund at most 300 simultaneously from the present 6.3M reserve, while a purely 42,000-420 sponsored pool could fund at most 150; mixed credit programs draw from the same reserve. The old 400-credit calculation assumes that the separately committed 2.1M reward reserve were diverted and is not an authorized live capacity.

**Historical files:** `testnet/genesis/genesis-allocations.json` and `release/rc/0.1.0-rc1/` are frozen historical V3/RC outputs, **not** authoritative copies of this pending V4 amendment. They must not be silently rewritten or used to sign the new Genesis; `FROZEN_V3` remains preserved until an independently approved V4 ceremony.
