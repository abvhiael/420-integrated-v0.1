# 420Bet 5D.4 — Bet acceptance, odds locking and liability

## Status: PARTIAL IMPLEMENTATION, NOT QUALIFIED

The bounded admission preview uses 5D.3's current, scoped signer-authorized quote and 5D.2's live market readiness checks. It rejects expired or replaced quote digests, noncanonical selections, excessive stake, excessive exposure, expired offer deadlines and returns outside the bettor's price bounds. Decimal odds use integer 1e6 scaling and gross return is floor(stake × decimal odds / 1e6); profit liability is gross minus stake. Risk limits are scoped to canonical market IDs.

**Critical release barrier:** No wager may be accepted without atomic custody proof, an asset/amount-authoritative funding adapter, per-ticket immutable funding confirmation, replay-safe token receipt consumption, operator collateral checks, independent account/signature authorization, settlement and deterministic refund rights. A caller-supplied hash does not prove funding. `accept()` therefore deliberately reverts. Preview is informational only, not a reservation of capital and not a funded bet.

## Required additional 5D.4 qualification
- Genuine stake custody and atomic funding verification with actual ERC-20 transfer and fee-on-transfer/reentrancy defenses, or an independently attested treasury integration.
- Operator collateral inventory and worst-case correlated exposure accounting, dynamic reservation and release (including per-outcome aggregation, voids, rollback and global caps).
- Authenticated player consent/nonce replay protection, quote slippage, ticket uniqueness, idempotent retry and front-run protection.
- Complete life-cycle rights for locked tickets, cancellation/dispute/payout/refund integration; fail-closed event postponement, stale source, emergency halt and operator revocation.
- Funded adversarial integration, independent model/replay, compiler/lint/static analysis, exact-SHA CI evidence, external data/source authority and legal release gates.

No wager acceptance, liability reservation, solvency, fund safety or full 5D.4 qualification is claimed.
