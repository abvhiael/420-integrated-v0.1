# BUD-AUDIT-7 — Level 1 qualification evidence

Date: 2026-10-07

Status: COMPLETE

## Roadmap step

BUD-AUDIT-7 — User-Facing Budtender Client

Qualification level: Level 1 — app-scoped fast qualification.

## Authoritative implementation SHA

`9961bf25b7ee7d0fb750cfdbb6676d7fdc01d1ec`

Base `main` SHA at qualification:

`c8e8b58d818611276f7a9bb2b8d2241004450d97`

Audit branch:

`audit/budtender-complete-20261007`

PR:

#561 — `audit(budtender): repository-grounded qualification and remediation`

Branch divergence at implementation qualification: 63 commits ahead / 0 behind `main`.

## Implementation summary

BUD-AUDIT-7 adds the first user-facing Budtender presentation client while preserving BUD-0 and BUD-AUDIT-6 authority boundaries.

New package:

`clients/budtender-web-v1`

Implemented:

- dependency-light Node 22 presentation host;
- responsive mobile-first browser client;
- touch-friendly controls and visible error handling;
- same-origin API over one `BudtenderApplicationService` instance;
- detached application snapshots as the only browser-visible state authority;
- customer creation, ticking and single-use settlement;
- canonical one-unit restocking with domain-owned wholesale pricing;
- all current BUD-4 upgrade tracks;
- expansion display/unlock commands;
- demand profile switching;
- no wallet/blockchain/account requirement for base gameplay;
- no endpoint capable of applying offline rewards.

The browser remains a presentation/input layer. It does not own authoritative cash, inventory, settlement, customer terminal state, upgrades, progression, expansion, or persistence state.

## Files changed for this step

Executable / client:

- `.github/workflows/budtender-gaming.yml`
- `clients/budtender-web-v1/package.json`
- `clients/budtender-web-v1/src/server.ts`
- `clients/budtender-web-v1/public/index.html`
- `clients/budtender-web-v1/public/styles.css`
- `clients/budtender-web-v1/public/app.js`
- `clients/budtender-web-v1/test/server.test.ts`

Substantive documentation before qualification:

- `clients/budtender-web-v1/README.md`
- `docs/budtender/BUD-AUDIT-7-USER-FACING-CLIENT.md`
- `src/budtender/README.md`
- `docs/audit/BUDTENDER-AUDIT-2026-10-07.md`

Evidence-only closeout follows the qualified implementation SHA.

## Requirements satisfied

The implementation satisfies `BUD-UI-001` through `BUD-UI-012`:

- user-visible state is rendered from application-service snapshots;
- UI cannot directly mutate authoritative cash;
- UI cannot directly mutate authoritative inventory;
- UI cannot directly settle orders/customers outside sanctioned service commands;
- callers cannot override canonical restock pricing;
- upgrades/expansions preserve BUD-4 validation;
- repeated customer settlement remains rejected;
- offline reward application is not exposed;
- base client remains wallet/blockchain independent;
- presentation is responsive/touch-friendly;
- invalid/oversized API requests fail closed;
- raw domain authority objects are not exposed to the browser.

## Client/API boundary tests

`clients/budtender-web-v1/test/server.test.ts` covers:

- responsive presentation shell availability;
- initial snapshot retrieval;
- customer creation and settlement;
- repeated settlement/replay rejection;
- canonical server-side restock pricing despite caller-supplied `unitCost`;
- insufficient-cash progression rejection;
- successful progression after earned cash;
- unknown API-route rejection;
- oversized JSON-body rejection;
- absence of an offline-reward application endpoint.

## CI workflow repair

BUD-AUDIT-7 exposed an app-workflow efficiency defect: each intermediate PR head spawned another four-job Budtender qualification run and the workflow lacked superseded-head cancellation.

The exact implementation SHA includes the repair:

- PR-scoped Budtender concurrency group;
- `cancel-in-progress: true`;
- future superseded heads no longer accumulate redundant qualification work.

