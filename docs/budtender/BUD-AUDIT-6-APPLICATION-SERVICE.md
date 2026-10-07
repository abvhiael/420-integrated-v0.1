# BUD-AUDIT-6 — Application Service Layer

Status: IMPLEMENTED — Level 1 exact-head qualification pending

## Authority and scope

This audit step creates the stable application-facing boundary required by BUD-0's mobile/presentation architecture without inventing new gameplay systems, persistence semantics, wallet authority, or cloud behavior.

Canonical BUD-0 requires the simulation core to own authoritative gameplay state transitions and requires UI/presentation code to remain non-authoritative for cash, inventory, order settlement, upgrades, progression, production, and persistence rules.

BUD-AUDIT-5 additionally requires trusted persistence/application state before offline rewards may be applied.

## Application service responsibilities

`BudtenderApplicationService` owns the currently implemented domain authorities:

- `BudtenderStore`;
- `BudtenderCustomerSystem`.

It exposes sanctioned commands for:

- customer arrival;
- customer ticking;
- customer service/settlement;
- canonical-price restocking;
- all currently implemented BUD-4 upgrade tracks;
- BUD-4 expansion transitions;
- demand-profile changes;
- non-mutating offline-progression evaluation.

It exposes one detached application snapshot containing:

- BUD-1/BUD-3 store/inventory state;
- BUD-2 customer state;
- BUD-4 progression state.

## Security and authority policy

- Domain authority objects remain private to the application service.
- Presentation callers cannot access `ProductInventory`, `StoreProgression`, or raw order settlement APIs.
- The application service does not expose `grantStartingCash` or direct `creditCash`.
- Restock callers provide only product and units; canonical wholesale pricing remains inside the domain.
- Application snapshots are detached copies and cannot mutate authoritative state.
- Existing domain validation remains the fail-closed authority for invalid commands.
- Offline evaluation is pure/non-mutating. Caller-supplied offline source state cannot directly credit store cash.
- No wallet, chain, account, Gaming Protocol, oracle, backend, or persistence dependency is introduced.
- No UI/client state becomes authoritative.

## Store integration repair

The existing BUD-1 compatibility façade exposed only three legacy upgrade aliases and did not expose BUD-4 expansion transitions or all BUD-4 upgrade tracks.

BUD-AUDIT-6 adds sanctioned store methods:

- `purchaseProgressionUpgrade(track)`;
- `unlockExpansion(stage)`;
- `progressionSnapshot()`.

The legacy `purchaseUpgrade(kind)` API remains compatible and delegates into the same progression authority.

Shelf-capacity purchases still apply their required BUD-3 inventory capacity side effect through the store authority.

## Audit invariants

- `BUD-APP-001`: One application service owns the live store/customer domain instances.
- `BUD-APP-002`: Presentation callers receive detached snapshots, never mutable domain references.
- `BUD-APP-003`: Cash can change only through sanctioned domain transitions; no app-service cash injection exists.
- `BUD-APP-004`: Restock pricing remains canonical and cannot be supplied by the caller.
- `BUD-APP-005`: Customer settlement still routes through the single-use store order path.
- `BUD-APP-006`: All currently implemented BUD-4 upgrade tracks can be invoked through the authoritative store progression state.
- `BUD-APP-007`: Shelf-capacity progression updates the canonical BUD-3 inventory capacity.
- `BUD-APP-008`: Expansion transitions remain subject to BUD-4 prerequisite/economy checks.
- `BUD-APP-009`: Customer lifecycle/demand state remains behind sanctioned commands.
- `BUD-APP-010`: Offline evaluation cannot mutate store state.
- `BUD-APP-011`: No wallet/blockchain/network/persistence authority is introduced.
- `BUD-APP-012`: Existing BUD-1 through BUD-5 fail-closed invariants remain intact.

## Level 1 qualification

Directly applicable qualification is the Budtender app-specific fast workflow:

- Node 22 strip-only syntax validation for all `src/budtender/*.ts` and `test/budtender/*.spec.ts`;
- complete Budtender TypeScript regression suite including the application-service boundary tests.

The retained Gaming integration and Gaming Protocol security jobs may run as part of the existing Budtender workflow. This step does not modify shared Gaming SDK, contracts, addresses, runtime configuration, deployment state, or wallet authority.

## Level 2 milestone relationship

BUD-AUDIT-6 is an ordinary Level 1 step. It creates an application boundary but does not introduce persistence, cloud lifecycle, external authority, or a user-facing client.

A later milestone should run Level 2 when several application layers converge, especially once persistence/cloud/client behavior is integrated.

## Exit criteria

BUD-AUDIT-6 is COMPLETE only when:

1. a single application service owns current domain instances;
2. all current gameplay/progression operations needed by the implemented slice are accessible through sanctioned commands;
3. no direct cash/domain authority leaks to presentation callers;
4. snapshots are detached/non-authoritative;
5. offline evaluation is available without applying untrusted rewards;
6. progression upgrades/expansions preserve BUD-3/BUD-4 invariants;
7. application-service negative/authority/boundary tests pass;
8. the exact implementation SHA passes directly applicable Budtender Level 1 qualification;
9. durable repository evidence records implementation SHA, CI evidence, base SHA, limitations, deferred checks, and next roadmap step.

## Known limitations

This step does not implement guest saves, save migrations, cloud saves, backend services, or a production presentation client.

The application service is currently in-memory. Persistence must later own save/load state, trusted offline cursors, migration/version policy, and crash recovery before production exposure.
