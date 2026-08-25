# Open Decisions — in recommended order

These are the next variables we should settle. Do not freeze them merely for aesthetic reasons; simulate the economic/security consequences.

## A. Immediate: needed before genesis economics can be modeled

1. **Initial block issuance — selected**
   - **4.2 420/block**
   - This replaces the earlier reward derived from the 5% target.
   - At current validator parameters, expected active-term subsidy is **5,037.984 420**, or **11.995%** of the 42,000 bond.
   - Still subject to testnet economic stress testing before mainnet freeze.

2. **Genesis supply**
   - Total native 420 existing at block zero.
   - Distinguish liquid distribution from contract-locked protocol reserves.

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
   - Current allocation: 10 wallets × 100,000 420 = 1,000,000 420 total.
   - Decide cliff period, vesting duration, whether rewards earned as validators are separate, and whether unvested allocations return to a protocol reserve if a contributor leaves.

## G. Validator-set scaling details

25. **Validator-set scaling details**
   - Working rule: active validators = 25% of eligible pool, clamped to 15–30.
   - Working handoff threshold: 60 eligible validators.
   - Full bounded-validator capacity: 120+ eligible / 30 active / 10 swapped.
   - Finalize integer rounding for intermediate active and swap counts.
   - Finalize hysteresis/persistence rule to prevent committee-size oscillation near thresholds.
   - Finalize whether pool-size changes can only take effect after one or more completed rotations.
