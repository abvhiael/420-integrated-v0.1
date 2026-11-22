# Open Decisions — in recommended order

These are the next variables we should settle. Do not freeze them merely for aesthetic reasons; simulate the economic/security consequences.

## A. Immediate: needed before genesis economics can be modeled

1. **Initial block issuance — selected**
   - **4.2 420/block**
   - This replaces the earlier reward derived from the 5% target.
   - At current validator parameters, expected active-term subsidy is **5,037.984 420**, or **11.995%** of the 42,000 bond.
   - Still subject to testnet economic stress testing before mainnet freeze.

2. **Genesis supply — 42,000,000 $420 reconciled candidate**
   - Explicitly preserve 1M three-founder allocation, 3M validator bootstrap, 4.2M Attention, 4.2M Development, 6.3M community validator credit, 2.1M community reward, 12.6M public and 8.6M ProtocolReserve.
   - Inside the **existing** 8.6M reserve: 4.2M founding Operations, 840K Contingency, 3.56M unearmarked. Internal earmarks are not second Genesis allocations and do not imply funded Vaults.
   - The frozen V3 bundle is historical; the new Genesis V4 commitment and actual addresses/funding remain gated.

3. **Genesis validator-bond treatment**
   - Are founding bonds protocol-owned bootstrap collateral?
   - Are qualified public/testnet validators pre-bonded from purchased/earned balances?

4. **Cooldown**
   - Current draft: 3 rotations / 7.35 days.
   - Compare against 6 rotations / 14.7 days under 42, 60, 100, and 500-candidate pools.

5. **Bond withdrawal delay**
   - Must be long enough for slashable evidence/finality but not unnecessarily punitive.

## B. Consensus

6. Randomness construction (RANDAO/VRF-style design).
7. Exact proposer selection algorithm.
8. Attestation/finality threshold.
9. Failure and fallback proposer timing.
10. Offline penalty curve.
11. Slashable offenses and correlated-slashing policy.
12. Final PoS transition conditions/timing.

## C. Fees

13. Base fee behavior.
14. Fee burn vs treasury routing.
15. Priority fee/tip destination.
16. Whether system transactions are gas exempt.

## D. Treasuries

17. Attention bootstrap allocation.
18. Development bootstrap allocation.
19. Treasury governance structure at genesis.
20. Upgradeability / timelock rules.

## E. Network identity

21. Final chain ID / network ID.
22. Human-readable network metadata.
23. System contract address range.

## F. Founders / core contributors

24. **Founders/core-contributor vesting**
   - Updated candidate: 3 verified founder wallets sharing the unchanged 1,000,000 $420: Administrator 50%, Andrew 25%, Janet 25%.
   - 50% liquid at Genesis; other 50% releases in 13 fortnightly intervals through day 182. Founder identities and a new signed Genesis freeze remain pending.
   - Still decide succession if a founder loses their wallet or leaves, and whether validator rewards are separate from founder vesting.

## G. Validator-set scaling details

25. **Validator-set scaling details**
   - Working rule: active validators = 25% of eligible pool, clamped to 15–30.
   - Working handoff threshold: 60 eligible validators.
   - Full bounded-validator capacity: 120+ eligible / 30 active / 10 swapped.
   - Finalize integer rounding for intermediate active and swap counts.
   - Finalize hysteresis/persistence rule to prevent committee-size oscillation near thresholds.
   - Finalize whether pool-size changes can only take effect after one or more completed rotations.
