# 420 Launchpad fees and economics

A campaign's **contribution principal** is the exact ERC-20 settlement-token amount defined in its canonical sale and the single-use 420Pay invoice. The remaining campaign cap and per-wallet cap are gross recorded amounts, not reserved or refunded balances. Values displayed in the Launchpad contribution panel are integer base units of the settlement token.

The verified 420Pay **converted-invoice quote** specifies the input asset, maximum amount it can spend, conversion fee, slippage/price impact, minimum output, exact quoted settlement amount and expiry. The quoted settlement must match the invoice principal exactly; a larger or smaller amount is rejected. The browser reads current token balance and approved market-pool allowance before offering checkout.

**Network gas** is separate and is reviewed by Wallet for (at least) contribution-intent registration, ERC-20 approval if needed, the 420Pay checkout and Launchpad contribution recording. Gas is never represented as a verified or zero-valued amount in a Launchpad quote. Re-quotes are necessary after token approval and when quotes expire. No unverified fiat conversion or protocol-fee estimate is shown.

Refunds are delivered and accounted for by canonical 420Pay. Launchpad merely records delivered-principal reconciliation, which does not rewrite the historical gross raised total. Documentation and UI estimates are not payment authority.
