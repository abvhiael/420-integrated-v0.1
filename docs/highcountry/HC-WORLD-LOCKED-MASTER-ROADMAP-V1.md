# HC-WORLD — LOCKED FOUNDING WORLD MASTER ROADMAP V1.0
**Decision date:** 2026-10-26  
**Status:** APPROVED DESIGN BASELINE; implementation/qualification NOT implied.  
**Change control:** This document is authoritative for HC-WORLD design decisions. Never silently change numeric policies, scope, step sequence, or names. Any departure requires explicit user approval, versioned amendment and migration/impact note. Repository implementation truth still controls claims of what works.

## A. World shape and capacity
- Founding regions: **Emerald Coast, Golden Prairie, Red Mesa**; a unified navigable county/district/town/property geography with real parcel identity and separately loaded property/interior scenes.
- Each region: **10,000 residential titles** = **8,300 rural + 1,700 urban**; **420 commercial titles additional**. World totals: 30,000 residential + 1,260 commercial = 31,260 purchasable titles. These are planned capacities, not minted Genesis issuance.
- Regional surface allocation (mutually exclusive land area): **65% purchasable** (private rural + urban residential + commercial), **10% community/public growing**, **10% cooperative/leased/shared growing**, **10% town/civic land** (public roads, sidewalks, squares, museums etc, excluding private urban lots), **5% 420Corp reserves**. 420Corp offices and holdings are titled and accounted for; no double-counting.
- Property sizes: **Homestead 48×48 (2,304 tiles), Smallholding 80×80 (6,400), Estate 144×144 (20,736), Ranch 256×256 (65,536)**. Region/county map can display whole geography; visiting a property loads own instance. No parcel splitting for resale or otherwise. Adjacent owned urban lots may be rendered as a continuous space but always retain independent titles and transfer rules.
- Rural class mix for 8,300 per region and actual map land budgets still to reconcile. Urban lot dimensions, commercial dimensions, county bounding boxes and population allocations beyond fixed title counts remain scoped design tasks.

## B. Municipal capacity and heritage
Each region: **one capital (500 homes/100 businesses), two towns (200 homes/50 businesses each), four villages (100 homes/25 businesses each), eight hamlets (50 homes/15 businesses each)**. Totals **15 settlements, 1,700 homes, 420 businesses per region**. These are firm maximum title inventories, not unique illustrated facades.
- Candidate classifications: Emerald Coast: capital **Port Alder**, towns **Moss Landing, Greyhaven**, smaller known anchors **Cedar Hollow, Bracken Falls**; Golden Prairie: capital **Harvest Junction**, towns **Stonebridge, Prairie Crossing**, smaller anchors **Dry Gulch, Willow Creek**; Red Mesa: capital **Cinder Springs**, towns **Copper Ridge, Solstice Wells**, smaller anchor **Dusthaven**. Complete the remaining villages/hamlets with geography and biographies in region-mapping steps; do not invent approved histories prematurely.
- Preserve all Original Sixteen archival settlement origins and heritage sites as permanent county landmarks with canonical links to museum, discovery, quests and collectibles.
- Every settlement: **420Corp co-op access, district real estate interface, limited commercial inventory, civic/shared areas**, modular region-character architecture and streetscapes.
- Production order: **county maps -> town/local layouts -> rural/urban neighbourhoods -> property scenes -> buildings and interiors**.

## C. Navigation, streets, buildings, interiors
- **16×16 logical chunks**, seamless tiled terrain, streamed visible chunks, camera pan via mouse and keyboard, zoom in/out, minimap, stable world/property/district coordinates, persistent placement; test very large ranches/high decoration counts.
- Property outdoor maps use region/zone-specific background assets. Exterior building sprites on separate live layers; street views paint the purchased building shells and authorized player exterior decorations onto reusable layered roads/block backgrounds. Unlocked door leads to instance, gated by public/private access.
- Universal buildings + three region-exclusive architectural catalogues. For each: exterior sprite, conceptually decorated/full interior art reference, empty gameplay background, placement metadata and collision/door/stair anchors.
- Canonical proposed footprint -> buildable interior:
  - starter shack **6×6 -> 16×16 living plus 16×16 basement**;
  - cottage **8×8 -> 20×20 main + 20×20 basement**;
  - standard house **10×10 -> 24×24 main + 24×24 basement**;
  - greenhouse **6×8 -> 24×32**;
  - barn/workshop **10×12 -> 32×32**;
  - co-op **variable -> 32×32/modular**;
  - store **variable -> 16×24 or 24×32**.
