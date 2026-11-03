# HC-ART-05-B — Workshop Abilities & Benefits Contract v1.0

Status: **DESIGN LOCKED; IMPLEMENTATION DEFERRED**. Owner-approved gameplay definitions, 2026-10-27. Not a claim of deployed features, certified asset geometry or passing runtime qualifications.

## Governing model

This contract extends `docs/highcountry/HC-ART-05-BUILDING-ECONOMY-ABILITIES-CONTRACT-V1.md`. Buildings are purchased outright for BUDS, recorded as owned inventory, placed instantly *after authenticated authoritative geometry/parcel validation*, furnished, and enhanced through compatible installed equipment. No build timers or construction entitlement at launch; future construction/blueprint systems are separately deferred.

The building type provides a defined basic workspace identity. Advanced production, recipes, utility flows and numeric efficiency benefits are **not** granted by exterior art or building possession. Equipment requirements, recipe catalogs, capacities, balancing and implementing services are separate workstreams.

## Canonical abilities for all eighteen workshop exteriors

| No. | Region | Structure | Primary ability | Secondary benefit |
| --- | --- | --- | --- | --- |
| 01 | universal | Heritage Woodworking Shop | Woodworking, carpentry and timber-product production | Reduced material waste and improved woodworking efficiency |
| 02 | universal | Village Blacksmith Forge | Metal forging, traditional tools and hardware production | Improved durability and repairability of eligible metal equipment |
| 03 | universal | Botanical Drying House | Controlled botanical drying and curing operations | Improved preservation and reduced processing losses |
| 04 | universal | Rural Repair Workshop | Mechanical repair and equipment servicing | Reduced equipment downtime and restoration of eligible equipment condition |
| 05 | universal | Artisan Textile Studio | Fabric, textile and decorative furnishing production | Improved material utilization and access to specialized textile designs |
| 06 | universal | Botanical Craft Laboratory | Botanical formulation, preparation and artisan product crafting | Improved batch consistency and reduced eligible processing waste |
| 07 | emerald-coast | Coastal Boatwright Workshop | Construction, restoration and maintenance of eligible boats and marine equipment | Improved marine-equipment serviceability and reduced restoration waste |
| 08 | emerald-coast | Driftwood Carving Studio | Woodcarving, decorative sculpture and driftwood craft production | Greater utilization of reclaimed timber and eligible salvaged materials |
| 09 | emerald-coast | Coastal Glassworks | Glassmaking and production of glass containers, fixtures and decorative objects | Improved recycling and reuse of eligible glass materials |
| 10 | emerald-coast | Woodland Dye & Fiber Workshop | Natural dyeing, fibre preparation and textile finishing | Improved dye-material utilization and access to regional finishes |
| 11 | golden-prairie | Prairie Harvest Supply Barn | Agricultural supply preparation, sorting, packaging and bulk-material handling | Reduced handling losses and improved supply staging |
| 12 | golden-prairie | Prairie Propagation Workshop | Seedling propagation, cutting preparation and plant-establishment operations | Reduced propagation losses and improved preparation efficiency |
| 13 | golden-prairie | Prairie Machinery Service Barn | Agricultural machinery servicing, maintenance and qualifying repairs | Reduced machinery downtime and improved maintenance efficiency |
| 14 | golden-prairie | Prairie Renewable Utility Workshop | Renewable-power equipment servicing, utility integration and power-management operations | Improved utilization of qualifying generated power and equipment reliability |
| 15 | red-mesa | Mesa Blacksmith Forge | Desert-region metal forging, hardware crafting and tool restoration | Improved reuse and recovery of eligible metal materials |
| 16 | red-mesa | Mesa Pottery & Kiln House | Pottery, ceramic-container production and kiln firing | Reduced firing losses and improved ceramic-product consistency |
| 17 | red-mesa | Red Mesa Stonecarver's Yard | Stone cutting, carving and architectural stonework | Improved stone-material utilization and reclaimed-stone reuse |
| 18 | red-mesa | Desert Botanical Processing House | Desert botanical preparation, drying and artisan processing | Improved preservation and reduced processing losses under modeled dry-climate conditions |

These names are authoritative for this workshop collection, including the finalized replacement names for Golden Prairie 11–14 and Mesa Blacksmith Forge at 15.

## Mechanical interpretation and gating

- **Primary** means the building supports that workflow if the necessary authorized stations, recipes, inventory, permissions and resources exist. At purchase the owner gets the basic building/workspace, not free production.
- **Secondary** means an eligible targeted effect governed by a versioned capability registry, verified installed equipment, active resource connections, configured recipe effects, condition, region/environment as relevant, and bounded limits. No numeric amount, blanket benefit or stack multiplier is implied here.
- No extra source material, electricity, water, biomass, finished inventory, BUDS or other economic value can be invented by a bonus. All inputs/outputs go through authoritative conserved inventory/resource accounting and work-order receipts.
- Same-function facilities across regions must retain fair access to core gameplay. Regional specialization may influence eligible operations, not create unavoidable geographic dominance or proprietary genetics advantages.
- Duplicate installations cannot multiply effects beyond policy caps. Removal, damage, power loss, expired permits or bad equipment state deactivates dependent capabilities. Purchases, placement, equipment and processing must be idempotent, concurrency-safe and auditable.
- Existing HC-PLACE dependency: records/geometries/room occupancy are not authority for server mutation until HC-PLACE-03/04 and relevant service integration qualify. Client-only placement previews never activate bonuses.

## Future separately scoped work

Versioned building/workshop registry; equipment slots and compatibility; furniture/equipment asset catalogs; production recipes and resource inputs/outputs; maintenance and energy/water dependencies; capability aggregator and deterministic conflicts/caps; storage and custody reconciliation; UI and audit; authenticated economic/placement integration; adversarial and exact-SHA bounded qualification. Do not implement those in this exterior-art documentation change.

## Art-workflow boundary

Complete exterior master sheets, transparent individual PNGs, manifests, hashes and GitHub uploads for each 18-structure collection first. After all art is uploaded, review and lock *that* collection's abilities; equipment design and runtime integration follow in separate workstreams. HC-ART-05-B exteriors are art deliverables, not automatically qualified geometry or implemented production mechanics.

## Acceptance and deferral

This document establishes identities and conceptual mechanical behavior only. No arbitrary numerical buff values, blueprint/construction timer, immediate workshop production entitlement, equipment design changes or production runtime modifications are approved by this PR. Full integration and testnet-dependent items must be scheduled and independently qualified later.
