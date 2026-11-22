# BC-0.10 — Classic communications qualification

**Status: QUALIFIED — shared communications framework in repository only.** Exact-head qualification completed November 22, 2026 UTC. No production Classic game activation or end-to-end live deployment claimed.

**Qualified source SHA:** `6fb1852be6fbe1fe2d7a735fdaeec67300674944`

**Exact-head [BC-0.5–0.10 focused workflow #44979666977](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44979666977) — SUCCESS.** PostgreSQL 16 `go test -race -tags account420_integration`, Go vet, restricted Go service build, JS syntax and **58/58 targeted Node tests** (zero failures). Both new BC-0.10 PostgreSQL tests and seven browser communication cases ran with existing room, replay, bot, account and game regressions.

## Repository changes

- Operator-only additive migration `008_classic_communications.sql` creates durable cross-process per-account presence with a PostgreSQL-clock 20-second lease and index; runtime may SELECT/INSERT and update only last_seen, not identity columns, or DELETE.
- `classic_communications.go` checks explicit least-privilege grants, 420ID human-seat admission and active block policy; renewed presence is serialized with seat admission/revocation. Responses contain only per-seat booleans, not private hand state or device IDs. Heartbeats have their own bounded rate-limit bucket so they cannot exhaust ordinary social posts/moves.
- Account-hosted GET/POST presence routes use the existing exact HTTPS host, introspected 420ID cookie, CSRF/Origin and strict empty POST body. No wallet or client-chosen online/subject.
- Browser `classic-communications.js` uses 5-second visible-tab, same-origin authenticated polling as a proxy-safe equivalent to push. It rechecks 420ID subject twice, room revision, server-authoritative session snapshot, contiguous public event journal and event gaps (>50), and invalidates stale in-flight work. It drops the privateView payload entirely after validating seat ownership. Reconnect/401/403/404/503 hide cached private information.
- Live seat summaries and turn notices are inert/accessible. Online, visibility-change, navigation and reload recovery use fresh server projections. No local score, match or turn authority and no browser-provided random game results.
- Runtime/app activation requires separately opt-in `SOCIAL420_CLASSIC_COMMUNICATIONS=restricted-acceptance` plus existing room/session services and verified DB grants. Cloudflare build uses separate `BG_CLASSIC_COMMUNICATIONS_ACTIVATION=true` only alongside explicitly activated 420ID and rooms; both default false.

## Test and release contract

Focused exact-head CI workflow: `.github/workflows/bc-0-5-classic-rooms.yml`.
Go PostgreSQL 16 race suite (integration build tag `account420_integration`) exercises actual participant presence, spoof denial, block revocation, concurrent same-subject devices, lease expiry, process restart, expired/forward event cursors, immutable public event privacy and pre-existing BC-0.5–0.8 safeguards. Go vet and service build. Node tests cover multi-account synchronization, 420ID rotation, revision conflicts, reconnection snapshots, turn notices, redaction, render safety and activation flags. Static JS syntax checks.

**Independent whole-web qualification limitation:** [Bong Goggles Web Verification #44979402532](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44979402532) ran **429/429 browser tests** plus **4/4 public-feed tests** successfully, but the BG-19.13 static size check failed on `app.js`: **8,386 bytes growth** against the inherited **3,584 byte** BC-0.5 allowance. Current main's pre-BC-0.10 `app.js` was already 37,061 characters versus the 30,434-byte baseline plus 3,584-byte allowance. Concurrent CCC account multiplayer work expanded that same root file; BC-0.10's room-specific source was split out and kept under the 16 KiB allowance, but the older app-level cap remains failing. This check was neither skipped nor weakened; a successful full-web release is not asserted. No tests assert production deployment or real human-to-human completed game; game-specific rule engines and 420ID live browser E2E remain separately gated.

**Next milestone after qualification:** BC-0.11 — Zero-wager/integrity, *not started*.
