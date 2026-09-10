# BUD-4 Specification — Store Upgrade Loop

## Objective

Create a deterministic progression service for ordinary Budtender store upgrades and physical expansion. This phase remains fully internal to the game economy and must not depend on wallet, chain, account, or cross-game state.

## Upgrade tracks

- counterSpeed
- shelfCapacity
- saleValue
- customerPatience
- tipChance
- restockCapacity
- decorAppeal

## Expansion stages

1. tinyShop
2. largerRetailFloor
3. secondCounter
4. premiumSection
5. storageRoom
6. cannabisCafe
7. lounge
8. deliveryDesk

## Purchase rules

- Every track has a configured maximum level.
- Costs escalate deterministically by level.
- Purchases are atomic: cash is deducted only if the upgrade can be applied.
- Expansion unlocks require explicit prerequisite stages.
- Expansion unlocks are one-time and cannot be purchased twice.
- Internal game cash is the only BUD-4 payment source.

## Core invariants

- `BUD-UPG-001`: upgrade levels never exceed configured maxima.
- `BUD-UPG-002`: upgrade costs are deterministic non-negative integers.
- `BUD-UPG-003`: purchases cannot drive cash below zero.
- `BUD-UPG-004`: failed purchases do not mutate progression state.
- `BUD-UPG-005`: expansion stages unlock in canonical prerequisite order.
- `BUD-UPG-006`: an expansion stage can be unlocked at most once.
- `BUD-UPG-007`: core progression is wallet/account/chain independent.

## Out of scope

- staff automation
- reputation
- district progression
- cafe operations
- delivery operations
- blockchain rewards
