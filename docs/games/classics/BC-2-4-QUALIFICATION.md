# BC-2.4 — Labyrinth Cribbage 325-point interface, original board and peg-hole qualification

**Current state: IN PROGRESS — not qualified or merged.** This records implemented source and exact outstanding evidence, not public play permission.

## Player-approved changes

The user provided a **1254 × 1254 PNG, named `labyrinth.png`**, depicting a bark-edged wood-slice labyrinth with printed numerical score guides and dark circular peg holes. The user requires the **exact unchanged image** and an accurately sequenced peg-hole map. In this same instruction, they reset the game target from 241 to **325 points**.

- Canonical v2 rule identity: `bc-labyrinth-cribbage-325@2.0.0`, compiled Go `v2.0`. Hash of canonical v2 manifest: `8391ad4de516f8767208e584b183ff618c209648767e6a92387cd177db41cc13`. Go runtime rules hash: `9eed3af244d95dd1757b2ce82c1f66d85581a9b0656e0f36eba825cf8ddbc791`.
- The original source image's **SHA-256 is `4634051491e6bcadec3f7e065ed61b8cbf92ca4ef3f3f488da1811730f91f5f5`, size 4,236,478 bytes, dimensions 1254 × 1254**. Expected repository path: `bong-goggles/web/assets/games/labyrinth-cribbage/labyrinth.png`. The build will not silently replace, recompress, crop or rescale it; only a byte-identical source passes the separate integrity gate. This source PNG is **not present in GitHub** in this qualification record.
- Image processing of the exact mounted original identified 652 repeated circular hole centers under a consistent contour template (darkness threshold 65, 8×9 pixel bounding box, contour area 41.5). The coordinates are recorded in `bong-goggles/web/core/labyrinth-hole-survey.js` **in scanline order only**. **No authoritative 0–325 numerical-score traversal has been verified for either physical track.** Simply splitting 652 by two or linking nearest centers would invent a route and is forbidden. The render does not synthesize pegs.

## Implemented sources

- `services/bong-goggles-account-social/classic_labyrinth.go` and v2 tests: 325 immediate-win threshold; immutable v2 hash/version; seven-card hand and crib scorer; two-, three- and four-seat partnership/individual variants; separate historical v1 identity.
- `classic_labyrinth_bots.go` and tests: all three server-private difficulty policies adapted to 325, no authority transfer to browser.
- `bong-goggles/web/core/labyrinth-cribbage-ui.js`, `labyrinth.css`, `labyrinth-hole-survey.js`: dedicated private hand, selected-card and explicit Play Card/Discard/Cut/Go actions, responsive original-board layout (not replacement art), independent score indicators for 4-player free-for-all, accessible keyboard/focus surfaces, no guessed pegging paths.
- `labyrinth-session.js`, `labyrinth-route-runtime.js`: 420ID-bound server projection, exact v2 rules hash, session listing and My Games deep links, legal-action callbacks only, explicit error/invalidation, cold resume and stable same-route rendering.
- `classic-rooms.js` and `classic-room-bindings.js`: four-player Partnerships default and Individual alternative persisted via the server room variant; 2/3-seat individual only.
- `bong-goggles/web/scripts/build.mjs`, `qualify-web.mjs`: exact original PNG export only if provided, isolated and measured 40KiB BC-2.4 UI budget, **unchanged historical Cribbage/CCC budgets**; no production Play activation.

## Evidence

- Earlier v2 engine and server-auth tests on the new 325 score rule: [BC-2.2 run #45238915174](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45238915174) **both jobs PASS**.
- The image-integrity job in [BC-2.4 run #45241401882](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45241401882) **failed because the exact original PNG has not been uploaded**. This is a required release blocker, not a reason to weaken the test. Source/asset cannot be declared complete.
- The new scoped Node/UI, Go v2 and browser build tests are to be recorded at the **latest exact head** after execution. Prior failing runs are diagnostic, not acceptance evidence.
- Approved art was also bundled **unchanged** with its SHA and intended GitHub relative path in a downloadable archive in this conversation; an archive in ChatGPT is not an uploaded GitHub source blob.

## Exit gates (not satisfied)

1. Store **exact** original `labyrinth.png` bytes at the repository asset path and verify via SHA-256, dimensions and published output.
2. Build, manually verify and persist a numerical 0–325 **ordered** hole sequence per track that matches the printed guide markers, start positions, turning geometry and finish. The 652 center survey by itself is **insufficient**.
3. Render actual physical pegs aligned with verified center coordinates; regression-check score-to-hole map (including 0, 10–320 and 325), mobile scaling, partnership sharing and four individual score indicators. Do not create fake holes or move the original artwork.
4. Confirm all focused v2 Go, Node, PostgreSQL and live browser visual/interaction tests at a single exact code/art head and preserve CI run identities.
5. Only then mark BC-2.4 qualified, advance to the next canonical UI/integration step, and consider merging if explicitly requested. No public Play or production bot activation is authorized by this PR.

**Verified external boundary:** The available GitHub connector accepts textual commits and base64 blob content but does not expose the conversation-uploaded PNG bytes to that connector; the model's Python/container filesystem has the original bytes but cannot authenticate/write to GitHub. This is why the exact original is provided as a separate archive instead of being claimed as a committed GitHub asset.
