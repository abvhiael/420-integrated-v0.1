# Swap contracts

The canonical 420 Swap stack is split between governance/registry surfaces and the executable liquidity venue.

## Canonical execution path

- `CanonicalSwapExecutor420` — trusted execution boundary. Resolves the canonical market through Registry, requires the shared operational/safety checks, validates settlement-asset identity and market health, and enforces no-overspend / minimum-delivery postconditions.
- `CanonicalConstantProductPool420` — production-candidate ERC20/ERC20 constant-product liquidity implementation. Only its immutable executor may call `executeCanonicalSwap`. It uses exact balance-delta checks, reentrancy protection, locked minimum liquidity and caller-provided minimum output.
- `CanonicalMarketRegistry` — governance-controlled canonical market-to-pool and pair mapping.
- `ApprovedQuoteAssetRegistry` — approved/canonical quote-asset assignment by currency.

## Market formation and supporting services

- `GenesisDEXFactory` — governance-controlled registry for Genesis-qualified pools and the approved pool implementation.
- `PermissionlessDEXFactory` — permissionless registration tier. Registration does not confer canonical status or oracle eligibility.
- `TWAPOracle` — Swap observation surface; Exchange may consume oracle data as a circuit-breaker input rather than executable-price authority.
- `PublicBatchAuction` — governance-operated batch-auction state surface for protocol distribution workflows.
- `SwapIds420` — canonical component and action identifiers.

The obsolete `CanonicalPool420` source scaffold was retired during the 420Swap repository audit after `CanonicalConstantProductPool420` became the executable production candidate. It is not a deployable or registry-authoritative component.

420 Swap does not own a frozen system address for the executor. The canonical Swap executor is registry-resolved under the Genesis address policy. Consumers must resolve current deployment metadata through 420Registry rather than hard-coding an implementation address.

Generated ABI/NatSpec belongs in DOC-10.
