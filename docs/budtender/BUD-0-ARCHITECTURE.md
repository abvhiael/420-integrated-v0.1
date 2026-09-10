# Budtender BUD-0 — Architecture Freeze

Status: COMPLETE

## Purpose

BUD-0 defines the non-negotiable architecture for Budtender before gameplay implementation proceeds. Later phases may extend these boundaries but must not silently violate them.

## Product identity

Budtender is a mobile-first cannabis retail / café management game inspired by fast, accessible tycoon loops. It is a game first. Blockchain, wallet, and ecosystem features are optional enhancement layers and must never be required for the base game loop.

## Core player journey

Guest play -> registered account -> optional 420 Wallet / 420GameIdentity connection.

A guest must be able to begin immediately, progress through ordinary gameplay, save locally, and enjoy the full core management loop without blockchain knowledge.

## Canonical game layers

Budtender is divided into the following bounded domains:

1. Simulation Core
2. Customer System
3. Store Operations
4. Product / Inventory System
5. Staff / Automation System
6. Upgrade System
7. Progression / District System
8. Café / Lounge System
9. Delivery System
10. Simplified Cultivation System
11. Manufacturing System
12. Mission / Event System
13. Economy System
14. Persistence / Save System
15. Account / Cloud Save Layer
16. Optional 420GameIdentity / AccessLayer Adapter
17. Optional Cross-Game Entitlement Layer
18. Presentation / Mobile Client

The simulation core owns authoritative gameplay state transitions. Rendering and wallet adapters may observe or invoke sanctioned transitions but must not become authoritative for ordinary game state.

## Economy boundary

Budtender uses an internal game economy for normal progression.

Internal game currency funds ordinary upgrades, staffing, inventory, expansion, production, and district progression.

$420 and other blockchain-backed value are outside the base progression economy. Wallet-connected rewards, collectibles, event prizes, and marketplace features must be additive and must not be required to complete ordinary progression.

No BUD phase may convert the ordinary game economy into an on-chain balance without a separate architecture decision.

## Product / inventory boundary

Budtender products are game-domain resources. The game may model categories, rarity, quality, price, demand, stock, production inputs, and retail outputs.

The initial product families are:
- flower
- pre-rolls
- edibles

Later phases may add vapes, concentrates, beverages, accessories, café items, and production inputs.

Product models must remain suitable for a management game. Budtender is not intended to simulate medical efficacy or real-world pharmacology.

## Customer boundary

Customers are simulated game actors. Customer AI may consider product demand, patience, spending power, store reputation, queue state, and event modifiers.

Customer behaviour must remain deterministic or seedable enough for qualification tests around economy and progression.

The customer system may never directly mutate wallet, account, or blockchain state.

## High Country separation

Budtender and High Country are separate simulations.

High Country remains the deep cultivation / genetics game. Budtender cultivation is intentionally simplified and exists to support the retail-management supply chain.

Budtender must not import High Country's live plant simulation, phenotype engine, environmental state, or canonical cultivation state.

Future High Country integration occurs through explicit cross-game entitlements or references, for example:
- strain unlock
- branded product line
- trophy / décor unlock
- breeder badge
- seasonal event entitlement

Budtender interprets those entitlements into Budtender-native game content.

## Persistence model

Three persistence tiers are canonical:

### Tier 1 — Guest
- local/device save
- no account required
- no wallet required

### Tier 2 — Registered account
- cloud save
- cross-device restore
- player identity independent of wallet

### Tier 3 — 420-connected account
- optional wallet link
- 420GameIdentity association
- ecosystem entitlements
- cross-game achievements
- eligible rewards / collectibles

A wallet disconnect must not destroy or invalidate ordinary progression.

## Offline progression boundary

Offline progression is permitted for systems explicitly marked offline-capable, such as automated retail, production, cultivation timers, delivery completion, and capped income.

Offline progression must be deterministic from stored state plus elapsed time and must have bounded accumulation. It must not require blockchain availability.

## 420GameIdentity / AccessLayer boundary

Budtender does not implement its own wallet identity system.

When the shared 420GameIdentity / AccessLayer exists, Budtender consumes it through an adapter boundary.

The adapter may expose:
- account linkage
- wallet connection status
- entitlement checks
- cross-game achievements
- collectible ownership
- scoped game permissions
- revocation / disconnect state

The adapter must not own ordinary store state, cash, inventory, upgrades, customer state, or progression.

## Cross-game integration boundary

Cross-game functionality is entitlement-based rather than shared mutable simulation state.

Example:
High Country achievement -> shared entitlement -> Budtender unlock.

Budtender remains playable and internally coherent when all external game integrations are unavailable.

## Mobile / presentation boundary

The mobile client is a presentation and input layer over game-domain services.

UI code may not become the source of truth for:
- cash
- inventory
- order settlement
- upgrades
- staff state
- progression
- production
- persistence rules

This preserves deterministic testing and allows later platform clients to reuse the same game logic.

## Security and integrity principles

- Fail closed on invalid economy transitions.
- No negative cash or inventory.
- No duplicate settlement of the same order/reward/action.
- No wallet requirement for base gameplay.
- No external integration may corrupt local core-game state.
- External entitlements must be validated before unlocks are granted.
- Save migrations must be versioned.

## BUD-0 architecture invariants

- `BUD-ARCH-001`: Core gameplay is fully operable without wallet or blockchain connectivity.
- `BUD-ARCH-002`: Ordinary progression uses internal game state and internal game currency.
- `BUD-ARCH-003`: Wallet / 420GameIdentity integration is adapter-based and non-authoritative for core store state.
- `BUD-ARCH-004`: High Country canonical cultivation state is never copied into Budtender simulation state.
- `BUD-ARCH-005`: Cross-game integration is entitlement/reference based, not shared mutable simulation state.
- `BUD-ARCH-006`: Registered accounts and cloud saves remain possible without wallet linkage.
- `BUD-ARCH-007`: Wallet disconnect cannot erase or invalidate ordinary Budtender progression.
- `BUD-ARCH-008`: Offline progression is deterministic, bounded, and chain-independent.
- `BUD-ARCH-009`: UI/presentation code is not authoritative for economy or progression state.
- `BUD-ARCH-010`: Save formats are versioned and migration-aware before production release.

## Phase dependency rules

BUD-1 and later gameplay work must conform to this document.

Any future phase that needs to break one of these invariants requires an explicit architecture amendment, migration plan, and qualification coverage rather than an implicit implementation change.

## BUD-0 exit criteria

- canonical domain boundaries frozen
- guest/account/wallet progression model frozen
- internal-vs-on-chain economy boundary frozen
- High Country separation frozen
- offline progression boundary frozen
- shared 420GameIdentity adapter boundary frozen
- cross-game entitlement model frozen
- architecture invariants documented

All exit criteria are satisfied by this document.
