# BC-0.9 — Shared Classic tabletop components

**Status:** **QUALIFIED (shared UI repository only)** on 2026-11-22 UTC. Reusable zero-wager presentation primitives, not playable games, real game AI or deployed 420ID multiplayer.

**Qualified source SHA:** 1e2d0ff2792546fadb3ef43d4415312a84f2a051

## Exact-source qualification

- [BC-0.9 Shared Classic Game Components Qualification #44977370011](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44977370011) — **SUCCESS** at the qualified implementation SHA. Verified exact SHA checkout, Node syntax checks for shared/tabletop/game page modules, static security/configuration checks, **49/49 targeted Node tests passed** (0 failures), and verified that the tabletop module is imported by the shipped game-screen source.
- Tested: tabletop-components, shared-game-ui, classics-menu, classic-rooms, app-shell. Covers ordered 52-card data manifest, HTML escaping, own-seat cards/racks, schema/length/action bounds, invalid board positions, 8×8 chess/checkers, 9×9/13×13/19×19 Go, dice, 1/2/3/6-column complete generic scorecard fixtures, seat/team/score/turn presentation, disabled controls, mobile, forced-colors and existing route behavior.
- The automatic whole-web pipeline is still separately blocked by the **previously documented unrelated CCC-ART-2 regional WebP atlas size/hash discrepancy**. BC-0.9 does not change those assets, protection assertions or Cross-Country Chaos rules. A scoped qualification is not claimed to be an all-web pass or a live browser deployment.

## Delivered files

| Repository path | Qualified functionality |
|---|---|
| bong-goggles/web/core/tabletop-components.js | Ordered standard-deck manifest and suit/piece/dice symbols; deck/discard, private card hands, tile racks, chess/checkers/Go boards, dice, scorecards, seats, scoreboards, turn status and inert game controls |
| bong-goggles/web/core/shared-game-ui.js | Composes new shared widgets within the existing verified active-game table while preserving the earlier safe public board fallback |
| bong-goggles/web/styles.css | Responsive tabletop, mobile layouts, contrast-safe seats/board/dice/rack/card styles, forced-colors and reduced-motion handling |
| bong-goggles/web/test/tabletop-components.test.js | Privacy, escaping, illegal projections, bounds, 1/2/3/6-column scorecards, board grid and accessibility tests |
| .github/workflows/bc-0-9-shared-components.yml | Exact-SHA targeted qualification, static checks and existing screen/catalogue/room regressions |

## Secure projection and component contract

A caller must independently validate the 420ID account, room membership, active seat, rules hash and server-owned game state before passing a per-seat projection into the shared renderer. A projection with verified=true and source=qualified-account-games is not an authentication credential. The matching game ID and active phase are required for rendering.

The optional tabletop projection may contain deck, discard, hand, rack, board, dice, scorecards, controls and turnSeat. A concealed hand or rack is rendered only for the authorized viewerSeat. Opponent seat summaries may show public concealed-card counts, never hidden contents. Unknown tabletop attributes, duplicate piece locations, out-of-range coordinates and dice, mismatched scorecard columns, oversized arrays, invalid seat ownership and invalid score fields reject the entire tabletop. All display text and labels are escaped. Glyphs are locally defined symbols, not unqualified remote artwork.

All shared game controls are intentionally disabled and have no move-dispatch attributes. Server-confirmed game-specific legal actions, score changes, AI and terminal outcomes remain the responsibility of each individual game's rules engine and release qualification, not the UI framework. No new production game rules/policies or activation switches are registered by BC-0.9.

**BC-0 platform:** IN PROGRESS. Production ingress, actual two-account end-to-end play and unrelated CCC artwork qualification remain separately unverified.

**Next canonical milestone:** BC-0.10 — Real-time and recovery (not begun).
