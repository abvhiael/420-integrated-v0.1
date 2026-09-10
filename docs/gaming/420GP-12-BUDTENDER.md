# 420GP-12 — Budtender integration

Budtender is the third reference consumer of the shared 420 Gaming Protocol and uses the same progressive access model proven by High Country and The Green Road.

## Player progression

GUEST -> REGISTERED -> WALLET-LINKED

Core dispensary/cafe management remains playable without a wallet. Conventional registration is used for cloud-save continuity. Wallet linkage is reserved for optional ecosystem features.

## Core gameplay remains wallet-free

The following must not require a wallet merely to progress the management game:
- serving customers;
- stocking ordinary inventory;
- hiring/upgrading ordinary staff;
- store layout and ordinary decor;
- revenue/progression loops;
- core locations and management objectives.

## Optional wallet boundaries

Wallet-linked access may be used for:
- premium cosmetic decor;
- collectible fixtures and display items;
- optional seasonal ecosystem events;
- cross-game collectibles/items;
- optional $420 rewards and ownership/provenance features.

Wallet linkage alone must not increase sales speed, customer patience, margins, staff efficiency, inventory yield, progression rate, or other competitive/statistical gameplay values.

## Shared protocol

Canonical game namespace:
`420/GAMING/GAME/BUDTENDER/V1`

The client reuses `@420/gaming-sdk`; it does not create parallel identity, wallet, session, entitlement, claim, or attestation authority.

Game-scoped profile, migration, entitlement and attestation queries remain explicit and privacy-scoped. Budtender must not expose wallet-wide or cross-game activity enumeration.

## Qualification

The dedicated Budtender workflow runs both the shared Gaming SDK tests and Budtender access regression tests. The integrated repository qualification remains an additional merge gate.
