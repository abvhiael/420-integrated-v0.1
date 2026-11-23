# BC-2.3 — Labyrinth Cribbage private computer opponents

**Scope:** Independently qualified, **operator-compiled** Easy, Medium and Hard Labyrinth policies for the immutable BC-2.2 241-point server rules module. Supports 2-player individual, 3-player individual, 4-player opposite-seat partnerships (default), and 4-player free-for-all, including mixed human/bot seats. This does not authorize production registration or public Play.

## Architecture

- `services/bong-goggles-account-social/classic_labyrinth_bots.go` exposes `NewLabyrinthCribbageBotPolicies()`. The server-only `RuleDecisionPolicy` receives **only** the acting seat's `RuleModule.View` projection and validated canonical legal moves; no server `RuleFrame`, match shuffle seed, opponent hands, unexposed crib cards or elevated operator permission.
- Easy selects a deterministic but intentionally weak legal action from the acting player's visible observation. Medium estimates seven-card show score with a small publicly unknown starter sample, crib heuristics and guaranteed pegging awards. Hard evaluates all possible unobserved starters for the six-card held hand, uses private-view-derived deterministic samples of unknown crib contributions, and penalizes likely one-ply opponent pegging opportunities while valuing partner points.
- Both Medium and Hard infer crib ownership from the pinned four-player variant: partner of dealer benefits from the crib in partnership play; no free-for-all teammate is invented. The same `labyrinthCountShow` scoring rules govern actual awarded points. A separate optimized EV scorer is cross-checked against the authoritative count on 1,400 seeded seven-card hands (both own hand and crib).
- CPU work and deterministic double-evaluation are bounded by existing BC-0.8 limits (Easy 1,000 units/50 ms; Medium 10,000/125 ms; Hard 100,000/300 ms). Hostile, duplicate, malformed or overbroad views and illegal moves are rejected. No hidden game data is accessed.
- The existing signed 420ID session service can install these policies **only** through the trusted operator's `ClassicSessions.EnableBots` mechanism; the production startup resolver and BC-1.3 standard Cribbage policies are unchanged. All tests of session registration use explicit test-only injection.

## Minimum qualification

1. Compare bot score evaluation with all physical-card show combinations, 6/7 flushes, multiplicity of longest runs and nobs.
2. For all four formats and all three difficulties, show deterministic non-identical strategy choices across representative deals and verify each bot submits only legal moves for its **own** seat. No hidden state or forbidden field passes the input boundary.
3. Replay to 241 after complete bot-v-bot and human-v-bot games in all four formats, verify immediate awards, correct winner/team score and immutable individual-versus-partnership identity; reject replay corruption and wrong-format interpretation.
4. With real PostgreSQL 16 and signed test 420ID principals, create each supported format, register the policies exclusively on test service, process server-committed bot turns interspersed with authenticated human turns and confirm cold replay/reconnect.
5. Run `.github/workflows/bc-2-3-labyrinth-bots.yml` against exact source SHA. Preserve BC-1.3 Cribbage and BC-2.2 engine regression, test logs and branch provenance.

**Release boundary:** BC-2.3 is source qualification only. No deployed production bot activation, gameboard/UI approval or public release. **Next canonical step upon successful qualification:** BC-2.4 (Labyrinth player UI and board integration).

**Qualification evidence:** Pending exact-head CI.
