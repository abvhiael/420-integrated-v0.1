# HC-ART-05 — Building Economy & Outbuilding Abilities Contract v1.0

Status: **DESIGN LOCKED; IMPLEMENTATION DEFERRED** (owner direction, 2026-10-27). This document is a game-mechanics design authority, **not** evidence of deployed abilities or qualified placement.

## Scope and decision

Applies to the planned HC-ART-05-A through HC-ART-05-F building families (six collections of 18; 108 planned exteriors). Only **HC-ART-05-A's 18 abilities** are individually specified and locked below. The other collections' identities/abilities are reviewed and locked **after** each full collection's exterior artwork is prepared/uploaded; do not infer invented bonuses for them.

**Canonical player journey: BUDS purchase → owned building inventory → authenticated instant placement → furnish and install compatible equipment → capabilities calculated from installed equipment.**

- Buildings are bought **outright with BUDS**, as complete inventory entitlements; the initial release requires neither blueprints, construction materials, construction permits as consumable entitlements, nor build timers. Parcel/legal placement permission remains mandatory.
- Placement is immediate **only after** the server authoritatively validates registered ownership, purchase provenance, available/unreserved inventory unit, parcel permissions, approved footprint/geometry, collisions, accessibility and revision/idempotency rules. If those gates are unavailable, fail closed; do not simulate server authority in browser code.
- Upon valid placement, the owned building instance appears with its approved **base** capabilities. Where a capacity or benefit is equipment-dependent, merely buying the building does not confer it.
- Furnish interiors with compatible furniture/equipment. Installed items must be individually owned and attached to qualified slots or occupancy masks. Their valid active state, optional connected resources and maintenance status determine benefits; removing/disconnecting them recomputes and removes the dependent benefit.
- Types of benefits: **capacity**, **targeted operational efficiency**, and **capability unlocks**. No unrestricted crop-yield multipliers, unlimited stacking, resource minting or noncanonical genetics alterations. Essential capabilities must have fair region-accessible alternatives.
- Moving, removing, selling, trading or storing a building must safely resolve its installed objects and content; preserve ownership, prevent duplication, and atomically reconcile contents/equipment or reject the operation. Do not silently erase or duplicate child assets.
- Improved building generations, optional blueprint/construction entitlements and player-run construction services are **future expansions**, not Genesis prerequisites.
- This art-focused thread designs/extracts/labels/uploads buildings, then locks their abilities **after** the full art collection is uploaded. Detailed tools, furniture, machinery, upgrade socket schemas, balance numbers and crafting recipes belong to later separately scoped work.

## HC-ART-05-A: locked shed abilities

| No. | Region | Building | Primary capability | Secondary benefit |
| --- | --- | --- | --- | --- |
| 01 | universal | Heritage Garden Tool Shed | Tool inventory and equipment organization | Faster equipment retrieval and preparation |
| 02 | universal | Botanical Potting Shed | Dedicated potting and transplant preparation | Reduced potting-medium waste through preparation stations |
| 03 | universal | Rainwater Utility House | Water collection, storage and distribution | Buffer against temporary water shortages |
| 04 | universal | Equipment Storage Barnlet | Storage for large cultivation equipment | Protected equipment storage and maintenance staging |
| 05 | universal | Heritage Seed Storehouse | Organized seed inventory and preservation | Reduced modeled seed-storage deterioration |
| 06 | universal | Off-Grid Utility Cabin | Power storage and regulated utility distribution | Limited backup power for supported property equipment |
| 07 | emerald-coast | Cedarwood Storage Lodge | High-capacity general storage | Protected storage for weather-sensitive materials |
| 08 | emerald-coast | Coastal Rain Collector | High-volume rainwater harvesting | Collection during qualifying rainfall |
| 09 | emerald-coast | Driftwood Equipment Shack | Outdoor equipment and tool storage | Coastal-weather protection for eligible tools |
| 10 | emerald-coast | Woodland Keeper's Outbuilding | Multi-purpose property operations centre | Shared equipment organization and work staging |
| 11 | golden-prairie | Prairie Field Store | Bulk materials and supplies storage | Efficient staging of bulk inventory |
| 12 | golden-prairie | Prairie Greenhouse Shed | Protected potting and seedling preparation | Supports covered preparation and greenhouse equipment |
| 13 | golden-prairie | Prairie Equipment Barn | Machinery and equipment storage | Maintenance and equipment protection |
| 14 | golden-prairie | Prairie Ranch Utility Shack | General utilities and equipment staging | Wind-powered utility support when properly equipped |
| 15 | red-mesa | Mesa Supply Shed | Protected dry-goods storage | Reduced exposure to modeled heat and dust conditions |
| 16 | red-mesa | Desert Water House | Water storage and controlled distribution | Evaporation-loss reduction through covered storage |
| 17 | red-mesa | Mesa Workshop | General equipment maintenance and repair staging | Enables qualifying basic repair activities |
| 18 | red-mesa | Ranch Storage Shelter | Bulk and oversized equipment storage | Protected staging for large materials and machinery |

