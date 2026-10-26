# HC-SEED-09 — Marketplace and payments

## Implemented scope

Authenticated players can browse Emerald Coast, Golden Prairie, Red Mesa and World packs from `/seeds`, linked from the ordinary/canonical marketplace. One pack contains three seeds of one cultivar, costs **420 BUDS or 1 native $420 (10^18 wei)**, and retains the exact 60% common / 30% rare / 10% Original Sixteen odds. There is no fiat interpretation, ERC20 payment, currency conversion, paid odds boost or extra rarity roll. Native network gas is separate.

The checkout review precedes spending. BUDS confirmation is an atomic database debit, versioned game-currency sink/burn, paid purchase record and owned-pack creation. `issued` does not increase. Native checkout presents a buyer-bound wallet transaction and independently reconciles a finalized canonical payment receipt before creating the owned pack. Browser transaction hashes and success messages cannot admit ownership. History joins the purchase, pack, verified outcome, seed-lot intent and actual finalized seed issuance; local inventory is never fabricated.

## Reservation and exactly-once delivery

An authenticated operation ID is scoped to the registered principal and game. Reusing it returns the same checkout; changing currency or region rejects. Each checkout fixes one pack, original linked wallet/profile, policy, region, amount, eligible registered genomes and payment deployment. Before payment, all genomes and the canonical opening pool must validate. One SERIALIZABLE transaction reserves one pool pack and three units for every eligible cultivar. Operator allocations and starter grants honor these holds. At most eight unpaid checkouts per principal may remain outstanding.

A paid sealed pack retains its genetic capacity reservation. HC-SEED-08 transfers that reservation into its one immutable opening rather than reserving again. Its verified result releases the unselected holds and reserves the selected three seed units exactly once. A purchased pack cannot silently change genomes, move to another wallet, shrink a tier or exceed supply. Preparation and dispatch revalidate the paid source as well as the existing opening and issuance evidence. Existing authorized allocation and fixed starter provenance remain supported.

BUDS are consumed only by explicit purchase confirmation, with the debit, burn total, source receipt and owned pack committed together. The durable purchase is the unique settlement record. Insufficient funds, revoked sessions, changed wallet/profile, failed database transactions and duplicate requests cannot create an unpaid pack or second debit. A response lost after commit is recovered through the same checkout/history.

## Native payment and quote authority

`SeedPackPayments` has immutable game, HC-SEED-07 policy hash, treasury, EmergencyState and EOA quote signer. It accepts exactly 1 ether-denominated native $420 per receipt. It does not draw randomness or mint seeds. A `personal_sign` quote binds its domain, chain ID, contract, game, policy, buyer, checkout key, commitment, pool and exact price. The contract checks the canonical low-s signature before accepting funds. This prevents arbitrary or unrecognized wallet payments without an authorized, capacity-backed checkout. Changing buyer, commitment, pool, chain or payment deployment invalidates the quote.

The service records the reservation before asking its separately configured external signer for a quote. It never loads a player private key. It independently reads back the deployment and preflights `quoteValid` through the pinned finalized RPC before returning payable calldata. Interrupted/failed signing leaves one recoverable pending checkout. An ordinary runtime without a quote signer exposes BUDS checkout and disables native checkout; no signer is silently substituted. The production entry point uses its configured external signer RPC, which must explicitly support `personal_sign` for the reviewed quote-signer account.

The receipt key is `keccak256(abi.encode(gameId, buyer, checkoutKey))`. Duplicate payment reverts before a second charge. Payment state and the exact `PackPaid` event must agree on buyer, commitment, pool and amount at finalized canonical blocks. The reader pins payment and emergency runtime code, all immutable deployment getters, chain ID, event transaction identity and block anchors. Stale/reorged, wrong-code, wrong-payer, wrong-purpose, wrong-amount or missing events never authorize a pack. Native source evidence is re-read before opening and seed dispatch.

Treasury proceeds use explicit pull withdrawal. Receipt credit is recorded before any treasury call; a rejecting treasury cannot strand checkout, and a failed withdrawal restores its credit. The market emergency domain stops new native payments and BUDS spending. It does not erase existing receipts or prevent unpaid cancellation and reconciliation.

## Pending and cancellation rules

Wallet rejection, wrong network, unavailable RPC and unknown/unfinalized transactions leave the original checkout pending. The browser does not regenerate a checkout, assert payment from a transaction hash, auto-connect a wallet, silently switch networks or sign without an explicit payment button. Resume and confirmation controls recover the same ID. BUDS pending history uses a review/confirmation action; a status check does not secretly debit BUDS.

An unpaid BUDS checkout may cancel and release its pack/genome holds atomically. Native cancellation requires the buyer's explicit zero-value `cancel(key)` wallet transaction. That permanently prevents any later payment of the same key. Only its independently verified finalized `PackCancelled` receipt releases the holds. Unknown payment status never implies cancellation. If payment wins the race, reconciliation delivers the pack instead. Paid purchases cannot refund, cancel, reseal an opened result or create a new draw. Provider delay retains the existing entitlement. Restoring the original authorized wallet/profile may be required for seed issuance after unlinking.

## Runtime/API

Enable only reviewed `seedPurchases.version = HC.SEED.PURCHASES.V1` with seed catalogue, packs, canonical openings, pinned `rpc.contracts.seedPayments` and `rpc.contracts.emergency`, actual treasury/quoteSigner and the existing authenticated external signer. The unresolved activation template is `deployments/highcountry/seed-purchase-runtime.v1.json`. No live provider, deployed payment contract, treasury, quote key, registered genome set or actual chain transaction is invented.

Authenticated POST routes, with exact field sets:

- `/seeds/packs/shop {}`: offers, fixed policy, BUDS balance and owner-only purchase/delivery history.
- `/seeds/packs/purchase-prepare {operation,region,currency}`: recoverable reservation and review; currencies are `BUDS` or `420`.
- `/seeds/packs/purchase-confirm {purchaseId}`: explicit BUDS spend or independent native reconciliation.
- `/seeds/packs/purchase-cancel {purchaseId}`: unpaid BUDS cancel or native cancellation/payment reconciliation.

Existing HC-SEED-08 open/reconcile and HC-SEED-07 prepare/confirm/issuer workers complete delivery. HTTP origin/session checks and exact request schemas reject client prices, quantities, recipients, entropy, fabricated receipts and arbitrary transaction facts. PostgreSQL schema 1 adds `seedPurchases` and `seedPurchaseHolds` with backward-compatible empty-map defaults; existing namespace RLS and restricted runtime role remain unchanged.

## Scoped qualification

Dedicated HC-SEED-09 CI covers purchase/HTTP/browser interactions, affected issuance/opening/marketplace regressions, PostgreSQL 16 racing checkout/confirmation and independent restart, both currencies through owned pack/opening/seed-lot delivery, restricted-role/RLS, actual native payment contracts and a real Chromium production-module checkout flow. The browser and PostgreSQL tests explicitly use test-only RPC/wallet transports; Solidity tests independently execute real payment logic and cryptographic quote checks. They do not claim live-chain deployment or production VRF evidence.

The qualified implementation SHA and exact CI run are recorded in the PR. Unchanged contract and genetics evidence from HC-SEED-07/08 is retained. No unrelated global or Docs qualification is manually rerun. Existing separately documented founder-art count and RandomnessRegistry Genesis-artifact reconciliation remain outside this feature's passing scoped checks. Live activation still requires the actual reviewed deployment, quote authority, production randomness route and authorized genome registration.
