# 420Exchange Foundation V2

This batch extends the V1 curated asset/market foundation without duplicating 420Swap liquidity infrastructure.

## Added

- `ExchangeIds420`: stable component and ActionIds for exchange configuration, trading, bridge ingress/egress, fee routing and emergency control.
- `ExchangeAuthorization420`: CapabilityRegistry-backed, scope-bound checks for swaps, limit orders and bridge operations.
- `ExchangeEmergencyControl420`: narrow domain halts for swaps, limit orders, bridge deposits, bridge withdrawals, market activation and fee routing. It contains no custody, seizure or arbitrary transfer authority.
- `ExchangeRouteRegistry420`: governance-approved quote/execution adapter registry intended to sit above 420Swap and future approved venues. `$420` is preferred as the hub asset but routes are not forced through it.
- `ExchangeFeeRouter420`: atomic routing of retained exchange protocol revenue among protocol treasury, development, community, liquidity incentives and the existing `DevelopmentCompensationVault420`.

## Fee invariants

1. Input is retained 420Exchange protocol revenue only; LP/provider fees are not included.
2. Split basis points must conserve exactly 10,000 bps.
3. Rounding remainder is assigned to the protocol-treasury share so no fee units are lost.
4. Developer compensation is calculated from declared gross retained protocol revenue and routed through `DevelopmentCompensationVault420`.
5. Trade references are single-use at the fee router.
6. Only explicitly authorized exchange collectors may submit fee-routing calls.
7. The fee router has no owner withdrawal function.

## Authorization invariants

Capabilities are scoped to a market or asset and carry the amount into `CapabilityRegistry420.isAuthorized`, allowing wallet/session-key policies to impose per-call and period limits. Exchange authorization does not imply withdrawal or unrelated wallet authority.

## Emergency invariants

Emergency controls are domain-specific. Halting swaps must not automatically create custody authority, and unhalting requires the same governance path. Incident hashes provide an auditable reason commitment when a halt is enabled.

## Deferred

- concrete 420Swap execution adapter implementation
- native-420 fee routing path
- limit-order settlement engine
- oracle/TWAP guard integration
- bridge adapters and per-chain confirmation policy
- liquidity qualification gates
- frontend/session-key UX
- focused fuzz/invariant/reentrancy hardening
