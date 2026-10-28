# 420Bet 5D.7 — Settlement, payouts, voids and refunds

This candidate preserves the previously qualified funded admission, market-gated final settlement, certified winner/loss evaluation, pull-based player claims, dispute/VOID outcomes and permissionless timeout refunds. It adds immutable terminal settlement receipts, including state, payout amount, certification/void evidence, executor and terminal timestamp. Failed or repeated terminal transitions cannot overwrite a receipt because the vault only closes FUNDED tickets.

## Scope and remaining canonical decisions

The repo sportsbook TN-BOOK-00 roadmap additionally requires explicit no-action, push and dead-heat policies and a complete licensed-provider/client lifecycle. Those policies are **not silently inferred from winner selection** or represented as complete by this receipt patch. A push may warrant stake refund and a dead heat can require partial gross distribution; these need versioned market-template rules, externally certified outcomes, and adversarial collateral limits before they are safe. Do not treat VOID as a substitute for an authenticated push or dead-heat result.

## Qualification

Bounded suite: `contracts/test/sports-5d7/SportsSettlementLifecycle420.t.sol` inherits original 5D.4 coverage and adds winner/loss/void/timeout/claim receipts, exact amounts, one-time closure, negative unknown tickets and fuzzed refund conservation. CI and any failure triage must bind to the final implementation SHA.

## Testnet acceptance

Preserve the existing BET-5D4-TN and BET-5D6-TN live-network evidence gates; actual customer wallet custody, licensed data, independent adjudication, chain finality and payout transaction receipts remain unqualified until real approved testnet evidence is available.