- Starter shack affordable. House basement is indoor grow space, same dimensions as main floor, reciprocal marked stairs. House interiors may be public/private; decorative and functional interiors distinct. Interior map expansion does **not** independently increase canonical plant/equipment/utility capacity; controls and approved gameplay rules apply.
- Building is a **permanent fixture** attached to parcel and included on land resale. Upgrading demolishes existing building, **refund 25% of original building purchase cost** in original purchase currency, no double refund, relocates eligible decorations/equipment to protected inventory, requires safe resolution of active plants/production. Region-exclusive buildings typically cosmetic parity, no unauthorized advantages.
- Town homes include house and small yard; adjacent separately titled urban parcels can expand apparent yard for approved outdoors growing/small greenhouse under local zoning.

## D. Land rights, offices, sale and ownership
- Canonical ledger distinguishes parcel/title ID and region/district, zoning, immutable footprint, owner, lease/occupancy rights, building fixtures and attached interiors, movable item owners, plant admission/capacity, assessments, encumbrances, access privacy and lifecycle states.
- No title subdivision. Real estate offices have district-limited inventory, location/price/neighbourhood maps, property preview visits, primary sale, buyer-funded owner resale, full attached-building disclosures, included/excluded movable goods, rights/leases, authorized payment/transfer and recoverable failures. Distinct real-property title vs occupant lease permissions.
- **Maximum 10 owned properties per player per region, all rural + urban + commercial combined**; multi-wallet/identity controls and separately authorized co-op ownership. First five not subject to multi-property surcharge. The cap is distinct from lease access.
- Business identities may link via **420Identity** and later approved **420Hz** merchant artwork/music/product catalogue displays; ownership, rights, payments and settlement remain enforced in canonical systems. Store decoration may contribute bounded vibes/happiness only, no unauthorized economic modifiers.

## E. Tax, delinquencies, forfeiture, resale
- **90-day full-season assessment**, **4.2% assessed value surcharge** applied to the **N-5 highest-valued titles** owned in the region (N=6..10), highest first. Other five exempt from *this surcharge*. Land basis initially original issued land value, improvement values include eligible permanent buildings; asking price is not assessed value. Exact multi-currency valuation method needs approved schedule, not implicit parity.
- Each taxable parcel has an **independent tax debt**, timestamp, snapshot, payments, appeals and enforcement. Partial payments allocated explicitly to selected parcel, not across debts. Taxes go to **regional treasury**.
- Unpaid tax (from due time): **day 30 asset lock**, **day 60 property use lock**, **day 90 forfeiture eligibility**. Safe handling of active workflows; notices and evidence; qualified appeal, verified outage or payment failure halts irreversible escalation; no admin bypass of deadlines; debt settlement clears debt-based lock when permitted.
- On completed forfeiture: title enters **420Corp regional custody**; permanently attached structures stay with the parcel; personally owned movable decorative assets/equipment into protected recoverable vault; active crops/workflows resolved deterministically. No blanket seizure of personal equipment. Audit and appeals mandatory.
- **Starting forfeiture resale price = 66% of ORIGINAL LAND VALUE + 100% of ASSESSED VALUE OF PERMANENT BUILDINGS LEFT ON THE PROPERTY.** Land discount applies only to land, not buildings; implement explicit per-currency approved valuations for BUDS/$420. Real estate office handles listing/preview/eligibility/atomic title transfer.
- **$420 primary and forfeiture land sale proceeds: 10% developers compensation fund, 90% HighCountry community fund.** **BUDS land purchases: no developer $420 compensation fee**. **BUDS forfeiture resale payment: 100% burned** from circulation (not deposited to treasury). Normal player-to-player resale is NOT automatically a burn/same distribution; specify applicable sale fees explicitly before implementation.
- BUDS has **no lifetime issuance ceiling**, but grants must derive from authenticated authorized activities; all mint/burn and ledger conservation/replay protections apply. Taxes are deposited in regional treasury (not automatically burned). Community fund may finance artists, asset packs, staff, operations with governed spending and audit, authority separate from ordinary player voting.

## F. Co-ops, community growing, rentals
- Each settlement gets a cheap-rent **420Corp co-op**. Community plots and co-op leases enable landless players. Public allotment sizes proposed 8×8/12×12/16×16; title is not a new private sale lot.
- Standard lease = **one 30-day grow cycle**; authorized automatic renewal when payment succeeds. Turning future auto-renew off is free and doesn't cancel the current paid term.
- Early termination/refund: **50% rent return if within first 14 days of paid term** when eligible; **0% after day 14 through day 30**; no duplicate refunds, and prevent refund exploitation after irreversible cultivation entitlement consumption. Exact day-14 boundary is inclusive.
- At unpaid expiry grace begins: **14 days overdue asset freeze**, **30 days overdue verified co-op reclaim** of plot and eligible abandoned harvest. Personal equipment/decorations never automatically become co-op property; use recoverable protected inventory. Enforce notices, opportunity to cure, audit, appeals, outage/payment failure suspension, owner/tenant roles and atomic state changes. Lease reclaim is **not** the separate 90-day property-tax forfeiture regime.

