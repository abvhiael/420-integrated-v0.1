# Cross-Country Chaos — CCC-ART-1 visual style guide (implementation baseline)

**Status:** CCC-ART-1 reusable style contract; applied directly to the existing playable regional SVG boards, local game screens, public tabletop, and hand controls. The authoritative rules remain those of CCC-1/2/3: three 2,500-game-km stages, seven-card hands, unique legends, and cumulative kilometre scoring.

## North star

**“Coast to coast. One questionable turn at a time.”**

A lovingly worn Canadian highway-tour souvenir crossed with a kitchen-table card game: wayfinding green, faded national-park signage, a warm caution-gold accent, worn enamel-red hazard trim, matte cream paper, and a deep forest-green felt playing surface. The game is cheerfully chaotic, legible, and genuinely Canadian without presenting its schematic map as a real navigation route. The humour is about bad weather, long roads, ferry timetables, enormous distances and plausible roadside mishaps — never at the expense of a particular community or player.

This is a tactile **Canadian road-trip table game**, not a sportsbook, a crypto dashboard, a generic casino interface or a realistic navigation application. No gambling/wallet elements are introduced.

## Frozen visual tokens

All canonical CSS tokens are **scoped to** `.ccc-wrap--roadtrip` in `bong-goggles/web/classics.css`. The palette is not imposed on the rest of BongGoggles.

| Token | Hex | Function |
| --- | --- | --- |
| `--ccc-ink` | `#10251f` | Dark lettering on light signs and gold buttons |
| `--ccc-night` | `#132d25` | Deep exterior route background |
| `--ccc-road-green` | `#20523b` | Canadian-inspired highway signage |
| `--ccc-deep-green` | `#173b2e` | Deep inset panel shadow |
| `--ccc-felt` | `#1d4734` | Woven player-table treatment |
| `--ccc-cream` | `#f6efd7` | Main off-white copy on dark surfaces |
| `--ccc-paper` | `#ebe2c7` | Aged card-paper reference |
| `--ccc-gold` | `#f6cd71` | Caution, primary actions, route highlights |
| `--ccc-enamel-red` | `#e37557` | Hazard-card trim and danger emphasis |
| `--ccc-text-muted` | `#cddfce` | Secondary public labels |
| `--ccc-region-accent` (East) | `#86d5c6` | Atlantic/ferry teal |
| `--ccc-region-accent` (Ontario) | `#b7e3e9` | Great Lakes mist blue |
| `--ccc-region-accent` (West) | `#f6cd71` | Prairie sunlight and mountain caution gold |

**Seat identity is not replaced by region colour.** The four previously qualified vehicle hues remain stable across regions, paired with seat numbers and text legends. Hazards and repairs remain distinguishable by their approved artwork and wording, not only by border colour.

## Typography

- **Display/title:** `'Trebuchet MS', 'Arial Narrow', system-ui, sans-serif`, heavy weight, high optical size, tight but readable spacing. Title-case game names; cheeky regional taglines in natural language.
- **Highway/wayfinding:** `'Arial Narrow', 'Franklin Gothic Medium', Arial, sans-serif`, bold uppercase only on short sign labels, not instructions. Use moderate tracking. Avoid pretending to use a regulated government route sign.
- **Instructions, cards, accessibility:** `system-ui, -apple-system, 'Segoe UI', sans-serif`, mixed-case text, minimum comfortable touch controls. Highway headings are not substituted for semantic labels.
- **Kilometres:** tabular numerals and a visible `km` suffix. Do not truncate the 2,500 km stage goal or the championship totals.
- **Font delivery:** system fonts only. No remotely hosted fonts, bundled licensed font assets, tracking pixels, or dependency on third-party requests.

## Route signage and regional humour

The canonical language and names live in `core/chaos-visual-style.js`; they are **presentation data**, never rules authority:

| Stage | Sign | Spoken line | Scenery cue |
| --- | --- | --- | --- |
| East / Down East Disaster | DOWN EAST | “The ferry has other plans.” | Coastal teal, fog, ferry wake, roadside evergreens |
| Ontario / Never-Ending Ontario | STILL ONTARIO | “Yes. You are still in Ontario.” | Mist-blue lakes, forests, long road |
| West / Prairie & Mountain Mayhem | PRAIRIES + PEAKS | “Flat roads. Tall stories. Taller mountains.” | Grain elevator silhouettes, amber prairie, snow-lined peaks |

The setup card carries **“Coast to coast. One questionable turn at a time.”** The in-game masthead changes its shield label and one-liner with the current region. Each regional SVG header includes a high-contrast, rectangular road-green wayfinding sign with enamel-white border and short region label. `TCH` with a stylized maple-leaf marker is **a thematic game badge**, not a legal claim of official Trans-Canada highway signage or precise real-world distances. Every board retains **“schematic, not to scale.”**

Keep humour in signage, flavour, and event copy. Never hide what a game action does behind a joke. Hazard severity, repairs, fatigue/slowdown and permanent detours must always use plain language.

## Tabletop materials and cards

- **Background:** matte dark felt, woven visually from very subtle repeated linear/radial CSS gradients with no large raster background or heavy overlay. Keep the road and cards dominant.
- **Cards:** retain all 49 previously approved source PNG illustrations and optimized transparent WebP files. Cream paper area for short labels, restrained inset edges, clear trims: enamel-red hazards, lake-blue repairs, caution-gold legends, neutral equipment/mileage.
- **Pieces:** retain existing public player mats and colour/seat-number combinations. High-contrast active-seat trim indicates focus; used/ready status remains textual.
- **Buttons:** caution-gold enamel tags with dark-ink lettering; visible hover and keyboard focus. Do not create decorative, inert controls.
- **Travel boards:** keep CCC-3's route geometry and vehicle positioning unchanged. East, Ontario, West route backdrops have subtly distinct backgrounds; region accents in mastheads do not affect mileage accounting.
- **Layering:** pure CSS and already inlined SVG for the current workstream. New painted illustrations, custom vehicles, animated scenery, and separate source-image files belong to CCC-ART-2 through CCC-ART-8 and must be explicitly qualified before publication.

## Production and accessibility contract

1. Use original, self-contained CSS gradients/textures and existing SVG scenery. Do not add image/font payload, external dependencies, remote tiles, maps or trademark imitations.
2. All visual rules for this game are scoped to `.ccc-wrap--roadtrip`; the Classics catalogue and adjacent BongGoggles screens must not receive unexpected theme overrides.
3. Primary cream on dark road-green, gold on ink, and white highway text on road-green meet high contrast targets; focus outlines are clearly visible. Preserve forced-colours and reduced-motion support.
4. On narrow screens the highway sign stacks safely; board and cards remain scrollable/responsive; no content is made image-only.
5. Hostile player names remain HTML-escaped in the masthead, road legends, and player mats; player hand confidentiality is unaffected.
6. Do not modify the frozen CCC-1/2/3 game states, card counts, routes, scoring, rules, 49-image allowlist, cloud runtime, or wallet boundary.
7. Qualification is the focused `test/ccc-art-1-visual-style.test.js` plus the affected existing Bong Goggles web qualification and scoped documentation workflow at the **exact PR head**.

## Roadmap handoff

**CCC-ART-1:** set visual identity, tokens, copy, typography, badges, signage, CSS paper/felt/enamel treatments, responsive/accessibility behavior — implemented by this change and qualified separately.

**Next:** **CCC-ART-2 — Regional Maps**, producing final illustrated route art for East, Ontario and West on top of CCC-3's qualified vector road geometry. The next phase must retain a 2,500-km normalized route and player marker layering. It is **not** delivered or claimed here.
