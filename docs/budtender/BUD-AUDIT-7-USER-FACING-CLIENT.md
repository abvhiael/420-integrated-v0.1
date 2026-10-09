# BUD-AUDIT-7 — User-Facing Budtender Client

Status: COMPLETE — Level 1 exact-head qualified

## Authority and scope

This audit step implements the first user-facing Budtender presentation client over the qualified BUD-AUDIT-6 application service.

Canonical BUD-0 requires the mobile/presentation client to remain a presentation and input layer over game-domain services. UI code must not become authoritative for cash, inventory, order settlement, upgrades, progression, production, or persistence rules.

This step does not add durable persistence, cloud saves, wallet authority, blockchain dependencies, production deployment, or new gameplay mechanics.

## Client implementation

The client lives at:

`clients/budtender-web-v1`

It is a mobile-first responsive browser client hosted by a dependency-light Node 22 local server.

The Node host imports and owns one `BudtenderApplicationService` instance. Browser code communicates with that service only through sanctioned same-origin API routes.

The browser renders detached service snapshots and sends commands. It does not calculate or mutate authoritative cash, inventory, progression, order settlement, customer status, upgrade effects, or expansion state.

## User-facing capabilities

The client exposes the currently implemented gameplay slice:

- live cash display;
- product inventory/stock/capacity display;
- canonical one-unit restocking command;
- customer creation by product/archetype;
- deterministic customer queue display;
- customer serve/settlement;
- queue time advancement;
- demand profile switching;
- all currently implemented BUD-4 upgrade tracks;
- expansion state display and unlock commands;
- mobile-responsive/touch-friendly layout;
- visible fail-closed error reporting.

## Presentation authority boundary

- Browser state is render-only and replaceable from `GET /api/state`.
- Browser code cannot directly credit cash.
- Browser code cannot directly settle orders.
- Browser code cannot provide wholesale unit prices.
- Browser code cannot mutate inventory or progression objects.
- The host never returns raw `BudtenderStore`, `ProductInventory`, `StoreProgression`, or customer-system references.
- All commands delegate to `BudtenderApplicationService`.
- No endpoint applies offline rewards; BUD-AUDIT-5 remains non-mutating until trusted persistence exists.
- The client does not require wallet, account, blockchain, Gaming Protocol, or network-external services for ordinary gameplay.

## Host/API surface

Read:

- `GET /api/state`

Commands:

- `POST /api/customers`
- `POST /api/customers/:id/serve`
- `POST /api/tick`
- `POST /api/restock`
- `POST /api/upgrades`
- `POST /api/expansions`
- `POST /api/demand`

Unknown API routes fail closed.

The host caps JSON request bodies at 16 KiB and serves only files rooted under the client's public directory.

## Client invariants

- `BUD-UI-001`: User-visible game state is rendered from application-service snapshots.
- `BUD-UI-002`: UI code cannot directly mutate authoritative cash.
- `BUD-UI-003`: UI code cannot directly mutate authoritative inventory.
- `BUD-UI-004`: UI code cannot directly settle orders or customers outside sanctioned service commands.
- `BUD-UI-005`: UI callers cannot provide or override canonical restock pricing.
- `BUD-UI-006`: Upgrade and expansion commands preserve BUD-4 validation.
- `BUD-UI-007`: Repeated customer settlement remains rejected.
- `BUD-UI-008`: Offline reward application is not exposed.
- `BUD-UI-009`: Client remains fully usable without wallet/blockchain connectivity.
- `BUD-UI-010`: UI uses mobile-first responsive/touch-friendly presentation.
- `BUD-UI-011`: Invalid/oversized API requests fail closed.
- `BUD-UI-012`: The client host does not expose raw domain authority objects.

## Level 1 qualification

Directly applicable qualification is the Budtender app-specific workflow against the exact implementation SHA.

Required:

- existing Budtender TypeScript syntax/regression suite;
- web-client host TypeScript syntax check;
- browser script syntax check;
- web-client API/presentation authority tests;
- retained Budtender Gaming integration;
- retained shared Gaming Protocol security regression already owned by the app workflow.

The web-client package intentionally has no external runtime or dev dependencies.

## Level 2 milestone relationship

BUD-AUDIT-7 remains an ordinary Level 1 step.

It converges the presentation layer with the application service, but persistence/cloud lifecycle and live shared authority are still absent. A broader retained Level 2 milestone is deferred until those material layers converge or a later canonical step explicitly requires it.

## Exit criteria

BUD-AUDIT-7 is COMPLETE only when:

1. a usable user-facing client exists;
2. the client presents the implemented BUD-1 through BUD-4 gameplay slice through BUD-AUDIT-6;
3. browser/UI state is non-authoritative;
4. cash/inventory/settlement/progression authority remains server/application-domain owned;
5. no wallet/blockchain requirement is introduced for base gameplay;
6. invalid/replayed/oversized requests fail closed;
7. client host/browser syntax checks pass;
8. client API/authority tests pass;
9. complete Budtender regressions pass;
10. the exact implementation SHA passes the app-specific Level 1 workflow (satisfied by `9961bf25b7ee7d0fb750cfdbb6676d7fdc01d1ec`, Budtender Qualification run `37670777590`, all four jobs PASS);
11. durable evidence records implementation SHA, CI evidence, base SHA, limitations, deferred checks, and next roadmap step (recorded in `docs/audit/BUD-AUDIT-7-EVIDENCE-2026-10-07.md`).

## Known limitations

The current client is a responsive browser client, not a packaged native iOS/Android binary.

The service remains in-memory. Reloading the browser preserves state only while the local host process remains alive; restarting the host resets state.

Guest/local save, migration-aware persistence, cloud save, production hosting/deployment, and live Gaming Protocol runtime integration remain later audit work.
