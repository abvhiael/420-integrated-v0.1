# BUD-AUDIT-6 — Level 1 qualification evidence

Date: 2026-10-07

Status: COMPLETE

## Roadmap step

BUD-AUDIT-6 — Application Service Layer

Qualification level: Level 1 — app-scoped fast qualification.

## Authoritative implementation SHA

`b80eb03b50526f470e3a8b778dc0329a27d95ef1`

Base `main` SHA at qualification:

`c8e8b58d818611276f7a9bb2b8d2241004450d97`

Audit branch:

`audit/budtender-complete-20261007`

PR:

#561 — `audit(budtender): repository-grounded qualification and remediation`

Branch divergence at implementation qualification: 47 commits ahead / 0 behind `main`.

## Implementation summary

BUD-AUDIT-6 adds the authoritative application-facing boundary over the currently implemented Budtender domains while preserving BUD-0's non-authoritative presentation rule.

Implemented:

- `src/budtender/BudtenderApplicationService.ts`;
- one application service owns the live `BudtenderStore` and `BudtenderCustomerSystem` instances;
- native ECMAScript `#store` and `#customers` runtime-private fields prevent presentation access to raw domain authorities;
- sanctioned customer arrival, tick, and serve commands;
- canonical-price restocking without caller-supplied unit-price authority;
- all current BUD-4 upgrade tracks exposed through the existing store/progression authority;
- BUD-4 expansion transitions exposed without leaking `StoreProgression`;
- aggregate detached application snapshots;
- demand-profile command routing;
- non-mutating BUD-AUDIT-5 offline-progression evaluation;
- no wallet, blockchain, account, network, backend, oracle, or persistence authority introduced.

Store integration additions:

- `purchaseProgressionUpgrade(track)`;
- `unlockExpansion(stage)`;
- `progressionSnapshot()`.

Legacy BUD-1 `purchaseUpgrade(kind)` remains compatible and delegates to the same progression authority. Shelf-capacity upgrades continue to update canonical BUD-3 inventory capacity.

## Files changed for this step

Executable / test:

- `src/budtender/BudtenderApplicationService.ts`
- `src/budtender/BudtenderStore.ts`
- `test/budtender/BudtenderApplicationService.spec.ts`

Substantive documentation before qualification:

- `docs/budtender/BUD-AUDIT-6-APPLICATION-SERVICE.md`
- `docs/audit/BUDTENDER-AUDIT-2026-10-07.md`
- `src/budtender/README.md`

Evidence-only closeout follows the qualified implementation SHA.

## Requirements satisfied

The implementation satisfies `BUD-APP-001` through `BUD-APP-012`:

- one application service owns current domain instances;
- raw domain references are not exposed to presentation code;
- snapshots are detached/non-authoritative;
- no direct cash-credit/test hook is available at the application boundary;
- canonical restock pricing remains domain-owned;
- customer settlement remains single-use and store-authoritative;
- all current BUD-4 upgrade tracks route through authoritative progression state;
- shelf-capacity effects preserve BUD-3 inventory integration;
- expansion prerequisites/economy checks remain enforced;
- customer lifecycle/demand state remains command-bound;
- offline evaluation cannot mutate store state;
- no new external/wallet/persistence authority is introduced;
- existing BUD-1 through BUD-AUDIT-5 fail-closed invariants remain intact.

## Boundary / adversarial tests

`test/budtender/BudtenderApplicationService.spec.ts` covers:

- customer sale + canonical restock flow;
- all-track BUD-4 progression routing;
- shelf-capacity side effects;
- expansion prerequisite failure;
- customer/demand lifecycle;
- detached snapshot immutability;
- runtime raw-authority non-exposure;
- absence of test-only cash injection;
- offline evaluation cannot apply caller-supplied reward state;
- underlying insufficient-cash/customer validation remains fail closed.

A pre-qualification authority review found that TypeScript-only `private` fields would remain runtime properties under Node strip-only execution. The implementation was repaired to native ECMAScript `#private` fields before the final implementation SHA was qualified.

## Exact-head CI evidence

Workflow: **Budtender Qualification**

Run: **37662949859**

Implementation SHA: `b80eb03b50526f470e3a8b778dc0329a27d95ef1`

Workflow result: **SUCCESS**

### Core

Job ID: `112934817176`

- checkout exact PR head: PASS
- Node 22 setup: PASS
- exact qualification head verification: PASS
- syntax-check Budtender TypeScript core/tests: PASS
- complete Budtender TypeScript regression suite, including application-service tests: PASS

### Gaming integration

Job ID: `112934817310`

- checkout exact PR head: PASS
- exact qualification head verification: PASS
- shared Gaming SDK tests: PASS
- Budtender Gaming integration tests: PASS

No Gaming SDK/access implementation changed in BUD-AUDIT-6; this is retained app-workflow regression evidence.

### Gaming contract security

Job ID: `112934816989`

- checkout exact PR head: PASS
- exact qualification head verification: PASS
- shared Gaming Protocol security target build: PASS
- retained `GamingProtocol420*.t.sol` adversarial suite: PASS

No Solidity/shared Gaming Protocol implementation changed in BUD-AUDIT-6; this is retained extra app-workflow coverage, not a new Level 2/Level 3 requirement.

## Security / invariant result

PASS for directly applicable BUD-AUDIT-6 threats:

- presentation code cannot reach raw store/customer domain authorities through ordinary runtime properties;
- returned snapshots cannot mutate authoritative game state;
- callers cannot inject wholesale prices;
- callers cannot directly inject cash;
- offline reward calculations cannot credit the store;
- progression commands preserve established upgrade/expansion validation;
- existing customer/order/economy failure paths remain fail closed;
- no wallet/blockchain/network authority enters the application service.

## Level 2 status

Not required for this ordinary roadmap step.

BUD-AUDIT-6 creates a local application-service boundary but does not yet converge persistence, cloud save, a production client, or a new shared authority lifecycle.

A later app integration milestone should run retained Level 2 coverage when those layers converge.

## Intentionally deferred Level 3 checks

Deferred to final accumulated Budtender app-phase closeout:

- reconciliation with then-current `main`;
- canonical full repository Solidity inventory;
- Genesis Address Authority;
- 420 Integrated/global qualification;
- global Docs reconciliation;
- applicable Indexer/Search/RPC/client/service qualification;
- final security/static/deployment/configuration reconciliation;
- final roadmap/audit/frozen-address/deployment reconciliation.

These deferred checks are not blockers for this ordinary Level 1 step.

## Limitations / blockers

BUD-AUDIT-6 itself has no remaining implementation or Level 1 qualification blocker.

The application service remains in-memory. It does not implement:

- guest/local persistence;
- save schema/versioning/migration;
- cloud save;
- crash recovery;
- backend services;
- production presentation/mobile client.

BUD-AUDIT-5 offline rewards remain evaluation-only until trusted persistence owns the offline cursor/source state.

Live Gaming Protocol testnet deployment remains a separate release blocker and is unchanged by this step.

## Completion state

**BUD-AUDIT-6 — COMPLETE**

Qualified implementation SHA:

`b80eb03b50526f470e3a8b778dc0329a27d95ef1`

The commits that record this evidence are documentation/evidence-only and therefore inherit the qualified implementation result without recursive substantive requalification.

## Next canonical roadmap step

**BUD-AUDIT-7 — User-Facing Budtender Client**

Build the primary presentation client over the now-qualified application service while preserving BUD-ARCH-009: UI/presentation remains non-authoritative for economy and progression state.
