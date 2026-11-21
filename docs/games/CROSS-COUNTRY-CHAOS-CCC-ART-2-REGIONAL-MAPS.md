# CCC-ART-2 — Final regional atlas maps: integration and qualification

**Status:** integrated into the existing local Cross-Country Chaos game board as decorative source artwork, behind the qualified live SVG road, town stops and player vehicles. **Not** a change to CCC-1/CCC-2/CCC-3 rules, normalized kilometre mapping or CCC-ART-1 typography. This records the six supplied web-ready files, not new 3840 × 1660 layered editing masters.

## Approved style and uploaded artwork

**Vintage illustrated Canadian road atlas**: warm mid-century travel-poster painting, slightly aged paper, detailed regional scenery with playful roadside details, restrained contrast near game-route labels. The source artwork supplied for each game region is kept in the GitHub repository at:

`bong-goggles/web/assets/games/cross-country-chaos/maps/`

| Region | Underlay (opaque) | Foreground (transparent) | Theme |
| --- | --- | --- | --- |
| East | `east-atlas-underlay.webp` | `east-atlas-foreground.webp` | Newfoundland, ferry, Maritimes, Québec |
| Ontario | `ontario-atlas-underlay.webp` | `ontario-atlas-foreground.webp` | Great Lakes, Shield, woods, northern stops |
| West | `west-atlas-underlay.webp` | `west-atlas-foreground.webp` | Prairie grain elevators, foothills, Rockies, Pacific |

Each source/production asset is WebP at **1920 × 830**, an exact **2×** match for the unchanged **960 × 415** SVG viewport. Both landscape images and alpha overlays were user-uploaded before this implementation; the board does not synthesize or fetch any remote imagery. Their identities are explicitly pinned in `core/chaos-map-art.js` to Git blob SHA hashes so that accidental replacements cannot quietly change published scenery.

| Region | Underlay bytes | Foreground bytes | Total |
| --- | ---: | ---: | ---: |
| East | 182,536 | 81,202 | 263,738 |
| Ontario | 181,884 | 81,022 | 262,906 |
| West | 181,884 | 81,802 | 263,686 |
| **Set** | **546,304** | **244,026** | **790,330** |

All individual files are below the approved **180 KiB** underlay and **80 KiB** foreground thresholds, and the set is **771.8 KiB** within the separately accounted **780 KiB** map-art publication budget. This atlas budget is separate from the qualified **49-card (4 MiB)** and core/base (**1 MiB**) budgets. No changes to those two previously frozen caps are necessary.

## Layering and safety

SVG rendering order, *from back to front*:

1. Existing flat rectangular canvas and legacy scenic SVG shapes **as a fallback only**.
2. Region-specific approved painted **opaque underlay** (`ccc-map-underlay`).
3. Region-specific approved **transparent foreground accents** (`ccc-map-foreground`).
4. Existing live SVG **road shadow, route surface and dashed centreline**.
5. Existing live SVG **stop circles, labels and 2–4 numbered vehicle tokens**, driven solely by the previous `chaosRoutePosition` 0–2,500 km logic.

The optional foregrounds are below the gameplay route and markers by design; they cannot obscure crucial live information. All new SVG images are `aria-hidden`, noninteractive (`pointer-events=none`) and use fixed local allowlisted URLs. The SVG's accessible title, map identity, car legend, town labels and 2,500 km targets remain code/text and not baked into decorative artwork.

**Forced-colours:** both decorative layers are hidden, revealing the retained old vector backdrop. **Reduced motion:** existing rules and styles remain untouched; the artwork does not animate. **Privacy:** none of the illustrations reads state or private hands; prior handoff concealment remains intact. **Fallback:** if a map fails to load the existing background and road remain usable.

## Static build/release contract

- `scripts/verify-chaos-map-art.mjs` reads the **six exact GitHub uploads**, asserts the allowlist and unique path identities, detects added/removed master WebPs, requires WebP / 1920×830, checks opaque or alpha as appropriate, verifies content bytes and Git blob SHA-1 identity, and applies the single-file/total byte limits.
- `scripts/build.mjs` performs verification **before clearing the build output**, then copies only the six pinned WebPs unchanged into `dist/assets/games/cross-country-chaos/maps/`. It does not include source archives, 3840×1660 PNG working masters, unlisted art or third-party assets.
- `scripts/qualify-web.mjs` independently checks publication contains exactly six same-size maps, revalidates WebP metadata and alpha, checks the separate 780 KiB atlas budget, and retains the strict asset allowlist.
- `test/ccc-art-2-regional-maps.test.js` checks source integrity, all three scene URLs, layer order, stop and vehicle counts, live position math, private-hand safety, forced-colours fallback and production gates. Existing CCC-3 tests continue to cover all card effects, equipment and public tabletop; neither the state machine nor route coordinates are modified.

**CCC-ART-2 exit criteria:** scenery uses all uploaded images, separate layers, unchanged 960×415/2,500-km game layer; assets pass exact SHA/dimensions/alpha and budgets; focused unit tests, full Bong Goggles web build and repository documentation checks pass on the exact PR head. Deployment and merge require separate approval.

**Next art phase:** CCC-ART-3 — vehicle pieces, transparent tokens and their orientation/colour treatments. **Existing numbered SVG vehicles stay in production until that separate work is qualified.**
