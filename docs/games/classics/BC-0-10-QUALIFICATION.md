# BC-0.10 — Classic communications qualification

**Status: IMPLEMENTED; source-exact qualification under way.** Do not promote BC-0.10 to QUALIFIED until the actual PostgreSQL/Go race and targeted web tests complete successfully at the implementation SHA. No production Classic game activation.

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

Current whole-web packaging may fail on pre-existing Cross-Country Chaos UI source-size growth in `app.js`: its BC-0.5 historical budget is unchanged; BC-0.10 must not weaken or bypass this gate. No tests assert production deployment or real human-to-human completed game; game-specific rule engines and 420ID live browser E2E remain separately gated.

**Next milestone after qualification:** BC-0.11 — Zero-wager/integrity, *not started*.
