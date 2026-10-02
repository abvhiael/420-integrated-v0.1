# Governance integration examples

## Resolve before use

A client should:

1. verify the expected chain ID;
2. use ProtocolRegistry at `0x0000000000000000000000000000000000000434`;
3. resolve the canonical Civic component IDs;
4. verify deployed code exists;
5. verify `systemName()` and `protocolVersion()`;
6. verify Governor/Voting/Registry module bindings;
7. only then present or submit Governance actions.

`wallet/web/core/governance-management.js` is the retained reference client for this fail-closed sequence.

## Inspect a proposal

Read the proposal from CivicProposalRegistry420, frozen rule from CivicGovernor420, electorate snapshot from CivicElectorateRegistry420 and tallies from CivicVoting420.

Do not substitute Search, Explorer or Notification-derived values for those reads when making an authoritative decision.

## Construct an action commitment

Prepare the ordered `CivicGovernor420.Action[]` and call `hashActions(actions)`. Store the resulting bytes32 as the proposal action commitment.

Any later target, native value, calldata, ordering or array-length change produces a different hash and cannot be queued for that proposal.

## Safe vote flow

Before `castVote`:

- confirm proposal is ACTIVE;
- confirm the current block is within the voting window;
- confirm the house is required;
- obtain proof data for the frozen electorate source;
- confirm no prior ballot exists;
- simulate when supported;
- submit once.

Do not automatically resubmit after account/network changes or an uncertain transaction outcome until chain state has been re-read.

## Queue and execute

After deterministic finalization marks a proposal PASSED, reconstruct the exact committed action batch and call `queue`. After the Timelock matures, `GovernanceTimelock.execute(proposalId)` triggers the fixed queued call into CivicGovernor420.

The Timelock operation and the Governor both verify committed state; callers do not gain authority by being the transaction sender.
