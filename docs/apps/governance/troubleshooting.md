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


## GOV-PRE-08 candidate will not freeze or fund

Run \`python3 scripts/gov-pre-08/plan.py --without-artifacts\` to check the 42m ledger, all 13 additive allocation amounts, fixed system destinations, 4.2m/840k non-additive earmarks, 50/25/25 founding entitlement, 10% community reward share, 60/15/30 retirement thresholds and V3-to-V4 source-blob drift. After compiling the focused sources, remove \`--without-artifacts\` to require all 14 real ABI/creation/runtime templates; the output **does not bind constructor immutables to verified deployed code**. Always keep deployed addresses, granted capabilities and funding receipts unknown until independently witnessed.

If a former V3 job fails on \`FROZEN_V3 authority input drift\`, **do not** update that historical hash or bypass its assertion. The working V4 ledger needs an independently authorized new V4 freeze and complete runtime/storage regeneration. Similarly, a failed source-provenance check in Stake or a Token/Swap frozen commitment is not proof of a successful V4 migration; it is a release blocker. Do not rebrand unsigned local constructor fixtures as live founder signatures, funding transfers, community sweep or Genesis allocations.

If a cold start fails before launch, preserve the original canonical artifacts and recorded source SHA, stop, identify mismatched authority inputs and requalify a fresh **unsigned** candidate. If it fails after deployment, use the established governed Timelock/bootstrap and chain recovery procedures; do not mint corrective funds, assign phantom founders, manually patch on-chain storage, or duplicate any Treasury/Vault release. Reconstruct native and ERC20 transfers from finalized account balances, Registry/capability grants, VaultAccounting and transaction receipts before declaring settlement or retirement custody handoff.
