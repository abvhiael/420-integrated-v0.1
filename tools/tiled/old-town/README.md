# Port Alder / Old Town — Tiled review map

Open `port-alder-old-town-review.tmj` in Tiled. This map is **a review visualization, not a qualified runtime renderer**.

Generated directly from:
- `deployments/highcountry/old-town-site-registry.json` (59 site rectangles and B22 park)
- `deployments/highcountry/old-town-genesis-assets.json` (20 Genesis asset identities, canonical relative paths and SHA-256 records)

## What you will see
- **Parcel boundaries:** 60 named rectangular Tiled objects (59 sites + public B22 park) from recorded `rect=[x0,y0,x1,y1]` without relocating or modifying a single rectangle.
- **Structures:** 20 **point markers**, named by asset ID, with custom properties for the canonical PNG path and SHA-256. These are identity labels **not sprite placements or qualified structural foundation anchors**.
- Terrain, roads, entrances and landmarks layers are empty unless qualified source data is later supplied.

Tiled isometric shape-object coordinates are measured in projected squares based on tile *height* (32 px): original registry integers are multiplied by 32. Each object's `rect_x0`, `rect_y0`, `rect_x1` and `rect_y1` properties preserve the source integer rectangle unchanged.

## Important constraints
The site registry declares `coordinateAuthority=PROVISIONAL_LOCAL_PHASE_C` and notes that its independent approved survey is still missing from `main`. Treat its geometry as provisional; no sales, title, placement, or other server-authoritative action may depend on this Tiled map.

This file does **not** contain 20 embedded PNG images. Canonical PNGs are still located in the game repository; the current qualified foundation/canvas-scale correspondence is not available. Do not guess it, substitute generated art, or interpret point markers as ground anchors. Do not use Tiled's bounding boxes as structural footprints.

## Open on Windows
1. Download the `.tmj` file from this PR (GitHub file view > Raw/Download raw file).
2. Use File > Open in Tiled.
3. In the Layers panel make sure **Parcel boundaries** is visible. Select a rectangle to inspect `site_id`, `status`, `block`, `authority` and exact source bounds.
4. Toggle **Structures** for the 20 Genesis identity markers; the layer intentionally has no building illustrations yet.
5. This is a 736×500 logical tile scene, larger than the initial 16×16 template. Use View > Zoom to fit / zoom out or pan to navigate.

Next implementation stage: approved canonical survey reconciliation, exact PNG sprite-local foundation measurements, image-collection tileset, tested image anchor projection and import validation. Nothing in this PR enables a game renderer.
