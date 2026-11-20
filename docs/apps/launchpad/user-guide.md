# 420 Launchpad consumer crowdfunding guide — REC-2

## Browse, search and verify

Browse the canonical Launchpad projection catalogue, search campaign names/descriptions/project/sale IDs, and filter by campaign type and lifecycle state. Pagination cursors are tied to a projection block hash; refresh when a cursor becomes stale. Projection data is discovery-only. Selecting a sale obtains current chain data for sale state, identity, caps, settlement and contributions. Registration is not endorsement. Equities/securities are not supported.

## Identity and capacity

Connect Wallet on the Registry-resolved chain. Bind an active Identity profile owned by your connected wallet. The service verifies owner, active state, credential matching the campaign eligibility policy and the frozen per-sale profile. If ownership or credential validity changes, checkout is disabled. Amounts are raw integer settlement-token units. Remaining capacity is the gross recorded hard cap less gross raised; per-wallet capacity is per-wallet cap less recorded contributions. These are observations, not reservations; another participant may consume capacity first.

## Integrated 420Pay conversion checkout

1. Choose principal and create a unique nonce. Review and submit the registered contribution intent in Wallet. The invoice identity is bound to chain, contract, sale, participant, amount and nonce; it does not reserve capacity or move assets.
2. The **campaign merchant** must create the matching single-use 420Pay invoice for the exact sale recipient, principal and valid expiry. The consumer service cannot create an invoice as another merchant.
3. Launchpad V1 requires a nonzero ERC-20 settlement asset. Native-only 420Pay hosted checkout cannot settle Launchpad contributions, so the consumer uses a verified **420Pay converted invoice quote** for an approved input token/market.
4. The quote engine is read through the canonical Pay dependency Registry with matching code hashes. The service verifies market pool, input/settlement pair, payer, merchant, exact invoice principal, token balance and pool allowance. Review maximum input, conversion fee, slippage and quote expiry, with Wallet gas disclosed separately. Quotes settling even slightly more or less than the principal are rejected.
5. If needed, review an exact input-token approval for the canonical pool, submit through Wallet, and request a new quote. Approval and payment are separate.
6. Review the canonical Pay Router converted-checkout transaction and authorize it only in Wallet. The backend does not transmit signed transactions or hold keys.
7. Refresh checkout. The service retrieves the 420Pay payment ID from the canonical invoice-to-payment mapping and verifies payer, merchant, asset, exact settlement amount and SETTLED status. Only then review and submit contribution recording on Launchpad's AllocationRegistry.

**Important:** 420Pay checkout and Launchpad recording are NOT atomic. A cap, deadline or authorization can change between them. If a settled payment cannot be recorded, obtain a delivered 420Pay refund before using the unallocated-payment reconciliation path. Refunds are delivered by Pay, not Launchpad. Sale raised is historical gross funding and is not live net-of-refunds capacity.

## History, claims and refunds

The consumer loads canonical payment IDs from the campaign integration, checks each against Pay and displays payment state, principal and delivered refund progress. The project controller must first attest delivery for a successful sale; the participant claims only the matching commitment once the claim period begins and the backing Pay records are not refunded. A claim is audit evidence, not independent proof of physical fulfillment.

For failed or cancelled sales, the actual 420Pay refunds must be delivered before Launchpad prepares the refund batch. The prepared commitment is retrieved automatically from chain state; users then review its recordRefund transaction. Partial refund checkpoints do not mark a batch fully refunded. Unallocated refunds must be fully delivered by Pay before reconciliation.

## 420Arbitration

Provide hashes of claim evidence and requested remedy. Review a canonical ArbitrationCaseRegistry openCase transaction against the campaign project controller. After confirming the transaction, recover the case ID from the CaseOpened event, link the case to the exact crowdfunding sale, and inspect canonical case state and finalized outcome publication. Linking or publishing an arbitration case does NOT transfer authority to cancel a campaign or execute refunds.

## Transaction status and recovery

A browser-local recent transaction hash is scoped by wallet, chain and sale. Read canonical transaction/receipt state: UNKNOWN, PENDING, CONFIRMED, FINALIZED, REVERTED or REORGED. Submission is not finality; check Wallet activity and current Pay and Launchpad state before trying again. Changing wallet account/chain invalidates the session. Never share recovery material.

## Creator authority and deployment

Creator lifecycle actions remain governance-only drafts. The consumer cannot self-authorize a sale or register an arbitrary project. Runtime must resolve the actual Registry, chain, API and projection before enabling actions. Local REC-2 code qualification is possible without a live testnet; this guide does not assert live deployment readiness.
