# 420Exchange V9 — Atomic retained-fee settlement

V9 binds retained Exchange protocol revenue to the same atomic settlement transaction as the swap itself.

## Settlement model

- The Exchange fee is charged exactly once on the realized **final output** of a path.
- Multi-hop routing does not multiply the Exchange fee by hop count.
- Final venue output is delivered to `ExchangeAtomicRouter420`, not directly to the user.
- The router computes the retained fee from `ExchangeFeePolicy420.exchangeFeeBps()`.
- The user's `minFinalAmountOut` is a **net-after-fee** floor.
- The fee is approved exactly to `ExchangeFeeRouter420`, routed atomically, and approval is reset to zero.
- The net output is then transferred to the recipient or unwrapped to native `$420` when the final asset is W420.

## Five-way routing

`ExchangeFeeRouter420` preserves the existing Application Revenue Policy destinations:

1. protocol treasury
2. development fund
3. community fund
4. liquidity incentives
5. Development Compensation Vault

The developer-payment share remains capped by `ExchangeFeePolicy420.MAX_DEVELOPER_SHARE_BPS`.

## V9 invariants

- **EX-FEE-001 — once per trade:** one retained Exchange fee is computed from final realized output, never once per hop.
- **EX-FEE-002 — net slippage:** a trade reverts unless recipient output after fee is at least the user's final minimum.
- **EX-FEE-003 — fee conservation:** the fee router must receive exactly the retained fee and return to its pre-call token balance after distribution.
- **EX-FEE-004 — no residue:** successful settlement returns the atomic router's final-token balance to its pre-final-hop baseline.
- **EX-FEE-005 — no allowance residue:** approvals to the fee router and Development Compensation Vault are zeroed after successful routing.
- **EX-FEE-006 — rollback:** any fee-routing, recipient-transfer, unwrap, oracle, authorization, custody, slippage, or emergency failure reverts the entire swap and fee distribution.
- **EX-FEE-007 — unique trade references:** repeated identical paths use monotonic execution nonces so fee-router replay protection does not block legitimate repeat trades.
- **EX-FEE-008 — activation fail-closed:** a nonzero Exchange fee cannot be activated until the split totals 10,000 bps and every destination is configured.
- **EX-FEE-009 — native parity:** token-to-native output pays its retained fee in W420 before only the net amount is unwrapped.

LP/provider venue fees remain outside this retained-protocol-fee layer and continue to be reflected in venue execution amounts before V9 settlement.
