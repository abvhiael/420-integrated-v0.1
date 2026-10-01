# Swap contracts

The canonical 420 Swap stack is split between governance/registry surfaces and the executable liquidity venue.

## Canonical execution path

- `CanonicalSwapExecutor420` — trusted execution boundary. Resolves the canonical market through Registry, requires the shared operational/safety checks, validates settlement-asset identity and market health, and enforces no-overspend / minimum-delivery postconditions.
- `CanonicalConstantProductPool420` — production-candidate ERC20/ERC20 constant-product liquidity implementation. Only its immutable executor may call `executeCanonicalSwap`. It uses exact balance-delta checks, reentrancy protection, locked minimum liquidity and caller-provided minimum output. It also maintains cumulative token0/token1 reserve-price state for canonical TWAP derivation.
- `CanonicalMarketRegistry` — governance-controlled canonical market-to-pool and pair mapping.
- `ApprovedQuoteAssetRegistry` — approved/canonical quote-asset assignment by currency.

## Market formation and supporting services

- `GenesisDEXFactory` — **registration-only** governance surface for Genesis-qualified canonical pool instances. It does not deploy pools with CREATE/CREATE2. Canonical pool instances are deployed by the qualified deployment process and then registered by Genesis governance under a one-shot `poolId`. `poolImplementation` is the approved implementation/provenance reference used by deployment governance; it is not a runtime-codehash equality gate because canonical pools may embed immutable market/executor parameters in runtime code.
- `PermissionlessDEXFactory` — **registration-only permissionless tier**. Anyone may deploy a compatible pool externally and register that existing instance while Swap is operational. Registration does not confer canonical status, oracle eligibility, Wallet-default eligibility or protocol endorsement.
- `TWAPOracle` — canonical Swap TWAP surface. It resolves the active canonical market, derives time-weighted price from pool cumulative state, enforces configured observation-window/freshness policy, commits source provenance and exposes the Exchange `referencePrice` boundary. Governance configures policy but cannot inject arbitrary price observations.
- `PublicBatchAuction` — governance-operated batch-auction state surface for protocol distribution workflows.
- `SwapIds420` — canonical component and action identifiers.

### GenesisDEXFactory lifecycle

The frozen `GenesisDEXFactory` address is a protocol registry boundary, not a pool bytecode factory. The canonical lifecycle is:

1. qualify the approved pool implementation and deployment inputs;
2. deploy a concrete pool instance through the retained deployment process;
3. verify that the instance is code-bearing and matches the intended market/executor parameters;
4. have Genesis governance register the exact deployed address under a previously unused `poolId`;
5. separately register/activate the market through `CanonicalMarketRegistry` as required by canonical market policy.

Registration fails closed when shared operational safety is not normal and cannot overwrite an existing `poolId`. Changing `poolImplementation` does not mutate or replace previously registered pools.

This distinction is intentional. Introducing an on-chain CREATE/CREATE2 path would create new deployment, salt, initialization, provenance and upgrade semantics that are not defined by the frozen Swap architecture and therefore require a separate canonical decision rather than being inferred from the contract name.

### PermissionlessDEXFactory lifecycle

The frozen permissionless policy keeps `creation: ANYONE`, but repository authority defines that as an open **market-formation** policy rather than an on-chain bytecode deployment primitive. The lifecycle is:

1. any user deploys a pool outside `PermissionlessDEXFactory`;
2. the pool must be code-bearing and expose `token0()` / `token1()` that exactly match the pair submitted for registration;
3. the registrant supplies the pool's current runtime code hash, which the factory re-derives from `EXTCODEHASH` and stores as provenance;
4. the `poolId` must be unused and the exact pool address must not already be registered under another ID;
5. registration runs through the shared operational, pause, chain-version and resident-lifecycle gates;
6. distinct pools for the same pair remain permitted because permissionless fee/strategy variants are not canonically restricted here.

The factory retains a reference `poolImplementation` and its deployment-time code hash for discovery/provenance, but it does **not** treat that reference as a protocol endorsement of every registered pool and does not require runtime-codehash equality with it. Concrete pools can embed immutable pair/executor/fee parameters in runtime bytecode, and the permissionless tier is explicitly not asset-qualified or protocol-oracle-eligible.

Registration records are immutable. There is no governance promotion path from this registry into the canonical tier; canonical status requires a separate `CanonicalMarketRegistry` action under canonical market policy.

### TWAPOracle lifecycle

The TWAP path is canonical-pool-derived:

1. governance configures a market's minimum observation window, maximum observation window, maximum staleness and enabled state;
2. any caller may invoke `checkpoint(marketId)` while Swap is operational;
3. the oracle resolves `CanonicalMarketRegistry` through ProtocolRegistry and requires an active canonical market;
4. the pool's token pair must exactly match the canonical market pair;
5. the oracle reads the pool's cumulative token0/token1 price state and commits the market/pool/code/pair/metadata identity into `sourceHash`;
6. the first checkpoint seeds a baseline only;
7. a later checkpoint derives TWAP from the cumulative delta divided by elapsed time, provided the interval is within the configured window;
8. the resulting raw price is normalized for token decimals and stored as quote-per-base Q96;
9. `readObservation` and `referencePrice` fail closed after configured staleness;
10. a source identity change or overlong window clears the old observation and requires a new baseline/window.

`latest(marketId)` remains a compatibility getter for the 420Oracle source ABI, but security-sensitive integrations must use `readObservation` or `referencePrice`, which enforce window and freshness policy. `TWAPOracleSourceAdapter420` now does so.

The Swap TWAP publishes confidence `0` because a single canonical-pool time average is not a statistical confidence estimate. 420Oracle may combine it with independent sources and apply confidence/quorum/deviation policy without turning external data into executable pricing authority.

The obsolete `CanonicalPool420` source scaffold was retired during the 420Swap repository audit after `CanonicalConstantProductPool420` became the executable production candidate. It is not a deployable or registry-authoritative component.

420 Swap does not own a frozen system address for the executor. The canonical Swap executor is registry-resolved under the Genesis address policy. Consumers must resolve current deployment metadata through 420Registry rather than hard-coding an implementation address.

Generated ABI/NatSpec belongs in DOC-10.