## G. 28-step roadmap; no drift
### Phase I: World foundations and county maps
1. **HC-WORLD-01 Founding world specification** — regional geography, coordinate system, town hierarchy, land budgets, districts, Original Sixteen landmarks; L1.
2. **HC-WORLD-02 Regional land inventory** — 8,300/1,700/420 counts each region, zoning, 65/35 budgets, immutable nonoverlapping footprints; L1.
3. **HC-WORLD-03 Emerald Coast county map** — Port Alder/Moss Landing/Greyhaven, villages/hamlets, hydrology/roads, reserves/heritage; L2.
4. **HC-WORLD-04 Golden Prairie county map** — Harvest Junction/Stonebridge/Prairie Crossing, prairie/rail/country districts; L2.
5. **HC-WORLD-05 Red Mesa county map** — Cinder Springs/Copper Ridge/Solstice Wells, desert/canyon districts; L2.
### Phase II: Towns, neighbourhoods, navigation
6. **HC-WORLD-06 Town maps and municipal layout** — civic/downtown/residential/commercial/420Corp zones, municipality counts; L2.
7. **HC-WORLD-07 Rural neighbourhoods** — districts, community identity, roads, parcels, adjacency/addresses; L2.
8. **HC-WORLD-08 Chunked navigation engine** — terrain, mouse/keyboard, zoom, streaming, minimaps, persistence; L2.
9. **HC-WORLD-09 Active streetscapes** — live layered street/property facades, entrances and ownership; L2.
### Phase III: Properties, buildings, interiors
10. **HC-WORLD-10 Property classes and outdoor terrain** — 48/80/144/256 maps and regional empty backgrounds; L2.
11. **HC-WORLD-11 Universal building catalogue** — all global shells/interiors and sizes; artwork metadata L1 and integration L2.
12. **HC-WORLD-12 Regional architectural collections** — region-exclusive structures and scenes; L2.
13. **HC-WORLD-13 Interior scene system** — reciprocal stairs, basement growing, function/decor, privacy, persistence; L2.
14. **HC-WORLD-14 Permanent improvements and demolition** — fixture attachment, 25% salvage, protected goods and resale; L2.
### Phase IV: Ownership and property economy
15. **HC-WORLD-15 Land registry and anti-subdivision** — authoritative title, joined views, cap, leases and rights; L2.
16. **HC-WORLD-16 District real estate offices** — inventory, visits, purchases, resale, offers, disclosures; L2.
17. **HC-WORLD-17 Property valuation and taxation** — largest-first 4.2%, 90-day cycle, separate parcel debts/treasuries; L2.
18. **HC-WORLD-18 Delinquency and forfeiture** — day 30/60/90, audit, appeals and protected vault; L2.
19. **HC-WORLD-19 Repossessed real estate marketplace** — 0.66 land+full building, BUDS/$420 accounting, burns/splits; L2.
20. **HC-WORLD-20 Community and regional treasuries** — 10/90 $420, BUDS burn, tax flow, spend controls; L2.
### Phase V: Co-ops, business, social economy
21. **HC-WORLD-21 Community growing areas** — fair allotments and admission/capacity; L2.
22. **HC-WORLD-22 Cooperatives and rental contracts** — all-town facilities, 30-day rent, refund, overdue 14/30-day recovery; L2.
23. **HC-WORLD-23 Town commerce and storefronts** — finite shop stock, decorated modular streets, public/private interior; L2.
24. **HC-WORLD-24 420Identity / 420Hz integration** — merchant binding and approved rights/cross-app purchase paths; L2.
25. **HC-WORLD-25 Public spaces and heritage integration** — parks, halls, museums, Original Sixteen discovery and quests; L2.
### Phase VI: Reconcile and qualify
26. **HC-WORLD-26 World and economy reconciliation** — district/title/asset/tax/treasury/heritage exact manifest and SHAs; L3.
27. **HC-WORLD-27 Performance and adversarial qualification** — ranch-scale streaming, crowds, race conditions, appeals, leases, land forfeiture; L3.
28. **HC-WORLD-28 Genesis release and expansion readiness** — approved release manifests, runtime, authority, documentation, explicitly controlled expansion; L3.

