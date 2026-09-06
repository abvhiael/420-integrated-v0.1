# 420Exchange V12 — Liquidity + Execution Hardening

V12 turns the execution guarantees established in V6–V11 into explicit adversarial regression and fuzz invariants.

## Hardening surface

The campaign covers:

- fee-on-transfer and deflationary ERC-20 behavior
- ERC-20 calls that return `false`
- exact retained-fee accounting conservation
- replay resistance for fee settlement references
- zero router residue after successful settlement
- zero Development Compensation Vault allowance residue
- atomic rollback of replay state when token movement fails
- bounded arithmetic across fuzzed retained-fee amounts
- repeated settlement behavior under unique versus reused trade references

The existing Exchange router already enforces exact balance deltas on transient custody, bounded one-to-four-hop execution, per-hop oracle checks, repeated-token rejection, exact temporary approvals, zero-reset allowance cleanup, net-output slippage, emergency controls, and a non-reentrancy mutex. V12 treats those as security invariants and expands regression coverage around the token/accounting boundary where adversarial behavior is most likely to invalidate assumptions.

## V12 invariants

- **EX-HARD-001 — conservation:** every successfully routed retained fee is fully accounted for across the five configured destinations.
- **EX-HARD-002 — zero residue:** successful retained-fee routing leaves no token balance in `ExchangeFeeRouter420`.
- **EX-HARD-003 — zero approval residue:** the Development Compensation Vault allowance is zero after settlement.
- **EX-HARD-004 — fee-on-transfer fail closed:** a token that delivers less than the requested amount cannot be used for retained-fee settlement.
- **EX-HARD-005 — false-return fail closed:** a token returning `false` from `transferFrom` cannot advance settlement state.
- **EX-HARD-006 — rollback:** failed token movement rolls back `consumedTradeRef` and any intermediate accounting state.
- **EX-HARD-007 — replay:** a consumed trade reference cannot distribute value twice.
- **EX-HARD-008 — fuzz conservation:** conservation and cleanup remain true across fuzzed non-zero fee amounts.

## Scope and follow-on

This slice focuses on execution/accounting hardening rather than adding new Exchange functionality. Additional V12 iterations may extend adversarial coverage to callback/reentrancy tokens, route-adapter manipulation, oracle boundary fuzzing, multi-hop custody conservation, and signed-order partial-fill state machines as CI feedback identifies useful targets.

After V12 hardening qualifies, the next roadmap slice is V13 API/indexing/market-data surfaces, followed by the V14 Exchange Web UI.
