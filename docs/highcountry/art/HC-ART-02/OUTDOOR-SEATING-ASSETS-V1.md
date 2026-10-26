# HC-ART-02-C — Outdoor Seating & Patio Furniture (v1)

Status: uploaded sprite paths verified on main; registry, marketplace art browsing and scoped tests in unmerged PR #839. No server SKU, authorized BUDS retail listing, resale or settlement implemented.

All 12 canonical PNGs are in `apps/highcountry-web/public/assets/cultivation/props/comfort-furniture/outdoor-seating/universal/`. Browser src prefix: `/assets/cultivation/props/comfort-furniture/outdoor-seating/universal/`. Definitions: `apps/highcountry-web/src/outdoor-seating-catalog.js`.

| Design | Logical ground footprint |
| --- | --- |
| Adirondack chair | 1×1 |
| Patio lounge chair | 1×1 |
| Chaise lounge | 2×1 |
| Patio loveseat | 2×1 |
| Outdoor sofa | 3×1 |
| Sectional sofa | 3×2 |
| Patio dining chair | 1×1 |
| Patio dining table with umbrella | 2×2 |
| Picnic table | 3×1 |
| Fire pit with chairs | 2×2 |
| Porch swing | 2×2 |
| Hammock with stand | 3×2 |

Logical tile is 64 px, independent of the 1024×1024 source art canvas. All items currently have bottom-center sprite anchors and tile occupancy classification. Fire pit requires heat clearance evaluation, porch swing and hammock require swing clearance evaluation; these metadata warnings do not constitute collision enforcement.

The master sheet for C differs from the earlier proposed 12-item outdoor leisure list; these records reproduce the *approved C visual master sheet*. Umbrella is currently illustrated as part of dining table; fire-pit chairs are bundled in one graphic. A subsequent art revision may split furnishings into independently placeable parts, but should not silently invent distinct marketplace SKUs or duplicate inventories.

Item prices, owner-verified furniture instances, wear/repair history, resale, comfort bonuses, and entitlement remain subject to authoritative economy implementation and qualification. Art browsing never issues BUDS or inventories.