## H. Execution and protection against roadmap drift
- Implement **in numbered order**, with bounded prerequisites only. Do not skip phases or relabel unfinished work as complete.
- Use existing HighCountry LandRegistry, cultivation capacity/plant bindings, leases/rights, inventory, BUDS/economy, marketplace, organizations/co-ops, identity as canonical owners; avoid parallel shadow authority.
- For each step document exact scope, files, tests, Level 1/2/3 qualification, commit SHAs, known limitations, and merged PR before closing it. Retain unrelated passing evidence; no unnecessary repo-wide CI reruns.
- New maps/art are not proof that contracts or live deployment are qualified. Actual authorized Genesis land issuance requires a finalized approved land manifest and proofs.
- Open design decisions for their named steps: rural class allocation among 8,300, lot footprints within municipalities, pricing/valuation by currency, tax impacts of mid-season sale, forfeiture inventory recovery timeframe, mixed-currency improvement appraisal, remaining settlement names/biographies and legal/operational payment guardrails.
- Any change to a locked rule requires **HC-WORLD-CHANGE-XXX**, explicit owner approval, updated version, affected-step impact list and separate scoped tests. No silent amendments.

**Next authorized work:** HC-WORLD-01 geographic and settlement specification, starting with Emerald Coast. This file is a roadmap lock, not implementation acceptance.


## I. Approved scoped amendment — Port Alder Old Town neighbourhood screen (2026-10-29)
**Change:** HC-WORLD-CHANGE-OLDTOWN-ISO-01; owner-approved design decisions, implementation **not** implied. This is an explicit Old Town-specific exception and staged work mapping under existing numbered HC-WORLD-06/08/09/13/25; it does **not** reorder or renumber the locked 28-step programme.

**Detailed execution/acceptance plan:** [HC-WORLD-OLD-TOWN-NEIGHBOURHOOD-SCREEN-ROADMAP-V1.md](./HC-WORLD-OLD-TOWN-NEIGHBOURHOOD-SCREEN-ROADMAP-V1.md).

- HC-WORLD-06/08/09: deterministic 2:1, 64×32 px nominal isometric tiles; fixed surveyed coordinates, separately zoomed canonical PNG sprites, pan/zoom/minimap, no flattened low-resolution bitmap as a zoom source. Honour HC-WORLD-08 16×16 logical chunks; any 32×32 renderer chunks are nested or need separately approved versioning.
- **Navigation exception** to prior C-section door/entrance wording for Old Town: **click the whole building** → public landmark screen (LM-01..05) or authorized lot view (HL/CR/WH), with optional contiguous same-owner joined view preserving independent titles. No door-pixel markers, walkways, public-road connections or freight maneuvers required to *open a screen*; they may remain separate gameplay/simulation concerns.
- **Occupied footprints vs title footprint**: residential building 11×14 within 16×20 lot; storefront building 17×17 within 24×24 lot; warehouse building 22×22 within 32×32 lot. Basements exist only for residential and commercial storefronts and equal the same occupied-area tile dimensions; warehouses are **one floor, no basement**. This Old Town-specific rule supersedes conflicting generic per-building interior *dimension* proposals for these exact Genesis buildings, but does not lift cultivation limits/capacity admission or permanent-fixture land rules.
- Owner-authorized building reposition inside its own title requires bounds, collision and state/rights checks, but not door/sidewalk alignment; preserve immutable title and existing property attachment/ownership rules. No movement between titles.
- Preserve 54 Old Town private titles, five permanent public landmarks, B22 park, 20 prebuilt Genesis structures only, HL-05 not prebuilt, all previously approved assigned block placements. LM-03 stays harbourside; LM-04 Sail Loft is permanently public heritage; LM-05 Chapel and HL-03 Maple Bungalow are distinct.
- Existing Coastline/road model remains provisionally authoritative **only for visual planning**, not for Genesis title issuance until separately approved. The Old Town screen may be developed and tested against flagged provisional geography without falsely upgrading title/survey certification.
- Execution substeps OT-SCREEN-00..06, Level 1/2 checks, exact-SHA reconciliation and merge are defined in the linked roadmap; preserve other workstreams and passing CI evidence. No unnecessary full CI reruns.

**Impact note:** Updates the Old Town portions of steps HC-WORLD-06, -08, -09, -13, -25. Replaces the previous Old Town doorway qualification gate and inherited mismatched floor dimensions, without altering rural land policy, world tile-ownership authority, economy, title issuance or other settlements. Future changes require a separately versioned owner-approved change.