Secondary benefits define supported mechanics, not unconditional activation or approved numerical values. Examples: reduced waste requires a qualifying preparation station and authenticated recipe/material accounting; backup power requires appropriate installed generation/storage and real energy accounting; water harvesting requires qualifying weather and an accounted source; repair requires an installed station and authorized repairs. Storage/protection is limited by actual compatible items, available capacity and modeled exposures.

## Future mechanics and contract integration boundaries

1. **Catalogue/marketplace**: purchase quote/settlement in BUDS, definitive unit entitlements and transaction receipts; buy-once/fulfil-once; price/version provenance; no synthetic inventory credit.
2. **Inventory/custody**: stable building-instance ID, owner, revision, custody state, parent-child equipment references and transfers. Purchased-but-unplaced and placed units must be distinguishable and not simultaneously available.
3. **HC-PLACE**: authoritative building and equipment placement, geometry/masks, room access, attachment slots, access/parcel checks, concurrency and atomic persistence. Follow `docs/highcountry/HC-PLACE-01-ARCHITECTURE-BASELINE.md` and `HC-PLACE-02-CONTRACT.md`; **HC-PLACE-03/04 are prerequisite for mutations**. Visual PNG sizes are not collision authority.
4. **Building-capability registry** (future): versioned building type, base capabilities, equipment compatibilities, equipment power/water/service requirements, deterministic aggregation and stacking caps, revocation on uninstall, and schema migrations.
5. **Cultivation/resource services**: consume authoritative capacity/efficiency/capabilities. Water, electric power, seed condition, equipment condition and material use must derive from conserved resource ledgers or validated events, not client-calculated bonuses.
6. **Maintenance/equipment** (future): installation and removal commands with receipts, slot uniqueness, condition, service availability, and inactive/unsafe states.
7. **UI**: browse/purchase, building inventory, placement preview (advisory only), placement confirmation, interior furnishing, capability summary with exact source item and reason for inactive effects.
8. **Audit/qualification**: independent end-to-end and hostile-state tests for purchases, ownership races, stale placement revisions, double spending/placing, collisions, unauthorized parcel transfers, equipment duplication, power/water resource deficits, removal/reinstallation and over-cap bonuses. Preserve exact-SHA bounded L1/L2/L3 evidence and testnet-dependent cases on roadmap.

## Explicit non-goals now

No runtime enablement, marketplace contract changes, live BUDS prices, numerical storage/water/power capacities, equipment catalog rewrite, building build timers, blueprint entitlements, roofless interiors or geometry certification are authorized by **this documentation-only approval**.

Implement as a future distinct roadmap suite after reconciling current main, the canonical roadmap, asset manifests and HC-PLACE readiness. Documentation-only adoption must not imply CI qualification or production readiness.
