# 420 Governance user guide

## Understanding a proposal

Before voting, verify:

- proposal ID and proposer;
- proposal class G1–G4;
- current lifecycle state;
- snapshot block and voting window;
- metadata hash;
- exact `actionsHash`;
- frozen constitutional revision;
- COMMUNITY electorate root and total weight;
- VALIDATOR electorate information when dual-house voting is required;
- quorum and approval thresholds for each required house.

A frontend summary is presentation data. The committed hashes, frozen rule and on-chain proposal/electorate state are authoritative.

## Voting

`CivicVoting420` supports AGAINST, FOR and ABSTAIN.

Eligibility is determined only from the electorate snapshot frozen for that proposal. A valid ballot records the resolved weight and cannot be replaced or cast twice by the same account in the same house.

The canonical equal-weight sources use one eligible member = one vote. Validator bond size, delegation, rewards or protocol credit do not increase Civic validator voting weight.

## Proposal results

After the voting window closes, anyone may call the deterministic finalizer. A proposal passes only when every required house meets its frozen quorum and approval threshold.

Abstain contributes to participation/quorum but not to decisive FOR-versus-AGAINST approval.

For dual-house proposals, both COMMUNITY and VALIDATOR houses must pass.

## Queue and execution

A passed proposal can be queued only with the exact action batch whose encoded hash equals the proposal's `actionsHash`. The Timelock then enforces the frozen class delay.

Execution is atomic. If a target action reverts, the full Governance batch reverts and the proposal remains queued for a later valid execution attempt.

## Cancellation

Canonical Civic v1 proposals are not cancellable after creation. There is no proposer-cancel, operator-cancel, emergency-council-cancel or capability-cancel path.

## Wallet limitations

The qualified ordinary Wallet interface supports discovery, proposal inspection, eligibility and voting. It intentionally does not expose proposal creation, queueing or execution controls.

Developers/operators may interact with those public contract methods directly, but doing so does not bypass lifecycle, commitment, electorate, threshold or Timelock requirements.
