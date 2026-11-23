# BC-2.5 — Authenticated human Labyrinth Cribbage multiplayer

**Source:** current-main BC-2.4, rule identity `bc-labyrinth-cribbage-325@2.0.0`. This step does **not** change 325-point scoring, the approved board or canonical rules hash.

## Implementation

- **Lobby and consent:** existing 420ID ClassicRooms public/private lobby, mutual-friend invite/accept/decline/cancel, 2–4 seats, per-seat Easy/Medium/Hard bot assignment and immutable four-seat partnership vs individual teams. Host-only ready-room start is still authenticated and bound to the qualified v2 engine.
- **Human play:** each private hand and legal action is derived from server-verified `/v1/classic-sessions/:id` responses. POST `/action` uses a fresh UUID, expected sequence, legal move, and server confirmation. Existing server checks 420ID seat, bans/blocks, turn seat, durable PostgreSQL atomicity, idempotency and 120-second authoritative turn expiry. The client never computes or submits scores.
- **Reconnect and terminal lifecycle:** the same session is re-read after refresh, re-entry, network online and page visibility. Resigned, timed-out and cancelled authoritative session responses now remain displayable; they may not create a new move, but show server status, last authoritative scores, declared winner (if any), and UTC-derived turn deadline. Revoked 420ID access clears private cards.
- **Operator registration:** `SOCIAL420_LABYRINTH_MODE=restricted-acceptance` independently pins the compiled 325-point rules identity and all three difficulty policies, retains the pre-existing standard Cribbage resolver/bots, and requires the already-qualified room, session, journal and communications dependencies. A separate Labyrinth rematch preflight checks existing least-privilege match-request grants; ordinary Cribbage social history/challenges remain independently gated. No operator opt-in is set by this PR or by a browser request.
- **Rematch:** a terminal human participant can request an off-chain, zero-wager rematch through the existing authenticated endpoint. Backend now supports Labyrinth as well as standard Cribbage, preserving 2/3/4 seat counts, fixed 325-point v2 rules identity, individual vs partnership team layout and bot difficulty, rechecking human blocks, rotating requesting host to seat zero, and requiring every other human to explicitly accept an invitation. A request-ID replay returns the existing room, a distinct replay conflicts, and only a server-verified lobby can be navigated to.

## Focused acceptance

`.github/workflows/bc-2-5-labyrinth-multiplayer.yml` pins the exact PR head, runs the new Node terminal/resign/rematch/identity tests and retained Labyrinth UI/session regressions, and runs PostgreSQL 16 `-race` with two independent 420ID cookie principals, 120-second deadline expiration simulated against the database clock, both four-seat format rematches, and the existing BC-1.6 Cribbage challenge/rematch test. A separately gated activation parity test and Go vet are included.

BC-2.5's independently measured UI growth is capped at 6 KiB over the four pinned BC-2.4 source-file baselines; the previously qualified BC-2.4 52 KiB and earlier source/art budgets remain unchanged.

**Qualification must not be asserted until the exact-head CI jobs pass.** A passed local/CI suite is not proof of a real deployed two-account match. Public live acceptance, including the owner-deferred intermittent Render free-tier HTTP 502, remains separate and required at BC-2.8 release.

## Safety

- Never accept a terminal result, room or rematch from a non-420ID response, a stale sequence, a wrong rules hash or a changed principal.
- No local card generation, scoring, opponent-hand exposure, wallet transaction, stake, wager or on-chain session impersonation.
- Preserve standard Cribbage's separate history/challenge/rematch and its original board and navigation fixes.
