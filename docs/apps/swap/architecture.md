# 420 Swap architecture

420 Swap supplies the canonical liquidity/execution layer. Exchange-style discovery or advanced routing may compose above it, but cannot replace canonical Swap execution semantics.

Execution rechecks current market/route state, authorization, exact input accounting, minimum output and configured safety/oracle-health conditions. Routing custody must be transient and balance-checked.

Reference-oracle data is a circuit-breaker input; it does not unilaterally set executable market price.
