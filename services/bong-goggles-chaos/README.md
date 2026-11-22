# Cross Country Chaos — 420ID account multiplayer authority

**New delivery mode:** each human logs into their **own** BongGoggles 420ID account and interacts with a separate authenticated match projection. The browser never owns a canonical stock, RNG seed, score, opponent's hand or bots. The frozen CCC-1–6 engine and CCC-4 bot strategy now run on this trusted Node service. Unlike the legacy 32-bit local shuffle, every online regional hand and stock is independently CSPRNG-shuffled with Node crypto after the canonical card inventory has been built, so guessing the engine's hazard seed cannot reveal opponents' private cards. No required 420Wallet, wager, staking, on-chain reward, or change to unrelated social sessions.

## Boundary and deployment

The browser uses **only** same-origin `/social-api/v1/chaos/rooms`. The existing Cloudflare Worker forwards that route to the Go BongGoggles Account Social backend. Go independently verifies the HttpOnly 420ID session on **every request**, derives the app-scoped pseudonymous UUID and profile name, validates same-origin writes, and HMAC-signs an exact `method, path, UNIX seconds, subject, display name, sha256(body)` request with its dedicated proxy secret. Only this verified server signature grants access to the Node game authority. Direct Render requests have no signed identity and return 401. The two servers must use separate database least-privilege roles and MUST NEVER pass a browser's `X-Chaos-Subject`, login cookie, or token to the game server as trusted credentials.

Game state (including the secret shuffled stock) is stored only in `bg_account_social.chaos_rooms.data` in PostgreSQL and mutated transactionally under a row lock; `revision` rejects stale/replayed/concurrent turns with 409. Membership is explicit in `chaos_room_members`, with invite codes generated as 192-bit random capabilities. The room creator is seat 1, invitees fill open human seats, bot seats are held by the server, and a 2–4 seat room begins only after every human has joined. Blocking is checked on read/write; fresh 420ID introspection governs the outer API. Server action logic calls existing `chaosActionOptions`, `takeChaosTurn`, `advanceChaosLeg` and bounded `advanceChaosComputerTurns`. Only the viewer's hand and legal options enter `projectRoom`. Other players see public mileage, status, upgrades, discard top, stock count, stage results, and turn ownership without any other hand, full deck, shuffle seed or assigned future legendary cards.

## Operator deployment prerequisites — NOT executed by repository qualification

1. Apply operator-only migration `services/bong-goggles-account-social/migrations/007_chaos_multiplayer.sql` using `go run ./cmd/bong-goggles-social migrate` and the verified separate `SOCIAL420_MIGRATION_DATABASE_URL`. Keep production game runtime **without** migration or moderation privileges. Create a dedicated game DB role with schema USAGE, game-room SELECT/INSERT and column-limited UPDATE (`data,status,revision,updated_at`), membership SELECT/INSERT and blocks SELECT; do not grant access to SSO bearer/session tables or moderation.
2. Provision a separate Node 22+ Render service from this same monorepo: working directory `services/bong-goggles-chaos`, build `npm ci` after pinning a generated lockfile, start `node main.mjs`. It requires `CHAOS_MODE=restricted-acceptance`, `CHAOS_DATABASE_URL` using certificate-verified PostgreSQL, `CHAOS_PROXY_KEY` (independent, high-entropy 32-byte base64url secret), and `PORT`. Health probe `GET /healthz` requires DB connectivity. Direct browsing does not grant match access.
3. On existing Go social Render service set `SOCIAL420_CHAOS_MODE=restricted-acceptance`, `SOCIAL420_CHAOS_ORIGIN=https://<approved-chaos-service>.onrender.com` (the exact controlled Render origin, pathless, HTTPS), `SOCIAL420_CHAOS_PROXY_KEY` (the same secret). Both are backend-only; this does not relax existing 420ID, social, Wallet, moderation or worker auth.
4. Activate the public web route only after proving authenticated end-to-end against real accounts. The previous pass-and-play UI must NOT be silently restored when the service is offline. **Do not deploy sample credentials, guessed database URLs or placeholder hostnames.**

## Player journey

Log into BongGoggles with 420ID; visit `/classics/cross-country-chaos`; create a private 2–4 person room, optionally with Easy/Normal/Hard server computer seats. Share the private invitation code with each other human player. Each person opens that same route from their **own account**, joins the room, and sees **their own** private hand and only their legal move controls. The host starts the first region and continues between regional results. Room state and revision persist across browser closure, server restarts and device changes. The client polls the server for new turns; no shared keyboard/mouse, pass-device prompt, or local game journaling authority is used on the public route.

## Dedicated tabletop and room chat

The authenticated web route uses a compact single-screen tabletop: the stage's
approved atlas with live vehicle positions at the top, the public player tables
and face-up discard/face-down stock in the middle, and the current account's
selectable private cards along the bottom. The public playing area includes
active hazards, equipment, legendary shields and individual played mileage
stacks. On desktop, **Roadside Radio** occupies the right rail instead of the
global community/discovery cards. On mobile it is a collapsible drawer with
an unread indicator.

Room chat is part of the existing server-authoritative match and uses the same
420ID-authenticated, HMAC-signed Go-to-Node proxy. Only joined players can read,
write or report messages. The server derives sender seat/name (not client
claims), strips whitespace controls, limits messages to 280 characters/1024
bytes, rate-limits each seat to one message per 1.5 seconds, and retains
only the latest 80 messages. Messages survive reconnects and region changes.
Chat writes are row-serialized but **never increment the game revision**, so
typing during an opponent's turn cannot invalidate their card action.
Each browser may mute a seat locally; mute is not a global block.

The Report button is available only on another player's message. It stores a
bounded, deduplicated private `chatReports` record within the restricted
`chaos_rooms.data` JSONB; neither reports nor reporter UUIDs are included in
the public room projection. Up to ten submissions per reporter per 24 hours
are accepted, with at most 100 retained per room. The operator can inspect
these records using the existing restricted database-operations boundary.
**A report is a stored flag for manual review, not an automatic ban or an
implemented moderator dashboard.** Social account block restrictions still
prevent access to a match. Do not serve raw stored room data to browsers: it
contains private hands, deck material and private reports.

Public room updates use a four-second no-cache poll while the game is open.
The client compares game revisions and the latest chat message ID to avoid
unnecessary re-renders. During necessary updates it preserves a chat draft,
focus, cursor selection, and the message list's scroll position.

## Verification & limitations

Run `npm test` for the game service, `go test ./services/bong-goggles-account-social ./cmd/bong-goggles-social`, and BongGoggles Web Verification. Test outsider access, private projections, two distinct verified subjects, share-code join, stale move rejection, adversarial payloads, bot actions, fail-closed service outage, responsive screen, session revocation and block restrictions. Prior to public deployment, run a **real PostgreSQL transaction/race test** and independent browsers signed into **two actual 420ID accounts** across the same canonical origin; verify refresh/restart and Render cold-start/recovery, mobile layout, DNS/TLS, worker proxy, secret separation and rollback. GitHub unit tests alone are not proof of live deployment.
