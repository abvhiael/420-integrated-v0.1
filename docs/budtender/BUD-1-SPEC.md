# BUD-1 Specification — Minimum Playable Store

## Objective

Deliver a deterministic, wallet-free minimum playable dispensary loop suitable as the simulation core beneath a future mobile client.

## Required loop

1. Spawn customer order.
2. Validate requested starter product.
3. Reserve one unit of inventory.
4. Serve order.
5. Credit store cash exactly once.
6. Restock inventory using store cash.
7. Purchase bounded first-stage upgrades using store cash.

## Starter products

- Flower
- Pre-roll
- Edible

## Core invariants

- `BUD-INV-001`: inventory cannot fall below zero.
- `BUD-INV-002`: an order can be served at most once.
- `BUD-INV-003`: serving an unknown or unavailable product fails closed.
- `BUD-INV-004`: cash only increases from valid completed sales and cannot be spent below zero.
- `BUD-INV-005`: restocking cannot exceed shelf capacity.
- `BUD-INV-006`: upgrades cannot exceed their configured maximum level.
- `BUD-INV-007`: guest gameplay has no wallet or chain dependency.

## Initial upgrade axes

- Shelf capacity
- Service speed
- Sale value

## Out of scope for BUD-1

- Wallet integration
- 420GameIdentity
- Staff automation
- Café/lounge
- Delivery
- Cultivation
- Manufacturing
- Live ops
- Blockchain state

These remain later roadmap phases.
