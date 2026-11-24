# BC-2.7 — Labyrinth Cribbage final game qualification

**Rules:** `bc-labyrinth-cribbage-325@2.0.0`; independently compiled v2 Go rules hash `9eed3af244d95dd1757b2ce82c1f66d85581a9b0656e0f36eba825cf8ddbc791`.
**Artwork:** approved, byte-for-byte immutable 1254×1254 wood-slice PNG git-blob `db3f4e88a87bdb1ce9c6f202484bacfbb653cdc2`. The noncrossing two-lane 652-hole atlas, printed score guides, mobile positioning and virtual individual scores remain qualified under BC-2.4.
**No change to monetary/Genesis rules:** all account matches are off-chain, zero wager and zero reward, protected by 420ID authentication. The existing 420Wallet/on-chain game sessions remain separate.

## Required acceptance evidence

1. **Deterministic rules, score and AI:** Run the exact-head Go race suite for 325-point heels, seven-card flush/show, 2, 3, 4 seats, 4-player opposite-seat shared partnership and four-person individual, all three Easy/Medium/Hard difficulties, no concealed hands in any policy input, strictly legal moves, full bot-only and mixed human/bot terminal outcomes, independently replayed traces.
2. **Genuine authoritative account match:** The BC-2.7 PostgreSQL 16 race integration runs two *independent* cookie-authenticated 420ID participants through a complete real HTTP 325-point match. It verifies turn ownership, sequence/nonce and out-of-turn rejection, no concealed state, cold server restart while live, independent journal replay, authoritative terminal winner reaching 325, participant-only result history, and a rematch that waits for fresh human consent. This is test-service qualification, not deployed service acceptance.
3. **Actual browser interaction:** Two distinct real Chromium browser contexts, desktop and mobile, receive separate authenticated private hands and correct turn controls, perform an action on the actual UI, recover a persisted turn after refresh, confirm resignation status and revoke an authenticated actor without preserving cards. Retain the earlier BC-2.4 approved board provenance, correct 0–325 peg positions, responsive artwork, visible focus/keyboard checks and the BC-0.12 existing WCAG acceptance.
4. **Inherited integrity/security:** BC-2.5 invitations, presence/reconnection, leases, timeout and rematches; BC-2.6 history, stats, mutual-friend consent and block revocations; app/web static budgets, CSP/secret checks, and the original ordinary Cribbage isolation must remain green. An unauthorized spectator must receive no private session, and private game state must never enter event/history/scores.
5. **Release boundary:** Passing this gate qualifies **repository code only**. BC-2.8 independently requires main-only real deployed 420ID two-device, full play-to-325 and rematch across human/bot formats, explicit Render runtime health, deployment/rollback evidence and catalogue activation. Do **not** mark the game `playable` from BC-2.7.

## Exact-head workflow

`.github/workflows/bc-2-7-labyrinth-final.yml` checks the actual PR SHA in each job and separates rules/bot completion, PostgreSQL 420ID match, and isolated real-browser qualification. Only report successful checks with verified GitHub workflow IDs; after code and exact-head checks pass, update canonical roadmap to **BC-2.7 QUALIFIED (repository only)** with exact source SHA and evidence. No merge until explicitly requested.
