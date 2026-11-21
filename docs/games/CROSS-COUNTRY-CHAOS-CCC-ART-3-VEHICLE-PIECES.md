# CCC-ART-3 — Selectable vintage player vehicle pieces

**Implementation:** six locally authored, transparent 100×64 original SVG illustrations, themed after the frozen vintage Canadian road-atlas style and available to all 2–4 local human players at setup.

## Vehicle catalogue

| Selector ID | Vehicle | Visual silhouette |
| --- | --- | --- |
| `wagon` | Woodie Wagon | Long station wagon, faux-wood side panels and roof luggage |
| `compact` | Bluebird Compact | Round, short roadster with packed roof rack |
| `pickup` | Canoe Pickup | Classic pickup with exposed cargo bed and boating equipment |
| `camper` | Prairie Camper | Vintage two-tone camper with little curtained windows |
| `convertible` | Coastal Convertible | Low open-top car with contrasting leather seats |
| `minibus` | Touring Minibus | Long touring van with a light roof and luggage |

The six SVGs live in `bong-goggles/web/assets/games/cross-country-chaos/vehicles/`, with approved local URLs, immutable selector metadata, and pinned Git blob identities in `bong-goggles/web/core/chaos-vehicles.js`. Illustrations are original and vector-sharp, contain no solid background, and require no raster sprite sheet, external font, animation, remotely loaded media, external SVG use, or extra runtime library. Each is authored horizontally, with its front facing **east (right)**.

## Gameplay and UI boundaries

- `renderChaosGame` now presents a readable **Choose your ride** selector (six options) with a live illustration preview for each configured driver. Slots for drivers above the current 2–4 selection are hidden; only active slots are submitted.
- `app.js` validates every selected identifier against the closed visual registry and adds the cosmetic `vehicle` identifier to the local player object **after** creating a normal deterministic rules-engine game. No change is made to `createChaosGame`, deck generation, seeds, mechanics, turn order, scoring, regional rules or externally verified protocol params.
- Player selections survive game-state cloning, turn passes, and transitions between all three road regions. A new local championship can select new vehicles. There is no wallet link, account persistence or gameplay advantage associated with a piece.
- `renderChaosHighway` maps each car to the existing `chaosRoutePosition(region, p.km)` point and angle. It retains exact, unchanged **2,500 game km / 960×415** highway geometry and per-seat offset for overlapping cars.
- Render stacking: **cast shadow ellipse → distinctive seat-colour halo → contrasting vehicle fallback silhouette → transparent illustrated SVG image → unrotated seat-number disc and accessible title**. The vector piece rotates by the *live road heading*; `chaosVehicleHeading` also classifies the orientation into eight compass sectors for controlled variants and regression tests.
- **Seat identity** remains unique by one of the four already qualified paints (`#f4bf57`, `#83d4fc`, `#ffa3a1`, `#c7a0ff`), *plus* an always-visible numeral 1–4 and player name in text. Selected silhouette and label appear in each public player mat and the highway legend. Multiple players can select the same vehicle without making themselves indistinguishable.
- **Accessibility:** the picker is label-associated, keyboard-selectable and responds to changes; map SVG preserves its title and player mileage legend; both private-handoff and revealed views retain public car identity without exposing hidden hands. In forced-colours, decorative vehicle art hides and the contrast-safe numbered fallback piece remains. Reduced-motion preferences are unaffected (no animation is added).

## Qualification and production contract

- `scripts/verify-chaos-vehicle-art.mjs` checks **exactly six** source SVGs, required dimensions, valid safe XML syntax profile, no foreign objects, CSS imports, event handlers, scripts, non-local references or animations; caps each token at **2 KiB**; verifies pinned Git blob SHA, and limits their aggregate to **16 KiB**.
- `scripts/build.mjs` verifies sources before the build clears any old output, then copies only the six allowlisted SVGs unchanged to `dist/assets/games/cross-country-chaos/vehicles/`.
- `scripts/qualify-web.mjs` checks exact approved names, counts, bytes, Git blob SHA and total vehicle budget in the output. All 49 card illustrations and six regional map images retain their existing **4 MiB** and **780 KiB** independent allocations. To accommodate the new accessible picker and client-side rendering code, the core static-size gate increases minimally from **1,024 KiB** to **1,032 KiB** (+8 KiB); this small allowance is explicit and bounded, with unchanged per-JS, per-CSS, map, card, brand and vehicle limits. No general bypass of the asset allowlist is permitted.
- `test/ccc-art-3-vehicles.test.js` covers the six SVG identities/transparency/size limits, 2–4 seats, 8-way orientation, cast shadows, coloured numbered identifiers, fake/hostile selector IDs, persistence without rules changes, accessible setup selectors, private-hand boundaries and publishing gates.

**Exit criteria:** six independent selectable transparent vector vehicle pieces, shadows, eight orientation classes with live-angle rotation, four readable colour IDs and numbered badges, preserved working 3-stage road game and approved media, exact-head CI qualification. No merger or deployment implied.

**Next art-roadmap milestone:** CCC-ART-4. Its detailed scope must be verified against the authoritative roadmap before execution; CCC-ART-3 does not create or approve additional requirements.
