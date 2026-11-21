# CCC-ART-5 — Canadian roadside scenery vignettes

**Scope:** illustrated, decorative regional scenery in Cross-Country Chaos, with the approved vintage Canadian road-atlas treatment. The authoritative cards, hazards, mileages, championship scoring, live 960 × 415 route, named map stops, 2–4 moving vehicle pieces, card-table gameplay, and player privacy are **unchanged**.

## Original artwork in the finished board

Eight **original hand-authored SVG vector vignettes** are created directly in `bong-goggles/web/core/chaos-region-scenery.js`, in the same 960 × 415 atlas coordinates as the three approved 1920 × 830 image layers. They are painted in muted sea greens, ochres, misty blue-greys, cream, cedar, rust and aged gold, with warm shadows and hand-lettered, dark-outlined names. Each is an original stylized interpretation—not a reproduction of real official highway signage, monument artwork or commercial imagery.

| Region | Feature | Visual detail | Decorative anchor (SVG) |
| --- | --- | --- | --- |
| East | Atlantic ferry | Two-deck coastal ferry, cabin portholes, wake, wave lines, chimney vapour | (400, 368) |
| East | Moose | Palmate antlers, long face, silhouette, four legs, warm woodland-brown coat | (521, 115) |
| Ontario | Northern Ontario forest | Layered pine trees, treeline and etched forest floor | (337, 97) |
| Ontario | Wawa Goose | Illustrative large goose, wings, raised neck, beak and roadside plinth | (583, 108) |
| West | Prairie grain elevators | Multiple varied-height elevators, timber siding, pitched roofs, grain chutes | (280, 344) |
| West | Saskatchewan potholes | Cracked road strip, three potholes, faded warning diamond | (432, 352) |
| West | Rocky Mountains | Layered crags, white snowcaps, foothills and evergreens | (701, 88) |
| West | Mountain pass | Switchback, switchback stripes, mountain cliffs, small PASS sign | (827, 343) |

The subjects are playful roadside vignettes, **not additional hazard or event cards**. A rendered pothole cannot stop a car; a ferry cannot modify deck contents. Their illustrations are purely visual, and all eight are always present in their appropriate regional stages regardless of player state.

## Painter's order and gameplay guarantees

The SVG pipeline in `core/chaos-board.js` remains:

1. Existing baseline SVG terrain as fallback
2. Existing approved region-specific painted WebP underlay
3. Existing approved region-specific transparent foreground
4. **CCC-ART-5 vintage illustrated roadside vignettes**
5. Existing live highway shadow, roadway and painted centreline
6. Existing live town circles, stop labels and moving, numbered car tokens

This guarantees that all detailed regional artwork remains **behind critical live gameplay information**. Vignettes are positioned within the map coordinate system in quieter areas above/below road corridors. A new regression samples each normalized route and enforces **more than 55 SVG units** between feature anchors and the moving roadway. The ferry location avoids the Port aux Basques stop-label corridor.

The illustrated group is `aria-hidden="true"` and `pointer-events="none"`. The map's existing accessible title and legend stay authoritative. Its `<desc>` lists the regional scenic subjects as optional context for assistive technology. No lettering is necessary to play. In forced-colours mode the vignettes disappear, revealing the already qualified baseline atlas; unlike live cars and labels, they are never interactive. The illustrations have no animations, timers, remote fonts, external images or network requests.

## Files and qualification

- `bong-goggles/web/core/chaos-region-scenery.js`: static, deeply frozen per-region coordinates and names; eight detailed vector illustrations, closed region allowlist and pure safe renderer.
- `bong-goggles/web/core/chaos-board.js`: imports and inserts the proper region's scenery below the road; adds the scenic map-description string; changes **no** route points or state calculations.
- `bong-goggles/web/ccc-tabletop.css`: modest paint texture and label styling scoped to the game, disabled in forced-colours; no layout-dependent animation.
- `bong-goggles/web/scripts/qualify-web.mjs`: independent output-source integration check, strict eight-piece inventory, safe self-contained SVG source (12 KiB limit), and **a 4 KiB increase only to the base published UI allowance** from `1048*1024` to `1052*1024`. The 49-card budget (4 MiB), six-atlas budget (780 KiB), six-vehicle budget (16 KiB), individual JavaScript/CSS caps, dashboard allowlist and original brand budgets remain unchanged.
- `bong-goggles/web/test/ccc-art-5-scenery.test.js`: eight-count inventory, all required regional subjects, unique vector details, layer order, stop/vehicle count, roadside safe zones, privacy, game-state immutability, accessibility, no external scripts/URLs, and unchanged art budgets.

No additional published media assets or file names are required: the already-qualified build copies the `core/` directory and `ccc-tabletop.css` automatically. The eight illustrations use only the existing SVG paint system, avoiding both new image downloads and edits to the six immutable CCC-ART-2 map masters.

**Qualification exit:** the new focused tests and affected Bong Goggles web build/asset gates must pass at the PR's exact head, with retained proof in its qualification comment. **No merge or deployment is performed by this task.**

**Next canonical art milestone:** CCC-ART-6, whose detailed requirements must be verified against its authoritative task assignment before starting.
