# 420 Launchpad architecture

The base Launchpad protocol is composed of `LaunchpadAuthorization420`, `LaunchpadProjectRegistry420`, `LaunchpadSaleRegistry420`, `LaunchpadAllocationRegistry420` and `LaunchpadRouter420`, with stable identifiers in `LaunchpadIds420`.

The router and registries remain non-custodial. They do not supersede Wallet authorization, Token ownership, Registry identity, Governance policy, 420Pay settlement, Arbitration rulings or canonical chain execution.

## Genesis crowdfunding integration

`LaunchpadCrowdfundingIntegration420` is the contract-backed integration boundary for `420/service/launchpad-crowdfunding/v1`. It may be bound once by Launchpad governance to `LaunchpadAllocationRegistry420`. The approved Genesis campaign modes are exactly:

- reward;
- donation;
- community project;
- product preorder.

There is no securities/equity campaign mode.

### 420Pay

A crowdfunding contribution is accepted only when its evidence reference is a globally unused canonical `PaymentRegistry420` payment in `SETTLED` state whose payer, merchant, settlement asset and settlement amount exactly match the participant and sale. Launchpad does not execute the payment or custody proceeds.

For a failed or cancelled sale, the participant prepares a deterministic Launchpad refund batch only after every Pay payment backing that participant's recorded contribution reports canonical refunded state and sufficient refunded amount. Launchpad records the refund after that verification but does not execute it.

### 420 Identity

Participants explicitly bind an active Identity profile they control. Before a crowdfunding contribution, the integration requires the profile to remain active and requires `Identity420.hasValidCredential(profileId, sale.eligibilityPolicyHash)`. The accepted profile is frozen for that participant/sale so later account switching cannot rewrite contribution provenance.

Identity state does not replace the existing CapabilityRegistry action authorization; both checks apply.

### 420 Arbitration

A Launchpad dispute link is accepted only when the canonical Arbitration case identifies the participant as claimant, the project controller as respondent, the Launchpad component as origin and the exact sale ID as origin object under the Launchpad crowdfunding arbitration domain.

Finalized rulings are published as remedy evidence. Launchpad does not acquire Arbitration ruling authority, directly cancel a sale because of a ruling, or reverse/execute a 420Pay refund. Any resulting lifecycle or settlement action remains with its canonical owning authority.

### 420Reputation

The integration publishes replay-protected crowdfunding evidence for two canonical Reputation interaction kinds: `CONTRIBUTION` and `REWARD_DELIVERY`. Contribution evidence preserves the canonical 420Pay payment ID; delivery evidence preserves the Launchpad delivery commitment. These records are inputs to the derived, domain-scoped 420Reputation service and never create a universal score or settlement authority.

### 420Notifications

Canonical sale creation/state events remain on `LaunchpadSaleRegistry420`. The integration additionally emits deterministic, replay-protected contribution, refund, delivery, dispute and ruling notification-source events. 420Notifications remains a non-authoritative consumer of these events.

## Replay and idempotency

The crowdfunding boundary enforces one-use payment IDs, one-use prepared refund commitments, one-use delivery commitments, one linked dispute per participant/sale, one published finalized dispute outcome per case, deterministic notification event IDs and deterministic Reputation evidence keys.

See also [canonical Launchpad protocol architecture](../../architecture/protocols/launchpad.md).
