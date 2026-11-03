# HC-WORLD — Port Alder Old Town neighbourhood screen implementation roadmap V1.0
**Design approval source:** owner decisions through 2026-10-29. **Status:** approved requirements; runtime implementation not implied.
**Parent roadmap:** `docs/highcountry/HC-WORLD-LOCKED-MASTER-ROADMAP-V1.md`. This is a scoped implementation/dependency plan for HC-WORLD-06/08/09/13/25, **not** a replacement for their numbered sequence. Preserve other HC-WORLD work and evidence.
**District:** HC-EC-S01-D07 (Port Alder → Old Town). **Repository truth wins** for claims that code or integration already exists.

## Binding decisions and scope
1. Author the map from the **fixed 2:1 isometric tile coordinate model**, nominal ground tile 64×32 px, with independent coordinate-based layers. Do not generate a new town painting to replace placement or infer new roads from decorative images. Use 32×32 world-tile chunks as the Old Town renderer proposal; reconcile with the master HC-WORLD-08 16×16 logical streaming-chunk rule by nesting rendering chunks inside logical chunks or versioning an explicitly approved migration; do not silently override shared navigation contracts.
2. Preserve the existing Phase C 54 private title records (30 residential, 24 commercial/industrial), **five permanent public heritage sites**, B22 as non-saleable public parkland, and the 20 Genesis sites (4 HL + 6 CR + 5 WH + 5 LM). **HL-05 is a sellable design, not a prebuilt Genesis building**. Vacant lots remain empty.
3. Existing site IDs, assigned blocks and original corner placements remain fixed; no independent art-directed movement. If a survey/road geometry mismatch appears, report as a blocked authority decision rather than silently moving land or buildings. Explicitly retain harbourside LM-03 Old Cannery, LM-04 Sail Loft in B25 (public heritage), separate HL-03 Maple Bungalow and LM-05 St. Brigid's Chapel in B04, and WH-01/02/03/05 in four corners of B24, WH-04 in B20.
4. Load **current canonical GitHub files** via asset manifest; do not use cached or AI-generated replacements. Preserve byte hashes and aspect ratio. The five user-updated LM PNGs supersede earlier local versions once GitHub blob/hash matches. Transparent PNGs stay individual interactive scene layers; do **not** zoom a flattened low-resolution composite.
5. Adopt the **simplified building-use footprints** (distinct from title lots): HL-01–04 ground **11×14 tiles**, CR-01–06 **17×17**, WH-01–05 **22×22**, LM-01 **34×34**, LM-02 **45×45**, LM-03 **34×34**, LM-04 **34×34**, LM-05 **22×34**. These are explicit game-design occupied footprints, not measured pixel-foundation polygons. Preserve the actual private title lot sizes (HL 16×20, CR 24×24, WH 32×32) and independent lot identity. Interior and basement usable grids equal the **exact occupied building footprint** for residential and commercial storefront buildings. WH-01–05 are **single-storey, no basement**. Heritage interiors use their public-scene requirements and never silently become private grow rooms. Resolve conflicting inherited generic interior rules explicitly by this approved Old Town-specific exception; elsewhere the master roadmap retains authority.
6. **Interaction contract:** click/tap the **whole visible building sprite** or keyboard-select its semantic target → LM sites open their actual public information/service/quest screen; private HL/CR/WH buildings open the selected property lot scene subject to canonical authorization. Where a player owns contiguous titles, offer a joined **visual** lot view without transferring/merging/subdividing titles. No physical door-pixel survey, sidewalk-to-door geometry, or freight route is required **to navigate/open the screen**. Physical freight/service simulations, if introduced separately, remain owned by their relevant gameplay workstreams and must not gate this map.
7. On an eligible owned lot, allow in-lot re-placement of the attached building if its full occupied rectangle stays inside that lot and doesn't overlap an occupied structure; no required walkway alignment. Save atomically with validated ownership, occupied land, independent title and fixture state; handle unauthorized, stale, duplicate, out-of-bounds and conflicting changes. No building movement between titles; don't let movement circumvent permanent-fixture or title rules.
8. Camera supports pointer drag, touch pan, keyboard pan, optional edge pan, wheel/pinch zoom, fit-to-district and a minimap with accurate transforms. Zoom should source original PNG raster dimensions and use appropriate LOD, not scale a tiny global snapshot. Buildings remain selectable even if partially occluded; nearer sprites paint over farther sprites by ground-depth draw order. Ordinary foreground/background alpha overlap is **permitted**, not a CI failure. Test incorrect order, invisible/hard-to-click occluded sites, clipping and input stability.
9. Protect sensitive/hidden O16 discoveries and unclaimed coordinates from public delivery. Neighbourhood adjacency/district exits must bind existing canonical HC-WORLD-06 route contracts; no invented links. Do not claim title-issuance or real-world surveyed approval from a visually passing renderer.
10. Preserve passing SHA/workflow evidence; during iterative changes run only affected qualifications. No indiscriminate full-matrix reruns. Final exact-SHA/reconciliation only where parent roadmap qualification actually requires it.

## Implementation sequence — exact deliverables and exit gates

### OT-SCREEN-00 — Baseline reconciliation and manifest lock (L1)
- Read the main branch HC-WORLD roadmap, HC-WORLD-06 district navigation contract, current app routes, Phase C lot register, Phase D site placements, current external PNG SHA/blob IDs, and local review artifacts. Identify actual repo paths and absent files; archive approval decisions as data, not as inferred code deployment.
- Produce committed: `old-town-geo-authority-status.json` (approved vs **provisional** layer flags), `old-town-genesis-assets.json` (20 paths and verified SHA-256 + Git blob SHA), `old-town-site-registry.json` (59 private/public sites and B22) and a requirement-to-evidence table.
- Gates: exactly 20 Genesis sprites, 54 private titles, five public landmarks, distinct B22, no HL-05 spawn, approved fixed block assignments. Fail on missing/altered asset hashes, duplicates, false authority flags. Do not advance sprites onto an invented map.

