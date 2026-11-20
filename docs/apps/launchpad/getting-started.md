# Getting started with 420 Launchpad

420 Launchpad offers a campaign catalogue, canonical participant portfolio, 420Pay checkout, Identity and 420Arbitration tools. The app is not live until its configured RPC, Registry-resolved contracts, API and indexer projection are independently verified.

## Join a crowdfunding campaign

1. Search and filter the campaign catalogue, then open a sale. Review the controller, payout merchant, accepted asset, hard and wallet caps, token allocation, expiry and eligibility policy. Registration is not endorsement.
2. Connect Wallet on the configured chain. Bind an active 420Identity profile that you control and check its valid campaign credential and sale-scoped contribution authorization.
3. Enter your contribution in **raw settlement-token units** and generate a unique nonce. Check the campaign's remaining funding and personal capacity; these figures are not reservations.
4. Review and submit a Launchpad contribution intent. The app derives a campaign/account/amount/nonce-bound 420Pay invoice ID, which the **campaign merchant** must create as a matching single-use invoice.
5. Once the merchant invoice is live, use a verified, canonical 420Pay converted-invoice quote for an approved input token and market pool. Native-420-only invoice checkout is not compatible with Launchpad V1's nonzero ERC-20 settlement asset. Confirm input maximum, exact settlement principal, conversion fee, slippage and expiry. Wallet gas is additional.
6. Review any necessary **exact pool-token approval**, authorize in Wallet and request a **new quote**. Then review and authorize the 420Pay payment in Wallet, never through a backend signer.
7. Check canonical 420Pay settlement by refreshing the invoice. The app retrieves the payment ID automatically from the canonical invoice mapping. Once Pay shows matching **SETTLED** payment and sufficient capacity/authorization, review the separate Launchpad contribution-recording transaction.
8. Review your canonical contribution/payment history, refund delivery and claim/fulfillment status in the participant panel. Successful-sale claims require controller delivery attestation and the claim period; failed/cancelled sales need **delivered Pay refunds** before Launchpad batch reconciliation.
9. For disputes, submit a valid evidence/remedy hash to 420Arbitration through Wallet, recover the case ID from the confirmed event, link it to the campaign, and track status. Case publication does not by itself refund or cancel a sale.

**Important:** 420Pay checkout and Launchpad contribution recording are different transactions. A settled Pay transaction does not guarantee Launchpad allocation: capacity and authorization may change before recording. If recording becomes impossible, obtain the refund from 420Pay and use the delivered unallocated-payment reconciliation path. A local list of recent invoice intents helps recover payment IDs after reload; never rely on browser history alone for evidence.

Always verify canonical transaction/receipt state before resubmitting a transaction after a timeout, network change or reorg. Project registration and lifecycle actions remain governed; the creator panel prepares requests rather than mutating governance state.

For campaign creators, use the [Creator studio and governance guide](creator-guide.md). See the [consumer guide](user-guide.md), [fee explanation](fees.md), [security notes](security.md) and [recovery guidance](troubleshooting.md). Never disclose signing keys, recovery phrases or other secrets.
