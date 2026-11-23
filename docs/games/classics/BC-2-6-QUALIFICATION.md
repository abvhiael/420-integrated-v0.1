# BC-2.6 — Labyrinth Cribbage history and social qualification

This is the sixth gate of BC-2, not a public game-release authorization.

## Authoritative result and privacy contract

- New **420ID-only** GET `/v1/classic-sessions/history-labyrinth` and POST `/v1/classic-sessions/challenge-labyrinth` require independently activated, exact version/hash-pinned Labyrinth rules, the existing match-request least-privilege grants and a verified account cookie.
- Server history is bounded to **20** per-seat sessions and 20 unexpired invitations; each match is re-verified against the durable journal and replay, and filtered through current blocks and participant authorization. Responses return only public scores, status, rules identity, timestamp, seat index and the verified immutable variant ID — never concealed hands, deck, engine state, random seed, signed cookies or journal actions.
- Four-player team statistics recognize seat 0/2 and seat 1/3 as partners **only** for `labyrinth-4p-partners`. Four-player individual matches always use distinct individual outcomes. Scores and statistics are computed by the authoritative service, never client-submitted.
- User profile access is via existing `/profile`. The Labyrinth history/rematch/results views present verified scores, bounded wins/losses/completions, 420ID friend list, pending invitation inbox, current-turn notices, and links to existing room acceptance and live sessions.
- Challenges reuse the existing 420ID mutual-friend, block-pair, peer-lock, request-ID collision, quota and invite consent transactions. Labyrinth request digests are game-separated from standard Cribbage. The new challenge is strictly a private two-seat Labyrinth lobby; it never starts a match or seats the friend without acceptance.
- Rematches continue to use the qualified BC-2.5 exact game/participant/format server endpoint. Ordinary Cribbage histories, profiles, friend challenges and release gates are unchanged. All activity is off-chain and zero wager/reward.
- The web client re-verifies the actor before showing scores and after challenge submission. Account changes or failures clear history, friends and notices, not cache them. Controls only display on authenticated social routes and no notification is sent to non-participants.
- BC-2.6 frontend output has its own measured, source-specific 14 KiB maximum for the new 420ID module and two changed route/presentation modules. The frozen BC-2.4 and BC-2.5 budgets remain unchanged.

## Exact-head evidence to qualify

`.github/workflows/bc-2-6-labyrinth-social.yml`: isolated Node tests for identity privacy, all result variants, friend challenge/nonce confirmation and notification visibility, plus PostgreSQL 16 420ID two-account integration with opt-in fail-closed, invitations, scores, rule identity, game separation, block revocation and retained BC-1.6 Cribbage parity. The current web static/build pipeline must also pass the independent asset and frontend checks.

A green test suite proves repository functionality, **not** that real production Render uptime or a deployed two-account full game has been accepted. Those remain the separate BC-2.7/2.8 gates. Do not mark Labyrinth or standard Cribbage publicly playable from this step.
