# Cross-Country Chaos — CCC-3 regional route board and tabletop

## Scope and architecture

CCC-3 completes the **local, pass-and-play** visual board that consumes the qualified CCC-1 rules engine and CCC-2 asset registry. It does not introduce blockchain authority, multiplayer networking, gambling, paid services, or unapproved card resources.

Implemented in `bong-goggles/web/core/chaos-board.js` and composed into the existing `renderChaosGame` UI in `core/classics-ui.js`. It uses no third-party map tiles or live road-network dependencies. Original card illustrations continue to resolve through the approved `chaosCardArt` allowlist. Public board state is separate from a private turn-holder's hand.

## Regional illustrations and vehicle travel

Every regional board is an original **schematic SVG rendering** inspired by the Trans-Canada Highway, not a navigation chart or a claim about actual travel distance. All three regions retain their **2,500 game km** finish target and individual place names:

| Region | Scenic illustration | Major signposts |
| --- | --- | --- |
| East — Down East Disaster | Atlantic coast, marine ferry passage, rolling terrain | St. John's, Gander, Port aux Basques, North Sydney, Fredericton, Montréal |
| Ontario — Never-Ending Ontario | Great Lakes, northern forests, winding Trans-Canada corridor | Montréal, Ottawa, North Bay, Sault Ste. Marie, Wawa, Thunder Bay, Kenora |
| West — Prairie & Mountain Mayhem | Grain elevators, prairie fields, Rockies and mountain passes | Kenora, Winnipeg, Regina, Calgary, Banff, Rogers Pass, Vancouver |

Static authored waypoints form each road. The exported `chaosRoutePosition(region,effectiveKm)` computes relative arc length along the individual route, clamps positions to 0–2,500 game km, and returns x/y/heading independently of the current browser. Four vehicle pieces are drawn with distinct colors and seat numbers; lateral lane offsets keep coincident vehicle positions visible. Mileage is determined solely by the engine and includes bonuses and permanent losses. Renderers are pure: updating game state and re-rendering moves each vehicle without changing the rules.

## Tabletop and private-turn boundary

- **Global board:** always shows stage route, 2–4 public car positions, exact mileage legend, common regional draw deck (face down), top discard (face up) with approved art, recently played repairs/attacks/powers, and four/three/two public player mats.
- **Each player's public mat:** published mileage cards grouped from 500 down to 100 km with copies counted; current face-up hazard; detour and slowdown accounting; installed upgrades with used/available indicators; remaining legendary shields.
- **Current seat's private hand:** only rendered after pressing the existing player-handoff reveal action. Draw/discard/repair/drive/target and power controls remain in the existing `classics-ui.js` phase mechanism. Other hands are never rendered, and unrevealed card identities do not enter map titles, log, public piles or markup.
- **Resolved attacks, repairs and legendary effects:** visible in the recently played area. Temporary random road-risk effects are represented by the actual changed hazard/penalty and the established event log, without fabricating a physical draw-deck card.
- No new card-art source assets are added. All art references remain within the CCC-2 registry and its bounded WebP build/deployment allowlist.

## Card-effect verification

`test/ccc-3-board.test.js` exercises all **24 regional hazards**, **six fixes**, **eight upgrades**, and **four championship-unique legendary powers** in the actual rules engine, including their public UI effects. It tests road-risk slowdown, permanent detour deductions, untouchable private hands, automatic defenses, station-wagon recovery, one-use mileage bonus, power retirement, visual output and stage changes. The pre-existing CCC-1 and CCC-2 regression suites remain authoritative and unchanged except to assert that **public board cards stay visible during the private-hand pass**.

## Accessibility and visual production follow-up

- Accessible SVG map title and textual mileage legend, visible vehicle colors *and* seat numbers, headings and captions in public playing areas, responsive one-column cards on narrow screens, focus-visible and forced-colors treatment; existing reduced-motion preference remains honored.
- Map route artwork is currently **programmatic scalable SVG**. The separate, already approved **CCC-ART** visual production workstream may later supply higher-detail painted scenery, custom vehicle images, animations and results illustrations while retaining this qualified route geometry and player-state boundary. Such optional work is not represented as already supplied or qualified by CCC-3.

**CCC-3 exit:** three distinct regional map renderings, mileage-positioned vehicles, all 2–4 public player mats, qualified card art on mileage/hazards/upgrades/used cards/discards, private turn-holder hand controls, and actual engine effect coverage on the exact PR head. Merge/deployment not implied.

**Next canonical implementation step:** CCC-4 — computer drivers (Easy, Normal and Hard), maintaining exactly the same legal moves and deck information boundary.
