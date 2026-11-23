# BC-2.4 — Labyrinth Cribbage 325-point interface, original board and peg-hole qualification

**Current state: IN PROGRESS — creator-approved GitHub artwork installed on BC-2.4, but numbered pegging atlas and final browser/CI acceptance remain unqualified.** This records implemented source and exact outstanding evidence, not public play permission.

## Player-approved changes

The user provided a **1254 × 1254 PNG, named `labyrinth.png`**, depicting a bark-edged wood-slice labyrinth with printed numerical score guides and dark circular peg holes. The user requires the **exact unchanged image** and an accurately sequenced peg-hole map. In this same instruction, they reset the game target from 241 to **325 points**.

- Canonical v2 rule identity: `bc-labyrinth-cribbage-325@2.0.0`, compiled Go `v2.0`. Hash of canonical v2 manifest: `8391ad4de516f8767208e584b183ff618c209648767e6a92387cd177db41cc13`. Go runtime rules hash: `9eed3af244d95dd1757b2ce82c1f66d85581a9b0656e0f36eba825cf8ddbc791`.
- The original source image's **SHA-256 is `4634051491e6bcadec3f7e065ed61b8cbf92ca4ef3f3f488da1811730f91f5f5`, size 4,236,478 bytes, dimensions 1254 × 1254**. Expected repository path: `bong-goggles/web/assets/games/labyrinth-cribbage/labyrinth.png`. The build will not silently replace, recompress, crop or rescale it; the earlier survey export remains the immutable survey reference. On 2026-11-23 the creator explicitly approved the visually identical image uploaded to GitHub; the 3,446,209-byte Git blob `db3f4e88a87bdb1ce9c6f202484bacfbb653cdc2` is now copied *unchanged* into the BC-2.4 branch. Git blob identity, PNG dimensions, and all 652 surveyed center pixels are checked instead of incorrectly requiring its PNG encoding to match the earlier 4,236,478-byte source.
- Image processing of the exact mounted original identified 652 repeated circular hole centers under a consistent contour template (darkness threshold 65, 8×9 pixel bounding box, contour area 41.5). The coordinates are recorded in `bong-goggles/web/core/labyrinth-hole-survey.js` **in scanline order only**. **No authoritative 0–325 numerical-score traversal has been verified for either physical track.** Simply splitting 652 by two or linking nearest centers would invent a route and is forbidden. The render does not synthesize pegs.

## Implemented sources

- `services/bong-goggles-account-social/classic_labyrinth.go` and v2 tests: 325 immediate-win threshold; immutable v2 hash/version; seven-card hand and crib scorer; two-, three- and four-seat partnership/individual variants; separate historical v1 identity.
- `classic_labyrinth_bots.go` and tests: all three server-private difficulty policies adapted to 325, no authority transfer to browser.
- `bong-goggles/web/core/labyrinth-cribbage-ui.js`, `labyrinth.css`, `labyrinth-hole-survey.js`: dedicated private hand, selected-card and explicit Play Card/Discard/Cut/Go actions, responsive original-board layout (not replacement art), independent score indicators for 4-player free-for-all, accessible keyboard/focus surfaces, no guessed pegging paths.
- `labyrinth-session.js`, `labyrinth-route-runtime.js`: 420ID-bound server projection, exact v2 rules hash, session listing and My Games deep links, legal-action callbacks only, explicit error/invalidation, cold resume and stable same-route rendering.
- `classic-rooms.js` and `classic-room-bindings.js`: four-player Partnerships default and Individual alternative persisted via the server room variant; 2/3-seat individual only.
- `bong-goggles/web/scripts/build.mjs`, `qualify-web.mjs`: exact creator-approved committed PNG export only if provided, isolated and measured 40KiB BC-2.4 UI budget, **unchanged historical Cribbage/CCC budgets**; no production Play activation.

## Evidence

