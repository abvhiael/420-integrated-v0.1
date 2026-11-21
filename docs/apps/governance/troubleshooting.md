# 420 Governance troubleshooting

## Wallet says Governance discovery is invalid

Check the active chain and ProtocolRegistry at `0x0000000000000000000000000000000000000434`. The Wallet fails closed when component resolution, code presence, contract identity, protocol version or module bindings differ from the qualified Governance graph.

Do not bypass this check by hard-coding a module address.

## Wrong network or account changed

Reconnect the expected account and 420 network, then reload Governance state. A pending user action must not be automatically resubmitted after account/network change.

## No voting weight / ineligible

Eligibility comes from the proposal's frozen electorate source/root. Current stake, current membership or later source revisions cannot retroactively change a proposal snapshot.

For validator voting, bond size does not increase weight; a valid canonical member has one vote.

## Already voted

Ballots are immutable. Do not retry with a different support value.

## Voting not started / ended

Use the on-chain `voteStart` and `voteEnd` block numbers from `CivicProposalRegistry420`.

## Proposal will not finalize

Finalization is valid only after `block.number > voteEnd`. Check each required house's participation, quorum and approval.

## Queue fails with action hash mismatch

Reconstruct the exact `CivicGovernor420.Action[]` batch originally committed by `actionsHash`. Do not edit target, value, calldata, ordering or array length.

## Timelock says operation is immature

Wait until `executeAfter`. Constitutional rule revisions cannot shorten the delay already frozen for an existing proposal.

## Execution failed

A target action reverted or exact value requirements were not met. Because execution is atomic, no successful earlier action in that batch remains committed. Diagnose the target and retry the same queued committed batch when valid.

## Proposal cannot be cancelled

That is canonical behavior. Civic v1 has no post-creation cancellation transition.

## Bootstrap activation fails

Verify the exact module graph, COMMUNITY/VALIDATOR sources, revision-1 G1–G4 rules, Proposal/Electorate Registry authority bindings, Governance420 compatibility pointer, seven Registry component resolutions and active Governance service publication.

If pre-activation state is wrong, discard/redeploy the candidate rather than patching guessed values. After Civic activation, bootstrap rollback is intentionally unavailable.

## GOV-REC-6 candidate missing approval or artifact drift

When `verify-governance-rec-6.py` reports `PENDING_FAIL_CLOSED` in offline mode, **do not treat that as a code failure**: it means authentic chain-specific electorates and a complete approved plan have not been materialized. The strict `--require-activation-ready` form must fail for current five zero-valued fields. A partial configuration, forged fixture, different chain, mismatched actual code hash or wrong predeploy storage slot is a **release integrity failure**, never a reason to override the check.

When exact retained artifacts disagree with a clean compiler rebuild, stop and inspect compiler pin, immutable values, generated ABI/layout, Git source blob SHA and Genesis plan. Reconcile as one source-qualified candidate; never edit only the expected hash. A failed original Timelock operation must be retried only under the original mature operation ID. If that operation cannot succeed under its approved commitment, abandon the unreleased candidate. After Civic activation there is no bootstrap rollback or operator emergency authority.

Refer to [GOV-REC-6 cold-start runbook](cold-start.md) for the exact 19-step execution order and proof requirements.
