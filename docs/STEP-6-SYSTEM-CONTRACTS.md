
# Step 6 — Protocol Application Layer & Genesis System Contracts

Status: **FOUNDATION IMPLEMENTED; GENESIS CODE PLACEMENT NOT YET FROZEN**

Step 6 begins the EVM/system-contract layer that sits beneath 420 Integrated applications.

## Corrected system-address registry

The canonical reserved assignments now include the complete contiguous range used so far:

- 0x...0420 RewardController
- 0x...0421 AttentionTreasury
- 0x...0422 DevelopmentTreasury
- 0x...0423 ValidatorRegistry
- 0x...0424 ProtocolReserve
- 0x...0425 CommunityValidatorReserve
- 0x...0426 CommunityRewardReserve
- 0x...0427 FounderVestingRegistry
- 0x...0428 RandomnessRegistry
- 0x...0429 GovernanceTimelock
- 0x...042A PublicDistributionVault
- 0x...042B GenesisDEXFactory
- 0x...042C PublicBatchAuction
- 0x...042D TWAPOracle
- 0x...042E ValidatorBootstrapReserve
- 0x...042F AIProviderRegistry
- 0x...0430 AIModelRegistry
- 0x...0431 AIJobManager
- 0x...0432 AIJobEscrow
- 0x...0433 AIReputationRegistry

The earlier AI-only registry fragment is superseded.

## Consensus vs application authority

Consensus remains authoritative for:
- committee membership;
- proposer schedule;
- attestations/QCs;
- finality;
- slashing;
- randomness;
- exact native issuance.

System contracts mirror or receive deterministic finalized state. They do not independently
recompute consensus authority.

## Contracts implemented in this foundation

- ValidatorRegistry
- RewardController
- AttentionTreasury
- DevelopmentTreasury
- CommunityValidatorReserve
- FounderVestingRegistry
- AIProviderRegistry
- AIModelRegistry
- AIJobManager
- AIJobEscrow
- AIReputationRegistry
- CannaseurCampaignRegistry scaffold

Several additional reserved contracts still need their full implementations: ProtocolReserve,
CommunityRewardReserve, RandomnessRegistry, GovernanceTimelock, PublicDistributionVault,
GenesisDEXFactory, PublicBatchAuction, TWAPOracle and ValidatorBootstrapReserve.

## Application signing namespace

AI/Cannaseur application signatures now use `420/APP/*` domains stored separately in
`config/application-domains.json`. This avoids modifying Decision 16's frozen consensus-signing
domain namespace.

## Important unresolved deployment issue

Reserved addresses cannot be achieved by ordinary Solidity CREATE deployment. Step 6.1 must freeze
how system bytecode and initial storage are placed at the reserved addresses, most likely by generated
genesis code/storage allocations or a deterministic privileged genesis-state transition.

Until that is specified and tested, these contracts are source-level protocol definitions rather
than a deployable mainnet system-contract set.
