# Budtender 3.18 — Asset layering hierarchy

## Canonical order (immutable for this step)

```text
00_BACKGROUND
01_WALLS_AND_WINDOWS
02_FLOOR
03_ARCHITECTURE
04_FIXED_SHELVING
05_FIXED_COUNTERS
06_PRODUCT_DISPLAYS
07_PROPS
08_PLANTS
09_CUSTOMERS
10_STAFF
11_INTERACTION_EFFECTS
12_LIGHTING
13_FOREGROUND
14_UI
```

Rendering-only occlusion order is owned by `clients/budtender-web-v1/public/scene-layers.js`. Ranks 0–14 are applied through `data-scene-layer` to direct children of `.shop-stage`, allowing the existing walls, floor and fixed counter to occupy distinct stable layers. Within one layer, source order is retained. Unknown or malformed layer labels are rejected before any DOM z-index changes; the source list is not mutated. CSS owns geometry, while the canonical ranks own z-order. No game service, economy, inventory, progression, wallet, save, or entitlement authority is affected.

Current starter scene layers: walls/windows (01), floor (02), fixed counters (05). The remaining categories are reserved and can receive approved production art without renumbering. The UI HUD remains outside the stage (14_UI as its logical topmost tier). Asset registration and delivery remain governed by the existing Budtender inventory allowlist.

Exit checks: order completeness and stability; invalid-name fail-closed behavior; deterministic ordering and stable ties; DOM assignment; integration availability through same-origin static delivery; gameplay-state isolation. Level 1 only; no global requalification implied.
