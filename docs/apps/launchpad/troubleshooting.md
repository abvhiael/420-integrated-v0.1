# 420 Launchpad troubleshooting and recovery

## Campaign not found or filter page expired

Check the chain, project ID and sale ID. Projection search is an indexed discovery view, not live contract state. If a pagination cursor is stale, restart the search. If the canonical on-chain project or campaign mode differs from the projection, do not transact; refresh discovery.

## Eligibility or capacity unavailable

Verify Wallet network and account, bound 420Identity profile controller/active status, campaign-specific credential validity, separate CapabilityRegistry contribution authorization, sale mode/state/window, hard cap, wallet cap and the 32-payment-per-sale reference limit. Intent registration does not reserve remaining capacity.

## Invoice cannot be paid

The merchant must publish the exact single-use 420Pay invoice for the on-chain intent ID. Wrong amount, merchant, expiry, settlement asset, missing approved market, stale quote, insufficient input balance/allowance, incompatible gas or non-exact converted settlement all prevent checkout. Launchpad V1's nonzero ERC-20 payment asset cannot be funded by a native-420-only checkout. Refresh the quote after approval; never silently increase an allowance.

## Paid 420Pay invoice, but no Launchpad contribution

These are distinct transactions. Use the saved campaign/account/nonce/amount to refresh invoice state and retrieve the canonical payment ID. Confirm settlement, capacity, participation cap and eligibility before preparing the separate contribution record. If the allocation path is no longer available, follow the merchant/420Pay refund process. Once 420Pay records **fully delivered principal**, the browser can prepare unallocated-payment reconciliation. Launchpad does not itself execute refunds. An authorized but undelivered refund is not enough.

## Refund preparation or recording fails

For a failed/cancelled sale, every recorded backing payment must have a delivered principal refund in 420Pay; partial delivery is insufficient for batch completion. Check the payment history and delivered amount. The browser reads the contract's prepared refund commitment automatically; do not invent or paste another batch ID. Check permission to record a refund and ensure it has not already been recorded.

## Claim unavailable

Verify sale success and claim-start time, nonzero allocation, controller-attested delivery commitment, separate claim permission, and every backing payment's current 420Pay status. A refunded or refund-authorized payment cannot also support a claim. Attestation/claim is protocol evidence and not independently verified physical delivery.

## Dispute case cannot be linked

The case must have an active 420Arbitration crowdfunding policy and match the claimant Wallet, project-controller respondent, crowdfunding domain, Launchpad component and sale. Recover the case ID from the **canonical CaseOpened transaction receipt** and link it separately. Only finalized case rulings can be published as Launchpad evidence; publication never directly cancels sales or transfers funds.

## Transaction shows UNKNOWN, PENDING or REORGED

A Wallet submission hash alone is not proof of success. Check confirmed/finalized transaction status, chain/account, canonical payment and current Launchpad position before considering resubmission. On a different device, a prior browser-local intent or transaction may not be available; rely on official Wallet and chain records. Never share passwords, recovery phrases, private keys or signing approvals with support.