- Earlier v2 engine and server-auth tests on the new 325 score rule: [BC-2.2 run #45238915174](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45238915174) **both jobs PASS**.
- The image-integrity job in [BC-2.4 run #45241401882](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45241401882) **failed because the exact original PNG has not been uploaded**. This is a required release blocker, not a reason to weaken the test. Source/asset cannot be declared complete.
- The new scoped Node/UI, Go v2 and browser build tests are to be recorded at the **latest exact head** after execution. Prior failing runs are diagnostic, not acceptance evidence.
- Approved art was also bundled **unchanged** with its SHA and intended GitHub relative path in a downloadable archive in this conversation; an archive in ChatGPT is not an uploaded GitHub source blob.

## Exit gates (not satisfied)

1. **IMPLEMENTED, CI PENDING:** reuse the creator-approved GitHub `labyrinth.png` blob unchanged in the feature branch; confirm Git SHA-1 blob identity, 1254×1254 dimensions, 652 source-survey dark center pixels and published output.
2. Build, manually verify and persist a numerical 0–325 **ordered** hole sequence per track that matches the printed guide markers, start positions, turning geometry and finish. The 652 center survey by itself is **insufficient**.
3. Render actual physical pegs aligned with verified center coordinates; regression-check score-to-hole map (including 0, 10–320 and 325), mobile scaling, partnership sharing and four individual score indicators. Do not create fake holes or move the original artwork.
4. Confirm all focused v2 Go, Node, PostgreSQL and live browser visual/interaction tests at a single exact code/art head and preserve CI run identities.
5. Only then mark BC-2.4 qualified, advance to the next canonical UI/integration step, and consider merging if explicitly requested. No public Play or production bot activation is authorized by this PR.

**Resolved artwork transfer:** GitHub already contained the user-approved visual image on `main`. Its binary blob was reused directly in the BC-2.4 feature tree via the Git data API; no local PNG transport or re-encoding was required. The earlier 4,236,478-byte file is retained as survey provenance, not as the only acceptable PNG encoding.

## BC-2.4 inherited asset-budget diagnosis (23 November 2026)

The general web build exceeded its **frozen earlier base** by 33,516 bytes, even after the independently measured BC-2.4 UI changes were subtracted. Comparison against authoritative `main` (`e4020bbab3ce9fc31cd08490486f806fce43f9db`) and the BC-2.3 parent (`5884ba2884cd5c19126247feba3190879a4681bf`) found seven already-present, individually identifiable modules: Account Extras (10,392 B), Monetization (5,651 B), XP (5,240 B), Classic Communications (9,105 B), Communications UI (1,411 B), Room Live Bindings (1,435 B), and the BC-2.1 Labyrinth reference rules (v2 8,981 B). The first six have **identical Git blobs on main and the parent**, and the isolated Labyrinth reference rules have an independently versioned 325-point replacement. The build now measures and hashes each file, caps the combined pre-existing scope at 44 KiB, and removes only those exact module bytes from the legacy bucket. No prior allowance, CCC asset count, frozen 121-point Cribbage limit, per-file cap or original base total was increased. Any unexpected content change causes qualification failure. The approved board image and numeric hole-path validation remain **hard-failing blockers**, unrelated to this accounting correction.

## Historical pre-upload code-head verification after interrupted delivery (23 November 2026)

**Verified code head:** `60550f6e873c449379c3f42dedc6879fd2214aea`, PR [#1359](https://github.com/abvhiael/420-integrated-v0.1/pull/1359); stacked on unmerged BC-2.3. Every code suite below was run with this exact source:

| Workflow | Run | Actual result |
| --- | --- | --- |
| Bong Goggles Web Verification | [#45248162074](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45248162074) | **SUCCESS** (browser tests, static size accounting and build checks) |
| BC-2.2 v2 325-point authoritative engine | [#45248162333](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45248162333) | **SUCCESS**, Go race/scoring/replay and PostgreSQL room-variant jobs both green |
| BC-2.3 v2 325-point private bots | [#45248162284](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45248162284) | **SUCCESS**, complete match/replay and signed PostgreSQL mixed-seat jobs green |
| 420Docs Qualification | [#45248162351](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45248162351) | **SUCCESS** |
| BC-2.4 interface and original-source check | [#45248162573](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45248162573) | **FAIL (required)**: scoped UI/replay job **SUCCESS**, original-art-provenance job **FAIL** on missing source |

At the **historical SHA quoted above**, the 4,236,478-byte PNG was not yet in the PR tree. This is a pre-upload finding, not the current branch status. Computed original Git blob SHA-1: `106d4741dd159aa63088f473cd522cdd9777ae59`; no tree entry matched it. Image SHA-256 is `4634051491e6bcadec3f7e065ed61b8cbf92ca4ef3f3f488da1811730f91f5f5`. The creator subsequently provided an approved binary in the GitHub repository; this transfer limitation has been bypassed by copying the existing GitHub blob without altering its bytes.

**Unqualified physical track:** There are 652 surveyed pixel centers but no verified mapping of the two physical lanes to their ordered 0–325 positions and printed numerical guides. Earlier exploratory nearest-neighbor traces crossed bands or skipped holes and were not committed as a purported canonical atlas. `verify-labyrinth-peg-map.mjs` must fail until there is an independently checked exact `labyrinth-peg-map.json`, and actual peg animations/visual acceptance remain disabled.

**Disposition:** BC-2.4 remains **IN PROGRESS / DRAFT**, not source-art, peg path or production qualified. The current change is evidence-only and must retain those hard failure gates. No merge to `main` and no public Play activation. The next canonical milestone remains completion of **BC-2.4**, not BC-2.5.

## 23 November 2026: creator-approved GitHub image installation and guarded physical overlay

- Installed the exact user-selected GitHub PNG blob from `main` in `feature/bc-2-4-labyrinth-325-board-ui` via immutable Git object reuse. Git blob SHA-1: `db3f4e88a87bdb1ce9c6f202484bacfbb653cdc2`, file size **3,446,209 bytes**. This is the approved deployment image even though its PNG encoding differs from the original survey file. No source artwork was replaced or recompressed.
- Updated web build, BC-2.4 source-art workflow and numeric-atlas verifier to pin this uploaded Git blob instead of requiring an unrelated bytewise SHA-256. Build additionally requires **all 652 surveyed hole centers** to remain dark pixels in the 1254×1254 uploaded image, to catch actually changed geometry.
- Added `labyrinth-peg-overlay.js`: fail-closed atlas validation and SVG pegs anchored to the exact image coordinates. Two physical tracks support two opponents/teams, including 4-player shared partnership scores. Three/four individual scores stay authoritative in their separate visible virtual indicators. Pegs are **not enabled** until both physical 326-position tracks and all 32 printed guides are verified and persisted.
- Hooked atlas loading to the already-authenticated private Labyrinth session route; missing/invalid JSON cannot show a physical peg. Added responsive CSS, 325-point/partnership/individual regression tests and an actual Chromium desktop/mobile board image, navigation and fail-closed fixture test in the focused BC-2.4 workflow.
- **Not yet accepted:** the board's 0–325 numerical atlas is not derivable safely from scanline-order survey coordinates. Exploratory geometric paths visibly jumped the carved maze bands, even when guided by printed text, and were rejected. No speculative JSON was committed. No real route-to-peg animation, 0–325 guide alignment, live two-account 420ID browser acceptance, or final exact-head CI success is claimed.
- CI is triggered on the new commits and must be inspected after execution; QUEUED/PENDING runs are not evidence. Do not mark the step qualified, merge the PR, or activate public Play without completing the atlas and full exact-head/browser acceptance.

### Final follow-up: tracked defects and exact-head status

- First post-upload CI (older SHA `02f56aeb16ba83c54c697c1c0f17713d073f7fde`) exposed **two real defects**: the Node atlas gate escaped its Git object null separator as a literal backslash, and `qualify-web.mjs` still pinned the obsolete 4,236,478-byte art master. Both have been fixed at later commits; no failed check was relabeled passing.
- New sources `labyrinth-peg-overlay.js` (~3.8 KiB) and `labyrinth-printed-guides.js` (~0.9 KiB) are explicitly included in independent BC-2.4 source growth checks, with 5-KiB/2-KiB per-file caps and a measured 48-KiB total BC-2.4 allowance. Frozen earlier BC-0.x, BC-1.x and CCC caps were not increased.
- Confirmed 32 individually observed printed 10–320 numeral locations. The map verifier and runtime validator require declared guide anchors to agree with these independently surveyed source-image coordinates; a track cannot self-certify by assigning its own numeric markers.
- An image-geodesic candidate sequence did place all 652 surveyed dark dots, but **its apparently smooth course takes the wrong physical branches and incorrectly connects paired lanes at multiple inner and outer bends**. The printed labels include right-hand 10–150 versus left-hand 170–230, and the rejected candidate crosses physical lane boundaries. It is NOT authoritative. Consequently `core/labyrinth-peg-map.json` is intentionally absent; physical peg overlay stays disabled and final atlas, scoring/peg browser acceptance and release gate remain open.
- Final implementation head when recorded: `7a85ca56566e50cac3279eae796c7c2c21fa2487`. Exact-head CI runs [BC-2.4 #45255134326](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45255134326) and [web #45255134411](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45255134411) were **QUEUED**, not passed. The dedicated Chromium fixture includes desk/mobile art decode and route smoke, not deployed 420ID authentication; no final end-to-end browser result has been observed.
