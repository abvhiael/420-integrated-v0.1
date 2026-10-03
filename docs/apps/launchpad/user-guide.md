# 420 Launchpad user guide

## Browse campaigns

The user-facing Launchpad application loads campaign discovery from the configured Launchpad projection service because project and sale mappings are not enumerable on-chain. The projection is accepted only when it carries the expected schema plus canonical chain provenance. Campaign detail exposes the sale/project identifiers, controller, payment asset, proceeds receiver, eligibility policy, caps, raised amount, mode and lifecycle state.

Projection data is a rebuildable discovery view. Canonical contract state remains authoritative.

## Runtime and Wallet checks

Before execution is enabled, the application service resolves `420/service/launchpad/v1` through the canonical ProtocolRegistry and derives the Router, SaleRegistry, AllocationRegistry, CrowdfundingIntegration and ProjectRegistry bindings from deployed contract getters. The browser also requires the connected wallet chain to match the resolved service chain.

If the network, service API, Registry resolution, contract bindings or canonical review are missing, execution stays fail-closed.

## Contribute

A crowdfunding contribution requires an already-settled canonical 420Pay payment ID. Enter the amount and payment ID, then review the prepared transaction target, calldata and value before sending it to the wallet. The on-chain crowdfunding integration independently verifies payer, receiver, payment asset, amount, receipt and replay state.

Do not treat a submitted transaction as accepted until canonical chain state confirms it.

## Claim

After a sale succeeds and the claim period begins, supply the delivery commitment and prepare the claim transaction. Review the exact AllocationRegistry transaction before signing. The Launchpad record is protocol evidence; it does not itself transfer or custody the delivered asset.

## Refund

Failed or cancelled campaigns use a two-phase flow:

1. prepare the canonical refund batch after the underlying 420Pay payments show sufficient refunded state;
2. after the prepared refund commitment is available from canonical state, enter that commitment and prepare `recordRefund`.

The UI shows participant contribution, claim and refund status from direct AllocationRegistry reads.

## Creator campaign management

Project registration and sale lifecycle mutation are governance-only in the canonical contracts. The creator surface therefore creates bounded governance request drafts for existing-campaign actions such as campaign-mode selection, activation, finalization and cancellation. It does **not** create a direct creator transaction or broaden contract authority.

## Loading, failure and recovery

The application exposes loading, empty, runtime-unresolved, service error, transaction-review, submitted-transaction and recovery guidance states. A failed or timed-out client request does not prove a write failed. Verify canonical transaction and contract state before retrying.

Never disclose recovery material or signing secrets to a project, operator or support channel.
