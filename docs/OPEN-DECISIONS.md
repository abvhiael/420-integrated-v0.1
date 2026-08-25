# Open Decisions — in recommended order

These are the next variables we should settle. Do not freeze them merely for aesthetic reasons; simulate the economic/security consequences.

## A. Immediate: needed before genesis economics can be modeled

1. **Initial block issuance — current model selected**
   - Current modeled value: **1.7507002801120448 420/block**.
   - Derived from a target 5% active-term return on a 42,000-420 bond.
   - Still requires total-supply/inflation simulation before being frozen for mainnet.

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