### OT-SCREEN-01 — Deterministic isometric map engine integration (L2)
- Put coordinate projection, vector road/parcel/public-space layers, stable depth ordering and precise sprite-ground anchors into the existing HighCountry browser app. Render only canonical images fetched from project assets. No image-generation step.
- Integrate tile streaming/visible-region culling (honour parent 16×16 logical chunk contract), viewport resizing, high-DPI and scale-preserving source images.
- Gates: repeatable coordinate→pixel mapping, no parcel movements or fabricated buildings, correct source image hash/alpha, no clipping, same results across reload/zoom/DPR; compare exact pixel placements and overlays for high-DPI and full-world views.

### OT-SCREEN-02 — Navigable viewport and district links (L2)
- Implement drag/touch/keyboard/edge pan, mouse-centred wheel/pinch zoom, minimap and bounds; clickable building selection using alpha-aware target or stable accessible hit region; keyboard access and close/back behaviour.
- Bind Port Alder → Old Town, Old Town ↔ existing allowed adjacent district routes, and return navigation. Do not invent external destinations.
- Gates: scoped browser tests for drag, zoom stability, scroll limits, large map, occluded-selectable buildings, 20 distinct targets, district navigation and narrow/mobile layout.

### OT-SCREEN-03 — Building destination routing, ownership and joined titles (L2)
- LM-01–05 navigate to public function/quest/information screens (hotel visitor info, Founders notice/events/history, Cannery heritage/archive/restoration, Sail Loft maritime history/commissions/equipment information, Chapel history/restoration). Preserve the Sail Loft as public heritage, never a commercial property.
- HL/CR/WH navigate to property view. Ownership and privacy checks run through existing registry/authorization endpoints, not client-side control; for contiguous same-owner properties offer combined rendering while retaining separate IDs, permissions, payments and title transfers. Preview for non-owners must follow existing privacy policy.
- Gates: all 20 sites resolve to correct destination, unauthorized reads rejected, no hidden O16 leaks, no adjacency spoofing or title merge, back-navigation consistent. **Door and sidewalk geometry must not gate navigation.**

### OT-SCREEN-04 — Lot scene, building relocation and equal-area interiors (L2)
- Implement the approved lot and occupied footprint pairs: houses 16×20 title / 11×14 building; storefronts 24×24 / 17×17; warehouses 32×32 / 22×22; public heritage as specified above.
- Exact usable interior grid matches the occupied footprint. Houses and storefronts get one matching basement grow room; warehouses have one ground floor and no basement. Basement grows must still enforce existing cultivation admission, equipment and economic capacities (no new arbitrary capacity from sheer floor tiles).
- Authorized drag/reposition within lot with no sidewalks/door edges. Validate bounds, overlap, owner, expected state/version, persistence, duplicate/replay and independent property rights.
- Gates: actual runtime tests for interior dimensions and basement entitlement, wrong building type/owner, zero additional warehouse floor, moving to corners, stale writes, equipment/persistence, adjacent joined scene without title fusion.

### OT-SCREEN-05 — Environment and performance polish (L2)
- Layer streets, trees, terrain, shore/docks and decorative art **only against existing polygons**, never art-directing new geometry. Preserve B22 park and the harbourside landmark positions.
- Test pan/zoom with full-resolution current assets, click targets under normal visual occlusion, LOD/chunk memory, long scrolling, alt input modes and camera return coordinates. Asset loading fallbacks must retain clickable site identity.
- Gates: no invented Genesis buildings, no distorted canonical sprite, no scenery changing parcels, performance budget recorded with measured numbers rather than invented claims.

### OT-SCREEN-06 — Exact-SHA scoped qualification and merge (L2)
- Requirements-to-evidence reconciliation including changed file paths, SHA-256s, Git blobs, canonical site IDs, approved exceptions and unresolved survey authority notes.
- Run only affected Level 1/2 jobs; preserve passing earlier evidence on original SHAs. Reconcile against latest main, merge only with actual passing checks and no unauthorized layout drift.
- After merge, mark Old Town screen *functional* separately from issuance/survey authority; issue real land/title inventory only after independently authorized world-release qualification.

## Explicit deferred/non-blocking work
- **No door-pixel coordinates, doorway-to-sidewalk tracing, lot-to-road access checks or freight truck maneuvers as a prerequisite for opening a clicked building.** Earlier D.2 review files are historical inspection evidence, not screen acceptance gates.
- Road, coastline and easement layers inherited from ISO-02/02B carry `provisional` authority metadata until approved as a fictional canonical world survey; visual functionality and title issuance are different milestones. Never falsely assert survey approval or mutate approved sites to silence warnings.
- Dynamic settlement 50%/75% sale-stage art and estate office thresholds belong to HC-WORLD-REALTY-01, with separate versioned interfaces; do not hardwire them into Old Town page initialization.
- Additional heritage quest narratives/rewards must integrate with existing HighCountry quest/discovery ledgers in HC-WORLD-25/HC-NEXT, not create shadow entitlements.
- No exterior sprite recreation from generated town pictures. Layered environmental assets can be separately authored, but map geometry always wins.

## Success criterion
A player opens Old Town, pans and zooms a correctly measured isometric map, sees **only approved Genesis structures at the existing sites** and empty unbuilt lots, clicks any structure to open its appropriate destination, and can move an authorized building inside its own lot and use its correctly sized floors. The authoritative title/issuance protections remain intact. This plan's approval alone is **not** implementation or CI evidence.
