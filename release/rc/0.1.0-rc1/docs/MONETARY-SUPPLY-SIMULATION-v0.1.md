# Monetary Supply Simulation — v0.1

## Parameters

- Initial block issuance: **1.7507002801120448 420**
- Block target: **12 seconds**
- Issuance reduction: **0.420%**
- Reduction interval: **420,000 blocks**
- Tail floor: **0.420 420/block**
- Security / Attention / Development: **34% / 33% / 33%**
- Modeled genesis supply: **42,000,000 420**

The simulation assumes the chain continuously meets the 12-second target. Real calendar dates will drift if average block time differs.

## Issuance milestones

| Time | Approx. blocks | New 420 issued since genesis | Total supply with 42M genesis | Block reward at milestone |
|---:|---:|---:|---:|---:|
| 1 year | 2,629,800 | 4,553,133 | 46,553,133 | 1.707043 |
| 5 years | 13,149,000 | 21,612,930 | 63,612,930 | 1.536553 |
| 10 years | 26,298,000 | 40,557,903 | 82,557,903 | 1.348601 |
| 25 years | 65,745,000 | 84,479,131 | 126,479,131 | 0.907952 |
| 50 years | 131,490,000 | 128,193,476 | 170,193,476 | 0.468906 |
| 100 years | 262,980,000 | 183,691,985 | 225,691,985 | 0.420000 |

## Tail-emission point

The mathematical decay first falls below the 0.420 floor in issuance era **340**.

- Floor activation block: **142,800,000**
- Approximate time at 12-second blocks: **54.30 years**
- New 420 issued before the floor: **133,216,385**
- Total supply at floor activation with 42M genesis: **175,216,385**
- Permanent tail issuance: **1,104,516 420/year** at the 12-second target.

## Why 42,000,000 genesis is a strong modeling candidate

With a 42,000,000-420 genesis supply:

- one 42,000-420 validator bond is exactly **0.1%** of genesis supply;
- 15 active minimum bonds equal **630,000 420 = 1.5%** of genesis supply;
- the minimum 42-candidate pool requires **1,764,000 420 = 4.2%** of genesis supply if every candidate bonds exactly the minimum;
- first-year protocol issuance is about **4,553,133 420**, or about **10.84%** of the genesis supply;
- by the time tail emission begins, total supply is about **175,216,385 420**;
- tail issuance at that point is about **0.630%** of supply per year, and the percentage continues declining thereafter.

This makes 42M useful for more than branding: the validator bond and 42-validator decentralization threshold map cleanly onto the initial monetary base.

## Approximate issuance by purpose

Because the top-level split is fixed, cumulative protocol issuance can be viewed as:

- 34% Security
- 33% Attention
- 33% Development

At one year, approximately:
- Security: **1,548,065 420**
- Attention: **1,502,534 420**
- Development: **1,502,534 420**

At ten years, approximately:
- Security: **13,789,687 420**
- Attention: **13,384,108 420**
- Development: **13,384,108 420**

These are maximum scheduled amounts assuming full eligible issuance. Under the current draft, missed validator participation shares are not issued, so realized issuance can be slightly lower.

## Recommendation for the next design pass

Keep **42,000,000 420** as the leading genesis-supply candidate and now design the block-zero allocation against it. The next task is to divide that 42M among:

1. validator/bootstrap collateral;
2. Attention Treasury bootstrap reserve;
3. Development Treasury bootstrap reserve;
4. community/testnet-earned distribution;
5. liquidity/public distribution;
6. protocol reserve.

Those allocations should be modeled for circulating supply and governance concentration before being frozen.
