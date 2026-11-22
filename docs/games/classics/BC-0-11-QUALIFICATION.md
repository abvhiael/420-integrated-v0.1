# BC-0.11 — Classic security and integrity qualification

**Status: source implementation committed; final exact-head qualification pending.**

## Security boundaries implemented

- **Trusted rule-module isolation:** a rule callback receives a deep copy of frame scores, private JSON payload and winner reference for validation, legal action discovery, step and view. An uncooperative module cannot mutate the canonical replay input through Go slice or pointer aliasing. Legal actions and steps are double-evaluated and verified against the registered specification/seed.
- **Private view hardening:** seat projections are evaluated twice on independent copies, must be structured JSON, and reject direct random-seed disclosure, raw engine snapshots, opponent-hand/root-level private state and nondeterministic output. Per-game privacy audits remain mandatory; no generic framework can establish the secrecy of arbitrary future module-specific game fields.
- **Command authority:** all game actions use the introspected 420ID session and a human seat; unexpected actor, score, winner, wallet, wager and stake fields are rejected at the strict JSON boundary. Existing turn-owner, legal-move, expected sequence, request UUID, canonical digest, blocked-peer and transactional rules remain enforced.
- **Replay/reconciliation:** private rules trace sequences must be consecutive. The append-only public journal must have a complete sequence from 1 to current and its latest status/deadline/result must equal the saved session projection before accepting reads or writes.
- **Public streams:** public event records must carry only five server-authored lifecycle fields, never hidden cards, random seeds, client scores or raw actions. Account and blocked-peer authorization, event high-water sequence and all returned events are checked in one repeatable-read PostgreSQL transaction; SSE uses the same validated events endpoint.
- **No money:** Classic rooms/sessions remain separate from 420Bet, custody, stakes, prizes, token rewards and settlement. No game-specific rules, AI or production game was activated.

## Actual qualification

Existing focused `.github/workflows/bc-0-5-classic-rooms.yml` runs PostgreSQL 16 `go test -race -tags account420_integration` against Account Social and service entry point, Go vet/build and 420ID/room/shared-games Node tests. The Account Social regression workflow also tests the backend. New `TestBC11*` units/integration exercise module-mutation attacks, concealed view leakage, public event schema spoofing, illegal moves, actor impersonation, scores/wagers/winner injection, idempotency, cross-account replay, forged event payloads and fail-closed restoration. Previously passing BC-0.5–0.10, AUTH and CCC tests remain applicable.

**Expected bounds:** exact source SHA and successful run IDs are required before marking the canonical roadmap qualified. Green tests do not establish live production deployment, per-game rules correctness or real multi-account game completion.

**Next milestone (not started): BC-0.12 — Qualification pipeline and real multi-account release gating.**
