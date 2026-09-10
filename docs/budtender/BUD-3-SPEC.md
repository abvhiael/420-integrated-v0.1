# BUD-3 Specification — Product & Inventory System

Status: in progress

## Objective

Expand Budtender from the three hard-coded starter products into a deterministic product/catalog domain suitable for later progression, demand, quality, production, and retail systems.

## Product model

Each product has:
- stable product id
- category
- display name
- quality tier
- base sale price
- wholesale unit cost
- base demand
- stock
- capacity
- unlocked state

## Initial categories

- flower
- preroll
- edible

Later phases may add vapes, concentrates, beverages, accessories, café items, and production inputs without changing the BUD-3 inventory contract.

## Quality tiers

- budget
- standard
- premium
- craft
- exotic

Quality is a game-economy attribute only. It is not a medical or pharmacological claim.

## Required operations

1. Register deterministic catalog entries.
2. Reject duplicate ids.
3. Unlock products explicitly.
4. Stock unlocked products only.
5. Reject stock above capacity.
6. Consume stock atomically.
7. Expose deterministic sale and wholesale values.
8. Preserve non-negative stock and cash-facing values.

## BUD-3 invariants

- `BUD-PROD-001`: product ids are unique and stable.
- `BUD-PROD-002`: stock is never negative.
- `BUD-PROD-003`: stock never exceeds capacity.
- `BUD-PROD-004`: locked products cannot be stocked or consumed.
- `BUD-PROD-005`: sale price and wholesale cost are non-negative integers.
- `BUD-PROD-006`: wholesale cost cannot exceed base sale price in the starter catalog.
- `BUD-PROD-007`: demand is bounded to an integer scale from 0 through 100.
- `BUD-PROD-008`: catalog/inventory state is wallet and chain independent.

## Out of scope

- dynamic pricing
- staff-driven restocking
- manufacturing recipes
- cultivation inputs
- retailer sourcing
- blockchain-backed products
- High Country live state
