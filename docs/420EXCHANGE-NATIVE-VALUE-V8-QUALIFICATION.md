# 420Exchange V8 qualification focus

The V8 qualification campaign must demonstrate that native `$420` paths preserve all V6/V7 execution guarantees while adding only the canonical wrap/unwrap boundary.

Required checks:

- native `$420` input is wrapped 1:1 into canonical W420 and consumed atomically;
- ERC20-to-native output terminates only in canonical W420 and unwraps exactly the realized amount;
- authorization evaluates the original caller, never the router as principal;
- direct native transfers to the router are rejected;
- temporary W420 allowances are reset to zero;
- successful native paths leave no newly introduced native or W420 balance on the router;
- oracle deviation, slippage, route, market, authorization, custody, or emergency failure reverts the complete transaction;
- existing ERC20-only atomic routing regression coverage remains green;
- Wrapped420 supply/balance accounting remains conserved across deposit/withdraw and transfer paths.
