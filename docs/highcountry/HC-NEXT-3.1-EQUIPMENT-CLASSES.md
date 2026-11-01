# HC-NEXT-3.1 — Equipment catalogue and lifecycle integration

## Source of truth and authority

The new **HC.EQUIPMENT.CATALOGUE.V1** baseline is encoded in
`contracts/src/highcountry/equipment/EquipmentClassCatalogueV1.sol`.
Its five class categories reflect the retained High Country equipment roadmap:
lighting, ventilation, irrigation, nutrient delivery, and climate control.
The exact numbers below are a **new V1 gameplay implementation baseline**,
not recovered historical user-approved balance parameters or evidence of deployed admission.
Only the authorized EquipmentRegistry administrator can enroll immutable type definitions;
only the lifecycle administrator can enroll matching immutable policies.
Do not imply that deploying the read-only catalogue itself grants production admission.

Equipment IDs, earning references, contract ownership, parcel occupancy, verified use,
condition, repair, manufacturing inputs, recycling, and inventory movements remain
authoritative in their existing contracts. There is no wallet-linked stat bonus.

## Classes, upgrade effects and operating inputs

Effects are signed deltas in this exact order:
**temperature (centi°C), humidity, light, water, nutrients, airflow**.
They are applied before the existing CultivationEngine input bounds and scores.

| Class | Basic: slot / effect | Upgraded: slot / effect | Operating input |
| --- | --- | --- | --- |
| Lighting | 1 / light +600 | 2 / light +1200 | POWER units |
| Ventilation | 1 / humidity −200, airflow +600 | 2 / humidity −400, airflow +1200 | POWER units |
| Irrigation | 1 / water +600 | 2 / water +1200 | WATER units |
| Nutrient delivery | 1 / nutrients +600 | 2 / nutrients +1200 | NUTRIENTS units |
| Climate control | 1 / temperature −100, humidity +300 | 2 / temperature −200, humidity +600 | POWER units |

Each input is a separately registered `COUNT` resource in InventoryRegistry; inputs
are not fabricated by equipment use. Real owner stock and explicit inventory-operator
consent are required. Basic items consume **1** operating unit per verified use;
upgraded items consume **2** units. Both reservation and consumption execute in
the same transaction as wear and environmental application, and any downstream failure
rolls back all effects and material debit. An unverified direct player call cannot
record a use. Zero inventory, revoked consent, invalid parcel, emergency restriction,
broken item, or out-of-range resulting environment fails closed.

## Lifecycle, maintenance and manufacturing recipe envelope

| Per-item rule | Basic | Upgraded |
| --- | ---: | ---: |
| Maximum durability | 100 | 160 |
| Wear per verified use | 10 | 16 |
| Degraded when durability below | 30 | 48 |
| Equipment contribution when degraded | 50%, signed division toward zero | 50%, signed division toward zero |
| Repair material | 2 spare-parts COUNT | 4 spare-parts COUNT |
| Durability restored per repair, capped at max | 60 | 96 |
| Operating input per use | 1 COUNT | 2 COUNT |
| Salvage after permanent retirement | 1 recycled-scrap COUNT | 2 recycled-scrap COUNT |
| Recipe primary input | 3 spare-parts COUNT | 6 spare-parts COUNT |
| Recipe secondary input | 2 class operating units | 4 class operating units |
| Manufacturing output | 1 class-specific equipment component | 1 class-specific equipment component |

Acquisition uses ManufacturingEngine's existing immutable versioned recipe,
reserve/consume/output lifecycle, then ManufacturedEquipmentIssuer's single-use
completed-job provenance and owner-authorized output consumption. The registered
manufacturing recipe **must match the equipment catalogue version**, and the
equipment lifecycle policy must match the exact same immutable version.
The deployed operator must register named typed resources and class-specific
manufacturing recipes and bind the reviewed actual issuer grants; a catalogue
definition alone never credits free materials or equipment.

An upgrade requires a **new earned upgraded type ID and source provenance**,
not mutation of old effects, free unlocking, or retroactive item reroll. Old equipment
retains its immutable history and can be removed, separately transferred, retired
and recycled. Repair never increases maximum durability or changes class/tier.

## Ownership, resale boundary and recycling

A holder can only offer an **unplaced, nonretired** item to a named recipient with a
bounded expiry (at most 30 days). The recipient must independently accept.
The previous owner can cancel safely even while MARKET is restricted.
Offers block placement; retired items cannot be transferred; accepted handoffs are
single use. The item retains original earning reference, exact class, and accrued
condition, including any degraded or broken state. A buyer cannot reset durability
by accepting transfer. All subsequent inventory costs, repairs and salvage belong
to the current canonical owner.

**An ownership handoff is not payment settlement.** No BUDS/native $420 charges,
escrow, royalties, implicit price, sale finality, custody, or listing acceptance is
claimed by this feature. Paid resale requires independent CanonicalMarketEscrow
asset-specific delivery and funded settlement qualification before deployment; an
offchain payment assertion may never authorize a unilateral equipment transfer.

Retirement permanently releases equipped land slots and active effects; recycling
is owner-authorized, requires actual retirement, mints only the pinned salvage type
and quantity, and can happen **once**. Failed salvage issuance rolls back the entire
recycling transaction. No destruction of historical provenance or cross-owner
ownership reset is permitted.

## Qualification and separated acceptance

Required exact-SHA scope: R04.2 ownership/placement, R04.4 lifecycle/material tests,
R04.2–R04.4 Level 2 integration, R04 retained app, true manufacturing-to-equipment
issuer tests, and focused adverse paths for no-stock, delegated-operator revocation,
degraded signed effects, failed repair, replay, transfer and retirement.

The installed code is the repository qualification candidate. Guest/local cultivation
remains independent and may not issue canonical equipment. Authenticated R05 runtime,
official production-approved class/recipe balances, real issuer manifests, deployed
emergency controls and market settlement are distinct operational acceptance gates.
The above baseline is not a deployed-economy claim.
