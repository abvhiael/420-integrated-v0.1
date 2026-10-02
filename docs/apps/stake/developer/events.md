# 420 Stake events and finality

420 Stake has no independent canonical event stream. Consumers derive the validator/staking view from the contracts that own the state.

## ValidatorRegistry

Canonical events are:

- `CommunityValidatorReserveBound(reserve)`
- `ProtocolCreditReceived(validatorId, beneficiary, amount)`
- `PendingProtocolCreditReturned(validatorId, amount)`
- `ValidatorRegistered(validatorId, owner, withdrawal, ownedBond, protocolCredit)`
- `OwnedBondToppedUp(validatorId, amount, ownedBond)`
- `ProtocolCreditReplaced(validatorId, amount, ownedBond, protocolCredit)`
- `ConsensusStateApplied(validatorId, previousStatus, newStatus, effectiveSlot, activationRotation, scheduledExitRotation, cooldownUntilRotation)`
- `ExitNoticeApplied(validatorId, noticeRotation, exitEligibleRotation)`
- `SlashApplied(validatorId, offense, correlationTier, ownedSlashed, creditSlashed, evidenceHash, resultingStatus)`
- `ValidatorBondWithdrawn(validatorId, withdrawal, ownedAmount, recycledCredit)`
- `RotationSnapshotApplied(rotation, eligibleCount, candidateTarget, activeTarget)`
- `ActiveTargetChanged(previousTarget, newTarget, rotation, safetyOverride)`

`SlashApplied.resultingStatus` is part of the canonical event so Indexer consumers can reconstruct the lifecycle change caused by a slash without inventing state.

## RewardController

`RewardApplied(blockNumber, proposer, proposerAmount, participantAmount, attentionAmount, developmentAmount)` records the accepted consensus-issued accounting result. `participantAmount` is the aggregate amount issued to accepted non-proposer participants for that block.

A reward block is single-use in `RewardController`. Indexers must not interpret duplicate delivery, replayed logs, or projection retries as a second issuance.

## Finality and reorg handling

Registration, collateral/lifecycle changes, exits, slash outcomes, and reward accounting are canonical only in the canonical chain state. Indexed consumers must reconcile reorgs and distinguish head observations from finalized state. A pre-finality lifecycle transition must not be treated as irreversible.
