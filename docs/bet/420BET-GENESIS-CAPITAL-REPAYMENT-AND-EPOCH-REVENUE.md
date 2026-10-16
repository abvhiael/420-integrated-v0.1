# 420Bet — Genesis-backed bankroll capitalization, developer earnings and community repayment

**Decision record:** proposed 420Bet economic policy requested by the project owner, 2026-10-15.  
**Activation:** **NOT AUTHORIZED OR DEPLOYED.** The config is a machine-readable policy proposal with a deliberately unresolved community-vault destination. Do not infer completed Treasury/Governance approval from this file.

## Source, custody and ceiling

- Genesis supply remains exactly **42,000,000 native $420**. The frozen `config/genesis-allocations.json` assigns **8,600,000 $420** to `protocol-reserve` at `0x0000000000000000000000000000000000000424`.
- Earmark **1,000,000 $420 inside** that existing protocol-reserve allocation as the *maximum authorized candidate* for initial 420Bet casino bankroll. Do not mint new $420, move reserve at genesis outside canonical custody, or reduce validator, founder, Attention, Community Testnet, or Development allocations.
- Treat **7,600,000 $420** as the remaining unearmarked protocol-reserve balance if and when this earmark is ratified. The earmark is **not** an already executed transfer; it must be reconciled against any other competing obligations on the existing 8.6M reserve.
- Actual launch funding requires legitimate Treasury/Civic budget authority, scoped capability and timelock, receipt-backed release from the canonical 420Vault treasury custody, and deposit into a properly deployed native-$420 `BankrollVault420`. Native asset must match exactly; 420Bet should not accept wagers before funding and security gates succeed.

## Fund safety and shared casino risk

`BankrollVault420`, `VaultAccounting420`, `RiskManager420`, `WagerRouter420`, and `SettlementEngine420` already implement stake escrow, funded risk reservation, protected withdrawals, and wager settlement. These controls **do not** themselves implement authorization of a whole-casino profit waterfall, cross-vault aggregation, or automatic transfers to community/developer recipients.

- Player escrow, reserved payout liabilities, LP or depositor principal and protection/safety buffers must never be counted as distributable profits.
- Separate gross wagers, gross payouts, realized net gaming result, funded expenses, net protocol revenue, eligible distribution, existing liabilities, accumulated return of the original principal, and operator treasury flows. Losses cannot create a positive revenue-share event.
- Every bet must pass game-specific gross payout, per-wager net liability, per-game, correlation and vault aggregate limits; risk profiles alone do not establish shared risk across otherwise disconnected vaults.
- Any payout, withdrawal, transfer or revenue split fails closed when post-transfer vault solvency, safety reserve, outstanding wager exposures and other obligations cannot be independently verified.

## Community principal recovery — authorized destination

**Canonical route: 420Treasury-governed COMMUNITY-purpose budget and a specifically authorized 420Vault treasury destination.**

- The destination must be a community-category Treasury vault authorized via Civic governance / Treasury budget and capability checks, with explicit registered vault ID, asset, controlled account and immutable binding after approval.
- **Its exact vault ID/address has not yet been established**. Leave `destinationVaultId: null` and block implementation activation. `420/treasury/vault/token-creation-community-revenue/v1` belongs to the separate 420Token creation-fee policy; it is **not** automatically the authorized 420Bet repayment recipient.
- The original 1,000,000 $420 is capital owed back to the approved community destination up to that cap, *not* casino revenue. Only available **realized surplus over protected liquidity, active liabilities and required operating reserve** is available for repayment.
- Maintain idempotent cumulative repayments per source/epoch/recipient, prohibit paying more than the original principal, and preserve a residual bankroll strong enough to back risk in progress and planned caps. Funding shortfalls pause principal repayment. No timelock bypass or owner-controlled destination override.
- The source is the Genesis *Protocol Reserve*, not an already-designated Community allocation. A governance decision must explicitly authorize ultimate repayment to a community-owned destination rather than automatically returning it to the Protocol Reserve. This cross-category transfer is **not** implicitly authorized by this policy proposal.

## Developer compensation — from actual profits, once per completed epoch

- The frozen `contracts/config/application-revenue-policy-v1.json` defines a canonical 10% lead-developer compensation share of **eligible net protocol revenue**, with default splits totaling 100%: 30% Protocol Treasury, 25% Development Fund, 20% Community Fund, 15% Application Growth/Liquidity, 10% Lead Developer.
- For 420Bet, only **realized, finalized positive, eligible net protocol revenue after player/LP obligations, reserve replenishment and permitted costs** may enter the distribution basis. The original bankroll, transfers of capital, player stakes in escrow and refunded sums are explicitly excluded.
- At **epoch E+1 start**, after epoch **E** revenue is finalized (or the first canonical execution event at/after the boundary), *reserve* 10% of E's eligible realized net protocol revenue as a developer payable. This is **not** 10% of forecast next-epoch wagers or automatic minting at epoch rollover. The first epoch produces no advance developer payment.
- Actual transfer may occur subsequently through an approved, source-scoped revenue contribution to `DevelopmentCompensationVault420` with exact policy reference, correct source/application revenue ID and replay protection. Failure to close accounting or insufficient eligible revenue results in zero allocation or a fail-closed unresolved epoch, never a speculative payment.
- Preserve the other 90% distribution obligations per frozen revenue policy, not an undocumented ad hoc casino split; do not charge 10% a second time from any amount already distributed. The developer vault has no authority to withdraw directly from the bankroll.
- Epoch length, closure/finality window, designated 420Bet authorized revenue source, activation, fee/expense determination and accounting bridges require explicit protocol-compatible implementation. This document does **not** change consensus issuance or validator epoch calculations.

## Required implementation and release gates

1. Obtain governed approval of earmarking within the existing Genesis allocation and resolve conflicts with existing reserved Protocol Reserve obligations; determine whether existing frozen Genesis manifest/config/checksum artifacts require changes. **Do not edit frozen allocations without full required reconciliation.**
2. Obtain an explicit governed Treasury COMMUNITY destination and recipient custody proof; do not reuse the token-creation fee vault without authorization.
3. Implement on-chain enforceable capitalization/reimbursement accounting and exact-asset, cumulative-cap, revenue/solvency proof gates, with unauthorized, double-claim, rollback, conflicting epoch, insolvent and malformed destination negative tests.
4. Implement **eligible net revenue** snapshot/epoch-finality adapter, approved default split, 10% developer accrual, no-negative-distribution behavior, idempotency and permitted, capability-scoped Developer Compensation Vault routing.
5. Qualify affected contracts, Treasury/Vault, 420Bet multi-game accounting, Genesis authority and deployment integrations at their appropriate **level**; do not silently reuse unrelated earlier SHA test evidence, and never run Level 3 before exact-SHA and frozen-manifest preflight.
6. Independently qualify actual testnet releases, wallet/provider access and applicable real-money regulatory gates prior to activation.

## Policy preflight and evidence

Run `python3 scripts/verify-420bet-capitalization-policy.py` to validate conservation of frozen Genesis supply, earmark arithmetic, matching frozen V1 application revenue split and **fail-closed unresolved destination status**. This static preflight **does not** prove that the unimplemented accounting/transfer enforcement described above exists.

**Status: policy codified, capital and revenue movements disabled pending governed authority and implementation.**
