# Budtender — Phase 3.12 Flooring & Rug Kit

**Status:** Processed, pending visual acceptance and seamless tiling qualification.

28 supplied crops are retained at their original resolutions and exported as RGBA PNGs. The 8 floor tile files are *isometric object illustrations*, not certified tileable square textures. They must not be repeated directly as seamless textures in the game; a separate texture-authoring and edge-check pass is needed. Also, `floor_tile_walnut.png` is sourced from the new uploaded crop, and is not independently verified against the locked Phase 3.1 canonical floor.

## Sheet 3.12-A (14)
- `floor_tile_walnut.png`
- `floor_tile_walnut_dark.png`
- `floor_tile_herringbone.png`
- `floor_tile_oak_light.png`
- `floor_tile_stone_cream.png`
- `floor_tile_terracotta.png`
- `floor_tile_ceramic_sage.png`
- `floor_tile_geometric_premium.png`
- `floor_trim_walnut.png`
- `floor_transition_brass.png`
- `floor_transition_wood_stone.png`
- `floor_trim_corner.png`
- `floor_threshold_doorway.png`
- `floor_seam_expansion.png`

## Sheet 3.12-B (14)
- `rug_botanical_small.png`
- `rug_botanical_large.png`
- `rug_vintage_green.png`
- `rug_terracotta_pattern.png`
- `rug_woven_cream.png`
- `rug_geometric_sage.png`
- `rug_runner_botanical.png`
- `rug_lounge_premium.png`
- `floor_mat_entrance.png`
- `floor_mat_branded.png`
- `floor_mat_staff.png`
- `floor_mat_utility.png`
- `floor_vent_grille.png`
- `floor_access_cover.png`

## Production notes
- Original cropped art retained; exterior cream backgrounds converted to transparent pixels using perimeter-connected color segmentation.
- Keep the game-facing price/operation UI independent of bitmap art where applicable.
- Inspect on multiple contrasting backgrounds for cream fringe, lost detail, and clipped corners prior to locking.
- `asset_manifest.json` records source and output hashes and actual alpha statistics.
