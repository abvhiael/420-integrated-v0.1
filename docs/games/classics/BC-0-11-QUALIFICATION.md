# BC-0.11 — Classic security and integrity qualification

**Status: QUALIFIED — shared Classic security and integrity framework in repository only (2026-11-22 UTC).**

**Qualified exact-head source:** `db2c218f4494485fbde2835f8859184beb8cce76`.

- [BC-0.5–0.10 focused workflow #44982207650](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44982207650) — **SUCCESS** at the qualified SHA: PostgreSQL 16 Go `-race` integration/unit suite, Go vet, backend build, JavaScript syntax and **58/58 targeted Node tests**.
- [Account Social / AUTH regression #44982207654](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44982207654) — **SUCCESS** on the same SHA: verbose PostgreSQL Go `-race` regression (all five `TestBC11*` scenarios PASS), Go static analysis/build and **22/22 browser tests**.
- Existing BC-0.8 bot-expiry regression now updates its synthetic deadline and the corresponding public journal atomically, respecting the strengthened snapshot invariant. Existing Account Social block/rate tests remain passing without relaxing rate limits. No unrelated full-web art or publishing qualification was rerun.


## Security boundaries implemented

- **Trusted rule-module isolation:** a rule callback receives a deep copy of frame scores, private JSON payload and winner reference for validation, legal action discovery, step and view. An uncooperative module cannot mutate the canonical replay input through Go slice or pointer aliasing. Legal actions and steps are double-evaluated and verified against the registered specification/seed.
- **Private view hardening:** seat projections are evaluated twice on independent copies, must be structured JSON, and reject direct random-seed disclosure, raw engine snapshots, opponent-hand/root-level private state and nondeterministic output. Per-game privacy audits remain mandatory; no generic framework can establish the secrecy of arbitrary future module-specific game fields.
- **Command authority:** all game actions use the introspected 420ID session and a human seat; unexpected actor, score, winner, wallet, wager and stake fields are rejected at the strict JSON boundary. Existing turn-owner, legal-move, expected sequence, request UUID, canonical digest, blocked-peer and transactional rules remain enforced.
- **Replay/reconciliation:** private rules trace sequences must be consecutive. The append-only public journal must have a complete sequence from 1 to current and its latest status/deadline/result must equal the saved session projection before accepting reads or writes.
- **Public streams:** public event records must carry only five server-authored lifecycle fields, never hidden cards, random seeds, client scores or raw actions. Account and blocked-peer authorization, event high-water sequence and all returned events are checked in one repeatable-read PostgreSQL transaction; SSE uses the same validated events endpoint.
- **No money:** Classic rooms/sessions remain separate from 420Bet, custody, stakes, prizes, token rewards and settlement. No game-specific rules, AI or production game was activated.

## Actual qualification

Existing focused `.github/workflows/bc-0-5-classic-rooms.yml` runs PostgreSQL 16 `go test -race -tags account420_integration` against Account Social and service entry point, Go vet/build and 420ID/room/shared-games Node tests. The Account Social regression workflow also tests the backend. New `TestBC11*` units/integration exercise module-mutation attacks, concealed view leakage, public event schema spoofing, illegal moves, actor impersonation, scores/wagers/winner injection, idempotency, cross-account replay, forged event payloads and fail-closed restoration. Previously passing BC-0.5–0.10, AUTH and CCC tests remain applicable.

**Qualification bounds:** exact-source CI succeeded, so the canonical milestone may be marked repository-qualified. Green tests do not establish live production deployment, per-game rules correctness or real multi-account game completion.

**Next milestone (not started): BC-0.12 — Qualification pipeline and real multi-account release gating.**
