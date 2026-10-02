# 420 Launchpad security

Launchpad registration is not endorsement. Treat project metadata, social links and promotional claims as untrusted until independently verified.

Critical checks include project controller, sale asset, contract addresses, network, active sale state, contribution limits, allocation rules and final transaction calldata/value. Never sign an unexpected approval or unlimited spend merely because a Launchpad page requests it.

Timeouts and UI errors do not prove a write failed. Check canonical transaction state before retrying to avoid duplicate contributions.

## Crowdfunding dependency controls

For the Genesis crowdfunding modes, contribution evidence must resolve to a canonical 420Pay payment already in `SETTLED` state with exact participant, recipient, settlement asset and amount binding. Payment IDs are globally one-use at the Launchpad crowdfunding boundary.

The Identity profile bound to a participant must remain active, controlled by that participant and hold a currently valid credential whose type equals the sale's `eligibilityPolicyHash`. CapabilityRegistry authorization remains independently required.

Refund recording is fail-closed until the canonical Pay records backing the participant's contribution show sufficient refunded amounts. Launchpad records refund evidence but cannot execute the refund itself.

Disputes are linked only to canonical Arbitration cases with the exact crowdfunding domain, Launchpad component, sale ID, participant claimant and project-controller respondent. Finalized rulings are evidence; they do not grant Launchpad ruling, confiscation, cancellation or Pay authority.

Reputation and Notifications outputs are derived application evidence. They cannot authorize settlement, identity, wallet execution, governance, campaign state or universal scoring.

Replay protection covers payment IDs, refund batches, delivery commitments, dispute linkage/outcome publication, Reputation evidence and notification event IDs.

The Genesis campaign-mode enum contains reward, donation, community project and product preorder only. Securities/equity remains disabled and is not representable through the Audit-3 integration contract.
