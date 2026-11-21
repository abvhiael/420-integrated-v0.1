# CCC-2 — Cards, uploaded artwork, and regional deck qualification

The local Cross-Country Chaos game remains a **2–4-seat, no-wallet, no-wager** Canadian Classics game. CCC-1's frozen 2,500 km stages, seven-card opening hands, draw/play/discard lifecycle, regional mileage scoring, own-turn repairs and permanent detours remain unchanged.

## Canonical artwork

All **49 approved source images** reside in `bong-goggles/web/assets/games/cross-country-chaos/cards/`:

| Group | Identities | Master paths |
| --- | ---: | --- |
| Shared mileage | 7 denominations | `common/mileage-{100,150,200,250,300,400,500}.png` |
| Shared repairs | 6 named fixes | `common/fix-{toolbox,atlas,plows,jerry,detour,help}.png` |
| Installed upgrades | 8 unique | `power/upgrade-*.png` |
| Championship legends | 4 unique | `power/legendary-*.png` |
| Regional hazards | 8 × 3 = 24 unique | `hazards/{east,ontario,west}/hazard-*.png` |
| **Total unique illustrations** | **49** | **49 uploads** |

`core/chaos-card-art.js` is the strictly allowlisted browser URL resolver for all five card types. No filename may be formed from an arbitrary user-supplied path or read from an external image host. The game board uses that same resolver for hand cards, installed equipment, regional hazards, face-up discard and displayed denomination stacks.

`scripts/verify-chaos-card-catalog.mjs` validates that all 49 PNG masters exist exactly once, have 640×1080 dimensions, alpha transparency and bounded size. It validates the existing 13-file common-card manifest's names, types and master SHA-256 values against actual bytes; every other source image contributes its SHA-256 to the deterministic candidate catalog digest. The build fails before clearing or writing `dist` when catalog identity, uploaded source integrity, or regional card allocation is invalid. The 49 source PNGs and manifests remain source-only; the established production pipeline generates 49 optimized transparent 480×810 WebP outputs under the same allowlisted paths.

## Regional physical deck inventory

Each of the three freshly shuffled regions contains **278 standard physical cards**:

- Mileage: 30 × 100 km, 26 × 150 km, 22 × 200 km, 18 × 250 km, 14 × 300 km, 10 × 400 km, 6 × 500 km (**126 total**).
- Regional-only hazards: 9 copies of each of the region's 8 distinct hazards (**72 total**).
- Shared repairs: 12 copies of each of the 6 fixes (**72 total**).
- Vehicle upgrades: exactly one of each of the 8 power-ups (**8 total**).
- Legends: four distinct card identities distributed **1–1–2 across the championship**, one identity appearing in exactly one regional shuffle. This yields regional deck totals of **279, 279 and 280** in randomized stage order, **838 physical cards** across the entire championship.

Each card has a unique physical instance ID and is shuffled deterministically from a caller-validated seed. A second stage never reuses a previous region's mileage, attack, repair or upgrade card; the scoreboard persists, but all regional equipment and cards reset. Played or expired legends cannot be minted again in another stage. `assertLegendaryAllocation` rejects duplicate, missing, foreign or invalid card allocations before a regional deck may be constructed.

## Qualification and future work boundary

The focused tests in `test/ccc-2-card-deck.test.js` exercise all approved art identities, invalid art IDs, the 13 pinned master digests, the three complete regional inventories, randomized seeds, seven-card opening preservation, cross-region card isolation, unique four-legend allocation, on-screen artwork of played mileage and public discard, and hidden-hand protection. The existing CCC-1 tests continue to cover individual hazard, fix, upgrade, power and kilometre-scoring behavior. The pre-existing Bong Goggles CI also verifies optimized WebP dimensions, alpha transparency, output allowlisting and static asset budgets.

**CCC-2 is complete only after the exact pull-request commit passes Bong Goggles Web Verification.** The current candidate's test run and SHA are available from its GitHub Actions checks. No website deployment, testnet activation, online multiplayer, or computer-controlled opponents is implied.

**Next roadmap phase:** CCC-3 — the three illustrated regional highway game boards and vehicle route positions; the separate CCC-ART workstream covers production of original maps, vehicle tokens and tabletop visual assets.
