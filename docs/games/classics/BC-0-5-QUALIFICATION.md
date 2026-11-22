# BC-0.5 — Persistent 420ID multiplayer rooms, invitations and seating

**Qualification:** Repository code **QUALIFIED** (2026-11-21 Saskatchewan time). Production room deployment/activation and live 420ID two-account browser acceptance **not attested**.
**Qualified source commit:** [`42a47b7898990162e82c154a8366384269b55b53`](https://github.com/abvhiael/420-integrated-v0.1/commit/42a47b7898990162e82c154a8366384269b55b53).
**Exact-head Go/PostgreSQL qualification:** [BC-0.5 Multiplayer Rooms #44967583098](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44967583098), completed **success** at the source SHA.
**Exact-head web qualification:** [Bong Goggles Web Verification #44967583182](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44967583182), completed **success** at the same source SHA.

## Implemented behavior

- `/games/rooms` and `/games/rooms/{uuid}` are public *navigation routes* with wallet-optional account authentication. A signed-out user sees an honest Sign In with 420ID entry, not fabricated room data. Authorized 420ID users can browse public rooms, join seats, create private rooms, and view only invited/participated private rooms. A 404 hides private and untrusted IDs.
- New persistent PostgreSQL `classic_rooms`, `classic_room_seats` and `classic_room_invites` with immutable identifiers, host ownership, room visibility, seat counts, server-derived teams, invitation status and strict revision. Existing verified 420ID server cookie and same-origin Origin/CSRF/rate limits are reused; browser credentials, wallet keys, game outcomes and rewards are never handled by this stage.
- Exactly 25 BC roadmap game IDs may create rooms (separate from CCC and the BG-15 on-chain registry). The service enforces each title's min/max of 2–4 seats, a server-controlled first human seat, and a cap of ten non-cancelled rooms per host. Partnership teams place seats 1/3 against seats 2/4 for the four-player partnered games; other configurations are unteamed/free-for-all. The front end displays the same server assignments, including four-player 500.
- A host can invite a *mutual-follow* 420ID friend into an unoccupied seat, or set/replace one of the empty seats with a computer at **easy/medium/hard** difficulty, cancel an invitation, remove a bot, or cancel the room. Invited friends can accept or decline; eligible users can join available public seats, and human occupants can leave. Bot seats are labelled as such and never acquire 420ID principal credentials.
- The Go layer validates both-direction social blocks and current friendship at admission; it locks the authoritative room row and requires an exact `expectedRevision` on every action. Stale, duplicate and conflicting operations are rejected, no client can select a host/acting subject or an arbitrary team, and host-only commands remain restricted. Private departures and failed remote mutations do not leak cached participant details.
- A room becomes **ready** only when all required seats are filled by accepted human participants and/or configured bots. **Ready means a complete lobby, not an active game.** Starting, turns, authoritative results, game-specific rules and actual bot decisions are reserved for BC-0.6 onward. This implementation does not claim live human-human or bot matches are playable.
- The room client validates server response envelopes as `onChain:false`, `wager:false`, `rewards:false`, `playable:false`, bounds room/friend/seat lists, escapes display names, does not cache private sessions, and distinguishes invalid local form input (no POST, keep verified room) from a failed remote mutation (clear private projection). Rooms are default-disabled, with separate `SOCIAL420_CLASSIC_ROOMS=restricted-acceptance` service and `BG_CLASSIC_ROOMS_ACTIVATION=true` Cloudflare opt-in requiring existing AUTH-9 account features. The migration must be applied by the operator with least-privileged runtime grants before turning on rooms.

## Changed files

| Component | Repository files |
|---|---|
| Schema | `services/bong-goggles-account-social/migrations/004_classic_rooms.sql`, `store.go` |
| Go service and HTTP | `classic_rooms.go`, `classic_rooms_actions.go`, `classic_rooms_http.go`, `http.go`, `cmd/bong-goggles-social/main.go` |
| Go tests | `classic_rooms_test.go`, `classic_rooms_integration_test.go` |
| Web shared UI and routing | `bong-goggles/web/core/classic-rooms.js`, `routes.js`, `app-shell.js`, `games-ui.js`, `app.js`, `styles.css` |
| Build activation / budgets | `bong-goggles/web/core/runtime-config.js`, `scripts/account-social-build-config.mjs`, `scripts/build.mjs`, `runtime-config.example.json`, `scripts/qualify-web.mjs` |
| Web tests | `bong-goggles/web/test/classic-rooms.test.js`, `account-social-build-config.test.js`, `app-shell.test.js` |
| Qualification and runbooks | `.github/workflows/bc-0-5-classic-rooms.yml`, `services/bong-goggles-account-social/README.md` |

## Actual qualification and retained limits

- Run **#44967583098**: PostgreSQL 16 database-backed Go `go test -race -tags account420_integration -count=1` for the social service and its Go main **PASS**, including private and public rooms, mutual follows/blocks, invitation decline/reissue/acceptance, seat conflicts and revision CAS, mixed bots, ten-room cap, cancellation and unauthorized access. Go `vet` **PASS**; restricted service Go build **PASS**. Targeted Node account/room regressions: **50/50 PASS**.
- Run **#44967583182**: **400/400 web tests PASS**, **4/4 HTTP tests PASS**, static web checks PASS, default account-disabled build PASS, explicitly activated account-social build PASS, runtime config checks PASS, BG-19.13 asset/accessibility qualification PASS, frontend secret scan PASS.
- Static source growth: **BC-0.5 20,627 / 24,576 bytes**, **BC-0.4 10,842 / 12,288**, **BC-0.3 13,687 / 16,384**, **BC-0.2 7,918 / 8,192**; legacy base **1,184,143 / 1,184,768** bytes. Existing per-file JS/CSS and all 49 CCC card, six map and six vehicle asset budgets/manifest checks remain enforced. No blanket budget increase was made.
- Earlier source CI found a fixed navigation inventory test and a new Go test requiring isolated login test source IPs to preserve the existing distributed rate limiter; the correction did not weaken assertions or production authorization. A later scoped fix ensured invalid local forms do not clear verified rooms, while failed server mutations do. The final exact-head runs above are green.

## Verified live deployment blocker and boundary

- [BongGoggles live 420ID sign-in smoke #44967121073](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44967121073) **failed** before exercising room endpoints: the canonical **420ID health returned HTTP 200**, but `https://bonggoggles.420integrated.org/social-api/healthz` returned **HTTP 502 in nine consecutive probes**. This is a verified unavailability of the existing live Account Social ingress/runtime, not evidence of a source test failure. Production room deployment and two actual 420ID accounts' live room flow were not qualified.
- The current live runtime requires the operator to restore the Account Social service/Cloudflare ingress, apply migration 004 plus the scoped grants recorded in the account-social README, set `SOCIAL420_CLASSIC_ROOMS=restricted-acceptance`, and only then explicitly enable `BG_CLASSIC_ROOMS_ACTIVATION=true` on the Pages build. No tool operation in this task changed production account secrets or performed a migration against the live database; do not report rooms operational until independently verified.
- Cross-Country Chaos PR #1314 remained separate and was not merged or modified. Wallet-linked BG-15 game sessions and all previously qualified BC-0.1–0.4 states are preserved.

**Roadmap:** BC-0.5 **QUALIFIED (repository)**; BC-0 overall **IN PROGRESS**, with live room rollout not accepted. **Next canonical step: BC-0.6 — Authoritative off-chain sessions.** It has not been started here.
