# Budtender simulation core

Budtender is a deterministic, wallet-free cannabis retail/café management simulation core. The repository-defined implementation currently covers the frozen BUD-0 architecture and the implemented BUD-1 through BUD-4 gameplay slices.

## Authority model

The simulation core is authoritative for ordinary game state. The current integrated path is:

- `BudtenderStore.ts` — BUD-1 store/order façade and compatibility surface;
- `BudtenderCustomers.ts` — BUD-2 deterministic customer lifecycle;
- `ProductInventory.ts` — BUD-3 canonical starter catalog, inventory and product economics;
- `StoreProgression.ts` — BUD-4 canonical internal cash, upgrade and expansion progression;
- `OfflineProgression.ts` — BUD-AUDIT-5 deterministic bounded offline calculation boundary;
- `BudtenderApplicationService.ts` — BUD-AUDIT-6 application-facing command/snapshot boundary over the current domain services;
- `clients/budtender-web-v1` — BUD-AUDIT-7 mobile-first responsive presentation client over the application service.

`BudtenderStore` delegates inventory to `ProductInventory` and internal cash/upgrades to `StoreProgression`; it does not maintain a second independent economy.

The optional ecosystem adapter is separate at `clients/budtender-access-v1`. It consumes the shared 420 Gaming Protocol SDK under the canonical game namespace `420/GAMING/GAME/BUDTENDER/V1`. Wallet linkage is never required for the ordinary management loop.

## Run the current core qualification locally

Node.js 22 or newer is required. The Budtender core has no root package-manager dependency.

```bash
node --experimental-strip-types --check src/budtender/BudtenderStore.ts
node --experimental-strip-types --check src/budtender/BudtenderCustomers.ts
node --experimental-strip-types --check src/budtender/ProductInventory.ts
node --experimental-strip-types --check src/budtender/StoreProgression.ts
node --experimental-strip-types --check src/budtender/OfflineProgression.ts
node --experimental-strip-types --check src/budtender/BudtenderApplicationService.ts
node --experimental-strip-types --test test/budtender/*.spec.ts
```

User-facing web client:

```bash
cd clients/budtender-web-v1
npm run check
npm test
npm start
```

Shared Gaming Protocol access tests:

```bash
cd clients/budtender-access-v1
npm test
```

The dedicated GitHub workflow also runs the shared Gaming SDK and Gaming Protocol adversarial Solidity suite.

## Offline progression boundary

BUD-AUDIT-5 adds a pure offline-progression calculator with a 24-hour accumulation bound, clock-rollback protection, replay-safe cursor advancement, complete-interval accounting, per-source cash caps, duplicate-source rejection, and safe-integer checks. Existing BUD-1 through BUD-4 systems remain offline-inert because none is currently canonically marked offline-capable. A future persistence/application layer must own trusted source state and the offline cursor before this is exposed to users.

## Application service boundary

BUD-AUDIT-6 adds `BudtenderApplicationService` as the presentation-facing boundary. It owns the store/customer domain instances privately, exposes sanctioned gameplay/progression commands, returns detached snapshots, does not expose test-only cash injection, and keeps offline evaluation non-mutating until trusted persistence exists.

## User-facing client

BUD-AUDIT-7 adds `clients/budtender-web-v1`, a responsive touch-friendly browser client hosted by Node 22. The browser renders detached `BudtenderApplicationService` snapshots and sends sanctioned commands only; it does not become authoritative for cash, inventory, settlement, upgrades, or progression.

## Current release boundary

The repository now contains a user-facing responsive browser client, but does **not** yet contain a packaged native mobile client, cloud-save service, production deployment package, or save/migration implementation. Those layers are named by BUD-0 but no BUD-5+ canonical phase specification exists on current `main`.

Do not infer those components from the architecture list. BUD-0 through BUD-4 are the currently specified gameplay implementation slices.

The shared Gaming Protocol contracts are Genesis protocol infrastructure, not Budtender-specific smart contracts. Their testnet runtime manifest remains unresolved until a real deployment supplies chain ID, contract addresses and operator addresses.
