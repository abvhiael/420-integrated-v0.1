# 420Exchange Atomic Routing V6

## Scope

V6 adds bounded atomic multi-hop exact-input execution on top of the qualified V5 path quoting and oracle-guard foundation.

### Added

- `ExchangeAtomicRouter420`
- 1-4 hop exact-input atomic execution
- path commitment hashing over input, amount, recipient, and complete hop data
- per-hop active-market and token-pair validation
- per-hop Smart Account / Capability Registry authorization
- per-hop minimum output plus final minimum output
- global SWAPS emergency halt enforcement
- repeated-token/cycle rejection
- transaction-local intermediate-token custody only
- exact intermediate balance-delta accounting
- exact intermediate allowance target discovery
- zero-reset / exact-value / zero-reset allowance lifecycle
- CanonicalSwapAdapter420 allowance-target exposure for the canonical 420Swap executor

## Security invariants

### V6-ROUTE-001 — caller-bound first input
The first hop always uses `msg.sender` as payer. No route or adapter may nominate an arbitrary third-party payer.

### V6-ROUTE-002 — bounded path
A path contains at least one and at most four hops.

### V6-ROUTE-003 — committed path
The caller supplies the expected hash of the complete execution path. Execution fails if any committed path field differs.

### V6-ROUTE-004 — market legitimacy
Every hop must reference an active exchange market whose registered base/quote pair exactly matches the current input/output token pair.

### V6-ROUTE-005 — capability per hop
The caller must hold ACTION_SWAP authorization for every traversed market at the actual amount entering that hop.

### V6-ROUTE-006 — no cycles
A token may not appear twice in one path. This prevents cyclic routes and simplifies intermediate conservation guarantees.

### V6-ROUTE-007 — intermediate conservation
For every non-first hop, the router's input-token balance must decrease by exactly the amount passed to the execution adapter. For every non-final hop, the router's output-token balance must increase by exactly the amount reported by the execution adapter.

### V6-ROUTE-008 — transient approvals
Intermediate-token approvals are granted only to the adapter-declared allowance target, for the exact current hop amount, and are reset to zero immediately after settlement.

### V6-ROUTE-009 — slippage
Every hop enforces a non-zero minimum output and the path also enforces an independent final minimum output.

### V6-ROUTE-010 — fail-closed emergency
The existing SWAPS emergency domain halts the complete atomic route before execution begins.

## Deliberate deferrals

V6 does not yet:

- calculate normalized cross-decimal execution prices for oracle comparison;
- bind the V5 oracle guard directly into settlement until canonical per-asset decimal normalization is defined;
- add native `$420` value-path handling;
- add protocol fee extraction inside the atomic router;
- add signed off-chain limit-order settlement.

The oracle guard remains available and fail-closed, but execution-price binding must not assume equal ERC20 decimals. The next hardening stage should define canonical price normalization before the guard is inserted into every swap hop.