The repair changes qualification workflow behavior and was therefore included in, and validated by, the final exact implementation SHA.

## Exact-head CI evidence

Workflow: **Budtender Qualification**

Run: **37670777590**

Implementation SHA: `9961bf25b7ee7d0fb750cfdbb6676d7fdc01d1ec`

Workflow result: **SUCCESS**

### Core

Job ID: `112961677334`

- checkout exact PR head: PASS
- Node 22 setup: PASS
- exact qualification head verification: PASS
- Budtender TypeScript syntax checks: PASS
- complete BUD-1 through BUD-4/BUD-AUDIT regression suite: PASS

### Web client

Job ID: `112961677374`

- checkout exact PR head: PASS
- Node 22 setup: PASS
- exact qualification head verification: PASS
- `npm run check`: PASS
- web-client host/browser syntax checks: PASS
- `npm test`: PASS
- client API/presentation authority suite: PASS

### Gaming integration

Job ID: `112961677056`

- checkout exact PR head: PASS
- exact qualification head verification: PASS
- shared Gaming SDK tests: PASS
- Budtender Gaming integration tests: PASS

No shared Gaming implementation was materially changed by this roadmap step; this is retained app-workflow regression evidence.

### Gaming contract security

Job ID: `112961677386`

- checkout exact PR head: PASS
- exact qualification head verification: PASS
- shared Gaming Protocol security target build: PASS
- retained `GamingProtocol420*.t.sol` adversarial suite: PASS

No Solidity/shared Gaming Protocol implementation was materially changed by this roadmap step; this is retained extra app-workflow coverage, not a new Level 2 or Level 3 requirement.

## Security / invariant result

PASS for directly applicable BUD-AUDIT-7 threats:

- browser does not own cash/inventory/progression authority;
- browser cannot directly settle an order;
- repeated settlement fails closed;
- caller-supplied restock price cannot override canonical domain price;
- invalid and oversized requests fail closed;
- no raw domain authority is exposed to the client;
- no offline-reward application endpoint exists;
- ordinary gameplay remains wallet/blockchain independent.

## Level 2 status

Not required for this ordinary roadmap step.

The presentation layer now converges with the application service, but durable persistence/cloud lifecycle and live shared authority remain absent.

A broader retained Level 2 milestone remains deferred until those material layers converge or a later canonical roadmap step explicitly requires it.

## Intentionally deferred Level 3 checks

Deferred to final accumulated Budtender app-phase closeout:

- reconciliation with then-current `main`;
- canonical full repository Solidity inventory;
- Genesis Address Authority;
- 420 Integrated/global qualification;
- global Docs reconciliation;
- applicable client/service/Indexer/Search/RPC qualification;
- final security/static/deployment/configuration verification;
- roadmap/audit/frozen-address/deployment reconciliation.

These deferred checks are not blockers for this ordinary Level 1 step.

## Limitations / blockers

BUD-AUDIT-7 itself has no remaining implementation or Level 1 qualification blocker.

Current limitations:

- client state remains backed by an in-memory application service;
- restarting the host resets game state;
- durable guest/local persistence is not implemented;
- versioned save migration is not implemented;
- registered cloud save is not implemented;
- client is responsive browser delivery, not a packaged native iOS/Android binary;
- production hosting/deployment is not yet qualified;
- live Gaming Protocol testnet runtime remains unresolved.

## Completion state

**BUD-AUDIT-7 — COMPLETE**

Qualified implementation SHA:

`9961bf25b7ee7d0fb750cfdbb6676d7fdc01d1ec`

The commits that record this evidence are documentation/evidence-only. They do not modify executable source, tests, workflows, dependencies, configuration, runtime/generated artifacts, interfaces, deployment state, or substantive requirements, so they inherit the qualified implementation result without recursive substantive requalification.

## Next canonical roadmap step

**BUD-AUDIT-8 — Gaming Protocol Integration**

Qualify the Budtender application's optional Gaming Protocol integration and authority boundaries without making wallet/chain connectivity a requirement for ordinary gameplay.
