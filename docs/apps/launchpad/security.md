# 420 Launchpad security

Launchpad registration is not endorsement. Treat project metadata, social links and promotional claims as untrusted until independently verified.

Critical checks include project controller, sale asset, contract addresses, network, active sale state, contribution limits, allocation rules and final transaction calldata/value. Never sign an unexpected approval or unlimited spend merely because a Launchpad page requests it.

Timeouts and UI errors do not prove a write failed. Check canonical transaction state before retrying to avoid duplicate contributions.

## Crowdfunding dependency controls

For the Genesis crowdfunding modes, contribution evidence must resolve to a canonical 420Pay payment already in `SETTLED` state with exact participant, recipient, settlement asset and amount binding. Before checkout the participant registers a contribution intent with an invoice ID derived from chain ID, integration address, sale ID, participant, amount and payer nonce. The merchant must subsequently create the single-use invoice; the contract checks its expiry, closure and exact canonical 420Pay checkout payment pointer. Both payment IDs and invoice IDs are globally one-use for contribution recording. The preflight is not a reservation of capacity. If checkout succeeds but the contribution cannot be recorded, the participant can reconcile the unallocated payment after Pay actually delivers its refund; the recovery does not increase campaign raised balances.

The Identity profile bound to a participant must remain active, controlled by that participant and hold a currently valid credential whose type equals the sale's `eligibilityPolicyHash`. CapabilityRegistry authorization remains independently required.

Refund recording is fail-closed until the canonical RefundManager420 delivery ledger proves reimbursement of every backing payment, including tips where present. Pay authorization and actual delivery are distinct. Both preparation and recording recheck delivery. Permissionless per-payment reconciliation checkpoints track delivered principal separately from gross V1 contribution and raised history. Launchpad records evidence but cannot execute refunds. A later refund authorization prevents a new crowdfunding claim against the affected payment. Gross sale finalization remains based on the V1 recorded contributions; these checkpoints do not establish a continuously current net funding total.

Disputes are linked only to canonical Arbitration cases with the exact crowdfunding domain, Launchpad component, sale ID, participant claimant and project-controller respondent. Finalized rulings are evidence; they do not grant Launchpad ruling, confiscation, cancellation or Pay authority.

Project-controller delivery attestation and participant acknowledgement must match before a crowdfunding reward claim is recorded. A zero floor allocation is not claimable. Bilateral delivery evidence is not independently verified physical delivery. Reputation and Notifications outputs are derived application evidence. They cannot authorize settlement, identity, wallet execution, governance, campaign state or universal scoring.

Replay protection covers payment IDs, refund batches, delivery commitments, dispute linkage/outcome publication, Reputation evidence and notification event IDs.

The Genesis campaign-mode enum contains reward, donation, community project and product preorder only. Securities/equity remains disabled and is not representable through the Audit-3 integration contract.
