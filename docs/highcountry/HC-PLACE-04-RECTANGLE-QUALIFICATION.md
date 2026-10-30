# HC-PLACE-04 — canonical rectangular footprint scope

The following **90** assets have an explicit canonical 64px footprint on main and a supported ground/floor layer: HC-ART-02-G premium furniture (12), HC-ART-04-A outdoor structures (12), HC-ART-04-C water/wildlife (12), and source-preserved HC-ART-04-B/D/E/F catalogues (48), plus HC-ART-05-E Red Mesa buildings (6). The reviewed full-rectangle policy deliberately blocks the entire approved footprint, even where an illustration suggests openings. No walkthrough, road connectivity, equipment ability or water-edge exception is implied.

The exported server-only registry is `services/highcountry-economy/src/placement-canonical-rectangles.js`. It binds asset ID, source collection, PNG path, exact approved dimensions and layer/surface to a SHA-256 qualified identifier, provides immutable snapshots/copies and verifies all four rotations. It is wired into existing placement composition via `createCanonicalRectanglePlacementConfig(world)`; the independently configured world authority still has to validate the parcel, independent geometry snapshot and commit. Production HTTP placement routes stay disabled.

`visualPx` and `renderAnchorPx` are nominal *logical grid projection* values needed for the existing placement contract. They are NOT PNG pixel measurements or render anchors, and are never used to authorize physics or change artwork.

## Explicitly ineligible current-main items

- HC-ART-05-E Red Mesa leisure: all six original 5×4 or 6×5 rectangles are included using the canonical `structure` layer. Building interaction is by clicking the building, not an entrance tile. **No doorway mapping or separately surveyed entrance/terrain evidence is required by HC-PLACE-04.** Ordinary owner/parcel permission and collision gates remain part of the existing transaction authority, without inventing building-specific terrain gates.
- HC-ART-03-F regional memorabilia: 12 IDs from `regionalMemorabiliaCatalogue`. Their current source uses UI surfaces `wall` and `furniture`, whereas the transaction contract requires typed `wall_slot` and `tabletop_slot`; attachment geometry and supporting parents belong to HC-PLACE-05/06. **Fix:** qualify the canonical parent/slot contract, convert the attachment catalogue using explicit approved slot evidence, and use `occupancy:{kind:'none'}` without inventing floor rectangles.
- HC-ART-04-B/D/E/F, currently in open PRs #872/#877/#879/#881 (48 additional asset records): not present in approved current-main canonical catalogue modules. **Fix:** merge their independently reviewed asset/catalogue source first, verify all required footprints and PNG paths in that source, then extend this version-pinned registry with explicit approved surface/layer mappings. No synthetic or missing-source geometry is qualified.

The outer rectangular tile mask is deliberately conservative. Production gameplay access and any terrain or fire/water interaction remain deferred to their original authoritative world-validation and later HC-PLACE steps. Existing market and custody operations remain unchanged.

## Exact outstanding asset IDs from unmerged catalogue PRs

### HC-ART-04-B (PR #872)

- `hc-outdoor-feature-fieldstone-fire-pit`
- `hc-outdoor-feature-cast-iron-fire-bowl`
- `hc-outdoor-feature-botanical-chiminea`
- `hc-outdoor-feature-heritage-brick-fireplace`
- `hc-outdoor-feature-campfire-kettle-tripod`
- `hc-outdoor-feature-communal-campfire-circle`
- `hc-outdoor-feature-emerald-driftwood-hearth`
- `hc-outdoor-feature-emerald-cedar-hearth-station`
- `hc-outdoor-feature-prairie-horseshoe-fire-pit`
- `hc-outdoor-feature-prairie-heritage-fire-barrel`
- `hc-outdoor-feature-mesa-adobe-kiva-fireplace`
- `hc-outdoor-feature-mesa-sandstone-fire-circle`

### HC-ART-04-D (PR #877)

- `hc-outdoor-decor-happy-grower-gnome`
- `hc-outdoor-decor-woodland-guardian-owl`
- `hc-outdoor-decor-copper-leaf-wind-spinner`
- `hc-outdoor-decor-riverstone-cairn`
- `hc-outdoor-decor-crooked-garden-signpost`
- `hc-outdoor-decor-enchanted-mushroom-cluster`
- `hc-outdoor-decor-emerald-driftwood-salmon`
- `hc-outdoor-decor-emerald-cedar-wind-chimes`
- `hc-outdoor-decor-prairie-wagon-wheel`
- `hc-outdoor-decor-prairie-rooster-weathervane`
- `hc-outdoor-decor-mesa-terracotta-sun-totem`
- `hc-outdoor-decor-mesa-coyote-silhouette`

### HC-ART-04-E (PR #879)

- `hc-outdoor-landscape-heritage-flagstone-path`
- `hc-outdoor-landscape-rustic-timber-border`
- `hc-outdoor-landscape-river-pebble-mosaic`
- `hc-outdoor-landscape-dry-stack-fieldstone-wall`
- `hc-outdoor-landscape-gravel-timber-walkway`
- `hc-outdoor-landscape-botanical-brick-edging`
- `hc-outdoor-landscape-emerald-moss-slate-path`
- `hc-outdoor-landscape-emerald-driftwood-border`
- `hc-outdoor-landscape-prairie-homestead-brick-path`
- `hc-outdoor-landscape-prairie-railway-timber-border`
- `hc-outdoor-landscape-mesa-terracotta-tile-path`
- `hc-outdoor-landscape-mesa-sandstone-garden-edge`

### HC-ART-04-F (PR #881)

- `hc-outdoor-recreation-heritage-cornhole-game`
- `hc-outdoor-recreation-rustic-horseshoe-pitch`
- `hc-outdoor-recreation-giant-stacking-blocks`
- `hc-outdoor-recreation-botanical-meditation-platform`
- `hc-outdoor-recreation-heritage-croquet-set`
- `hc-outdoor-recreation-garden-chess-table`
- `hc-outdoor-recreation-emerald-cedar-hammock`
- `hc-outdoor-recreation-emerald-driftwood-ring-toss`
- `hc-outdoor-recreation-prairie-homestead-swing`
- `hc-outdoor-recreation-prairie-putting-green`
- `hc-outdoor-recreation-mesa-bocce-court`
- `hc-outdoor-recreation-mesa-desert-daybed`


## Reconciliation update

The four original catalogue source modules from PRs #872, #877, #879 and #881 are now copied **verbatim** into this HC-PLACE-04 integration branch. This does not merge or close their separate PRs or alter marketplace.js. The 48 IDs listed above now have conservative source-derived rectangle masks in the registry (84 total). Prior references to those 48 as missing on this branch describe only the earlier main-only state. Their **world-policy gates remain unqualified**: fire clearance, terrain, path network semantics, and recreation interaction clearances cannot be inferred from a rectangle. Qualification of occupancy is not activation of those behaviors.

HC-ART-05-E has its canonical structural layer and rectangular footprint admitted. Buildings are clickable and have no entrance/terrain-evidence prerequisite in this step. HC-ART-03-F remains blocked by canonical typed attachment/parent slots. No placement authorization for these 18 IDs is granted. The remaining remedy is versioned approved parent-slot geometry for memorabilia under HC-PLACE-05/06; no pixel reconstruction or silent layer substitution is permitted.
