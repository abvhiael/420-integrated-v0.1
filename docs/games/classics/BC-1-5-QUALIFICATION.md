# BC-1.5 — Authenticated Cribbage multiplayer, activation and recovery: repository qualification

**Status: QUALIFIED (exact-source repository / restricted-acceptance; NOT activated for public production play).**

**Qualified source commit:** `bf7ae940ea12e8b11ebde24430878665e1436cf6`.
**Repository / PR:** `abvhiael/420-integrated-v0.1`, [#1339](https://github.com/abvhiael/420-integrated-v0.1/pull/1339).
**Frozen Cribbage module:** `v1.0`, SHA-256 `6f13bd77568efc5d0836eaa61458ca0cc2c500d1db2d9c38e228b1c668f71e24`.

## Completed in source

The serving process registers the actual deterministic standard Cribbage rules
and all three qualified computer policies only under explicit
`SOCIAL420_CRIBBAGE_MODE=restricted-acceptance`, with the existing
420ID session, lobby, rules replay, PostgreSQL grant, and communications
prerequisites enabled. No other Classic gains a game-specific rules adapter.

On the authenticated 420ID room surface, a verified host of a fully occupied
Cribbage lobby can press Start. The backend rechecks the principal and seat
configuration, serializes room activation, persists a private shuffled genesis,
and returns a version-pinned, per-seat session. Moves and resignation require
server-confirmed sequence, authorization and idempotency, never browser-owned
scores or opponent secrets. The UI uses separate desktops/mobile account
contexts and requires a second confirmation to resign.

Cold page loads, reconnect and tab returns discover only the current 420ID
principal's session summaries, then request authoritative per-seat snapshots.
No browser-local deck, private journal, seed, score authority or secret
credentials are used. Revoked and switched accounts fail closed.

The BC-1.5 replay performance correction retains a **bounded 128-session
verified-prefix cache** per process, tied to the precise registered rules
adapter, genesis seed, immutable genesis hash, pinned version/hash, room and
seat count. Every request still validates the complete public event journal
and re-hashes the entire private move prefix under a repeatable-read
transaction, rejects missing/extra/mutated actions, and checks the current
stored state. Only newly appended actions need deterministic re-execution
with the original legality, double-execution and before/after-hash checks.
`ClassicSessions.VerifyRules` deliberately bypasses the cache to provide an
independent full replay from durable genesis; restarts likewise begin cold.
No database trust/permissions or cryptographic rules were relaxed.

## Exact-source qualification — all SUCCESS

- [BC-1.5 authenticated multiplayer/recovery #45074783680](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45074783680): four jobs green, including real Chromium contexts, restricted startup safety, frontend interactions and PostgreSQL 16 `go test -race -tags account420_integration,bc15_fullmatch`.
- The actual PostgreSQL two-account match reached 121 points through **153 legal moves**, winning seat 0, in **32.00 seconds**. Includes a real service-session reconstruction, server-owned commands and final replay.
- The **3-seat and 4-seat** mixed 420ID human/computer tests passed in **30.14 seconds** combined, including **25** and **41** bot turns. They validate durable mixed-seat turns and replay, not claimed full production matches.
- PostgreSQL cache-integrity regression passed in **0.26 seconds**, rejecting tampered *earlier* private move hashes and initial genesis even with a warmed prefix, then accepting restored journals and independently reloading from a new service object. Concurrent readers, bounded copies and historical digest regression also passed.
- Total focused PostgreSQL BC-1.5 Go race job: **63.417 seconds**. These are real local PostgreSQL-backed test principals with distinct 420ID signed cookies, **not** an attestation of two unaffiliated users in the currently deployed website.
- [Account Social #45074783559](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45074783559), [Classic Rooms/Rules/Bots #45074783596](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45074783596), [BC-0.12 privacy/release lock #45074783578](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45074783578), [BC-1.2 rules #45074783566](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45074783566), [BC-1.4 browser #45074783546](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45074783546), [Web budget #45074783577](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45074783577), and [CCC multiplayer #45074783631](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45074783631): all success at the exact source commit.

## Performance, rate limits and safety

Before the fix, historical replay was redundantly recomputed on each read
and action; the BC-1.5 full-match job exceeded **16 minutes**. After the
verified-prefix correction the same full-game qualification passed in
32 seconds, with independent cold audits still available.

Accelerated automated matches also encountered the existing
**60-requests/minute** server rate limit (HTTP 429). Only the isolated
integration test fixture advances its test PostgreSQL rate-bucket window,
modeling the elapsed minutes between real human turns. The production
limit, route enforcement and all authentication checks remain unchanged.

## Release boundary and next canonical milestone

The existing BC-0.12 zero-public-release gate still reports **no playable
public Classic games**. Real Render/Cloudflare deployment configuration,
independent external production 420ID account acceptance and subsequent
game-specific release steps remain separate. This source qualification does
not authorize a silent deployment or public Play activation.

**Next: BC-1.6 — authenticated challenge/rematch and match history/social
integration.** BC-1.7–BC-1.8 and final public release remain gated.
