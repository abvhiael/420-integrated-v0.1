# Bong Goggles BG-15.9 Production Games Runbook

BG-15.9 closes the Bong Goggles social-games application for production qualification. Canonical game authority remains in `BongGogglesGameSessionRegistry420`, generalized 420Randomness and the existing Bong Goggles profile/relationship/policy contracts. Application services may project, validate, replay, redact, measure and present state; they must not become a second lifecycle, outcome, randomness, identity, messaging, moderation, reward or settlement authority.

## Release boundary

Bong Goggles games are zero-wager. Any nonzero wager request fails closed and belongs in 420Bet. Hidden-state material remains off-chain/commitment-protected. Game chat remains BG-14/420Messenger. Rankings, presence, clocks, abandonment classification and discovery scores remain non-canonical application metadata.

## Required bounded load qualification

Use the BG-15.9 bounded profile as the release candidate baseline:

- 500 lobby sessions;
- 250 active sessions;
- 5,000 canonical move commitments/payload verifications;
- 10,000 history rows;
- 1,000 leaderboard players;
- 25 concurrent resolvers.

This is a bounded qualification, not an unbounded stress test. Reject runaway input above the hard caps in `productionCloseout.js`.

The release candidate passes only if all measured P95 budgets are within:

- projection: 500 ms;
- intent construction: 250 ms;
- canonical replay/rebuild: 1,500 ms;
- history projection: 750 ms;
- leaderboard projection: 1,000 ms;
- zero observed qualification errors;
- zero unresolved canonical/local divergence after rebuild.

## Required failure drills

Each drill must be recorded as `contained` before closeout:

1. `projection-stall` — stop/restart projection and confirm recovery from canonical state without duplicate authority.
2. `canonical-replay-divergence` — inject stale local state and confirm deterministic replay wins.
3. `ruleset-disable-rollback` — disable/rollback a client ruleset descriptor and confirm no mismatched engine can continue a session.
4. `randomness-unavailable` — unresolved/voided/stale randomness fails closed for randomness-dependent games.
5. `hidden-state-reveal-failure` — duplicate, premature or commitment-mismatched reveal cannot advance hidden state.
6. `policy-invalidation` — profile disable/block/policy change invalidates stale previously-authorized application actions.
7. `challenge-spam` — pairwise invite/challenge limits contain repeated application attempts without replacing canonical social policy.
8. `wager-boundary` — any nonzero wager fails closed and routes outside Bong Goggles to 420Bet.

## Telemetry requirements

Emit bounded operational metrics for projection, invite/action intent construction, move verification, canonical replay, randomness resolution, history/stat projection, leaderboard projection and spectator resolution.

Metrics may contain operation, outcome, latency, retry count, short reason codes and safe labels such as game type or ruleset identity. They must redact hidden/private fields before leaving the game service boundary, including hands, decks, tiles, seeds, salts, private state, plaintext/ciphertext, keys, secrets and reveal material.

Never log full private game payloads merely to diagnose divergence. Log hashes/digests, session IDs, ruleset IDs and bounded reason codes instead.

## Operator response procedures

### Stuck projection

1. Confirm the indexed/canonical checkpoint and affected `sessionId` range.
2. Stop serving stale derived state for affected sessions.
3. Re-read canonical sessions and move commitments.
4. Replay deterministic payload history.
5. Compare rebuilt state digests.
6. Resume only after the projection matches canonical replay.

### Replay divergence

1. Preserve the local digest for diagnostics only.
2. Re-read canonical session and canonical move list.
3. Re-fetch committed payloads.
4. Verify every commitment.
5. Replay from known initial state using the exact immutable ruleset engine.
6. Replace local cache with verified rebuilt state; never overwrite canonical data from local state.

### Ruleset regression or rollback

1. Disable the affected application ruleset/engine mapping.
2. Do not mutate canonical `rulesetHash` on existing sessions.
3. Prevent new invitations using a disabled descriptor at the application boundary.
4. Retain older exact engine versions needed to reconstruct already-canonical sessions.
5. Re-enable only after deterministic replay fixtures and exact-head CI are green.

### Randomness failure

1. Confirm the canonical session `randomnessRef`.
2. Query generalized 420Randomness using that exact request ID.
3. Do not substitute another request.
4. If unresolved, voided or stale, keep the game fail-closed.
5. For hidden-state games, do not reveal or derive new private material until the exact request is valid and fulfilled.

### Hidden-state incident

1. Stop spectator/private-state publication immediately.
2. Preserve commitments and public hashes only.
3. Rotate/remove compromised off-chain private material where possible.
4. Rebuild from canonical commitments and verified reveals.
5. Treat any plaintext/private-state telemetry leakage as a release-blocking incident.

### Policy or abuse incident

1. Re-read profile, bilateral block and current game-policy state.
2. Deny stale cached permissions.
3. Apply bounded challenge rate limiting.
4. Keep canonical session data intact; application abuse controls do not rewrite chain history.

## Phase closeout gates

BG-15.9 may be marked complete only when:

- BG-15.1 through BG-15.8 are complete and qualified;
- all required BG-15.9 failure drills pass;
- bounded load qualification passes;
- telemetry redaction is verified;
- this runbook is present;
- the BG-15 branch is reconciled with current `main`;
- the reconciled exact head passes Bong Goggles Games Verification, Bong Goggles Media Verification, 420Docs Qualification and 420 Integrated Qualification;
- PR #321 remains unmerged until an explicit merge instruction is given.
