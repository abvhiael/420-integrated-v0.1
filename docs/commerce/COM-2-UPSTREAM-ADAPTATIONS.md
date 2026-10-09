# COM-2 — Contracts / upstream adaptations

Canonical definition: inspect first; implement demonstrated gaps in the owning protocol, targeted Foundry Level 1, integration milestone Level 2, security phase closeout Level 3. No parallel Commerce order/payment authority. This phase has no canonical numbered substeps; none are invented here.

## Gap disposition

| Requirement | Disposition |
| --- | --- |
| Pay-to-Market evidence-validating reporter | Added `contracts/src/market/MarketPaySettlementAdapter420.sol` under Market authority |
| Canonical order, payment and invoice read interfaces | Additive struct getters; existing storage, methods, state machines and protocol versions retained |
| Seller/merchant and buyer identity | Exact canonical addresses, active merchant controller for incoming payment; no delegation or shared web signer |
| Listing revision, quantity, quote asset and amount | Domain-separated invoice ID binds immutable order economics, chain and dependency addresses |
| Finality | Canonical Pay SETTLED plus nonzero receipt and paid/closed single-use finalized/high-value invoice; frontend evidence never accepted |
| Replay | Persistent one-to-one payment/order bindings; duplicate reports rejected; failed Market call rolls back writes |
| Refund | Same bound payment only; full canonical settlement plus tip refund required; partial refund never releases stock |
| Cancellation/completion/races | Existing Market transition guards remain final authority; refund cannot release completed/sold stock |
| Governance and revocation | Existing policy registry authorizes adapter contract; any caller can relay canonical evidence, but cannot manufacture it |
| Stuck reservations | Existing buyer/seller cancellation retained; no invented TTL or frozen-state change |
| Swap inputs | Market checks settlement output economics; input asset is Pay-owned and may differ; no new swap execution contract |
| Deployment and service identity | Proposed undeployed config only; no Genesis/service ID/address changes; live binding deferred COM-8 |

## Integration contract

Create and reserve a Market order first using the buyer's own authority. Compute `invoiceIdForOrder(orderId)` from the intended deployed reporter. The seller creates a Pay invoice at that ID using currency `420`, exact order amount, SINGLE_USE without partial payments and FINALIZED/HIGH_VALUE acceptance. Native or supported swap payment remains entirely within canonical Pay. After canonical governance records payment finalization, settlement and the exact invoice payment, anyone may relay `reportPayment(orderId,paymentId)`.

Invoice IDs bind chain ID, reporter, Order/Pay/Invoice dependencies, order ID, original listing/revision, buyer, seller, quantity, quote asset, amount and settlement adapter ID. Substituting another chain, deployment, order or invoice fails. Deployment chain changes fail closed. Currency conversion is unsupported by this adapter: the invoice amount is in the Market quote asset's units. A CAD/USD-priced invoice needs a separately qualified conversion policy and is rejected here.

`reportRefund(orderId)` accepts the original payment's canonical REFUNDED state only when cumulative refunded amount equals settlement amount plus tip. Pay remains responsible for refund authorization and accounting. Inactive merchants can unwind prior purchases. Revoked settlement adapters cannot report either transition. Market V1 permits refunds only from PAID/FULFILLED/DISPUTED; completed orders require a future explicitly governed protocol policy, not forced stock release.

The adapter does not transfer money or verify an external receipt cryptographically. It trusts governance-finalized canonical Pay registries, as designed by Pay; registry data is not independent proof that funds moved outside that protocol. No untrusted HTTP payload, indexer projection or caller-selected registry is read. Dependencies are immutable contracts; governance must verify actual approved deployment code, addresses, same-chain wiring and policy registration before enabling them.

## Qualification and milestones

`scripts/commerce/qualify-contracts.py` retains the new reporter suite plus existing Market, Pay lifecycle, settlement/accounting, atomic-settlement and focused-hardening suites. It copies each entire test and its complete transitive import closure into an isolated Foundry project with the repository's unchanged compiler/profile configuration. Import errors and any failed subprocess fail qualification. The same build cache is reused for production bytecode/initcode size checks. No full repository inventory is duplicated.

Level 1: adapter positive/negative/lifecycle, affected source build, formatting and size checks. Level 2 milestone: the six retained Market/Pay integration test units together, because this introduces an authority bridge. Exact-SHA CI is `commerce-contracts.yml`. Level 3 security/global closeout remains COM-7 (or an explicitly required shared phase closeout), before accumulated application merge. Live transactions, approved binding, funds, reorg/provider evidence and deployment authorization remain COM-8/COM-9 gates.

Completion evidence is recorded separately after exact implementation qualification. No deployed, testnet or production readiness is claimed by local fixtures. Next canonical phase: COM-3 — Service + API.
