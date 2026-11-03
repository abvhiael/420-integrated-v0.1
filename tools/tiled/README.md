# HighCountry Tiled World Editor — starter

Open `highcountry-world-template.tmj` in Tiled (File > Open). This neutral 16×16 editing canvas has the game’s 64×32 **isometric display grid** and six separate object layers. It is not an official terrain/world survey, nor a game runtime map.

## Authority boundaries
- Canonical building art remains in the GitHub asset registry and original PNG files; do not redraw or re-export those files to change them.
- Approved lot rectangles, building placement coordinates, masks and region definitions remain in their current authoritative registries. Do not write these back from Tiled without verification.
- Tile visual size 64×32 is **not** a 64×32 game-footprint size: logical placement uses 64-pixel tiles as specified by HC-PLACE.
- Tiled object rotation and resizing are editor proposals only; server-side qualified geometry, ownership, collision, custody, equipment and property checks still apply.
- Add canonical original art in Tiled as image-collection tile objects after geometry qualification; set unique source and canonical IDs as custom properties. Never infer foundations from transparent bounding boxes.
- `Terrain` and `Roads and paths` layers are presently object layers, not imported road networks or raster tiles; add validated tilesets only when their source art is qualified.

## Project rollout
1. Open the template in Tiled; Save As a new neighbourhood `.tmj`.
2. Load approved property and terrain registries read-only through a dedicated verified importer, once built.
3. Use Tiled to visually arrange or propose elements, then validate changes against the canonical survey and geometry, with explicit approval before any import into game runtime.

No automatic import/export into the game has been wired.
