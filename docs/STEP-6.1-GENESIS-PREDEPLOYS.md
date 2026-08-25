
# Step 6.1 — Complete Reserved Contracts & Deterministic Genesis Predeploys

Status: **SOURCE/ADDRESS/PREDEPLOY MECHANISM COMPLETE; BYTECODE/STORAGE FREEZE BLOCKED ON EXTERNAL COMPILATION AND CEREMONY INPUTS**

## Frozen addresses

The system/application address map is now frozen through `0x...043B`, totaling 28 assignments.
Existing `0x...0420-0x...0433` assignments are unchanged. Genesis dApp additions `0x...0434-0x...043B`
are now frozen.

## Remaining reserved contracts implemented

Step 6.1 adds:
- ProtocolReserve
- CommunityRewardReserve
- RandomnessRegistry
- PublicDistributionVault
- ValidatorBootstrapReserve

GovernanceTimelock is strengthened with class-specific G1/G2/G3/G4 delays.

The distribution vault encodes:
- 12.6M total allocation;
- 4.2M genesis tranche;
- 4.2M after 180 days;
- 4.2M after 365 days;
- maximum 100,000 420 newly released per day.

## Deterministic genesis predeploy

Reserved addresses are not obtained with CREATE.

The new pipeline is:
1. compile contracts with pinned Solidity/Foundry settings;
2. export runtime bytecode and storage layout;
3. materialize constructor effects into explicit genesis storage;
4. write runtime bytecode to each reserved account's `alloc.code`;
5. write explicit storage slots to `alloc.storage`;
6. produce a code-hash/storage manifest;
7. hash the resulting execution genesis;
8. reject missing artifacts, storage or address collisions.

Constructor bytecode is never inserted directly.

## Fail-closed inputs

Two inputs remain intentionally unresolved:
- founder beneficiaries for FounderVestingRegistry;
- exact verified bridge verifier implementation/address.

These must not be invented.

The current runtime also lacks Foundry/solc, therefore compiled bytecode is not claimed as ready.
