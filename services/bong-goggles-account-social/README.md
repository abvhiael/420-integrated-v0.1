# AUTH-8 — Wallet-independent BongGoggles social activity

**Repository implementation:** a separate, off-chain and app-owned BongGoggles
community surface for verified 420ID accounts. This is NOT the canonical
on-chain BongGoggles feed, 420Wallet authority, rewards or Identity420/Names420.
No wallet is needed to authenticate, read community posts, publish, comment,
like, follow, block, report or update a local display profile.

## Authority and privacy

- 420ID AUTH-7 issues a **BongGoggles-scoped** SSO subject only after verified
  email/passkey authentication, registered client and explicit user consent.
  AUTH-8 never receives the internal 420ID account ID, cross-app subject,
  email, wallet address, passkey or account recovery material.
- The new `bg_account_social` PostgreSQL schema owns only the off-chain
  community's members, posts, comments, likes, follows, blocks, reports,
  limited-rate counters and encrypted browser sessions. Canonical on-chain
  contracts/indexers and original wallet-backed UI remain separate and
  unchanged. No off-chain action is labeled a blockchain transaction or paid
  reward. A future canonical bridge requires a separate authorized design.
- The BongGoggles backend initiates top-level 420ID SSO with a 256-bit random
  state and PKCE S256 verifier, protected with an HttpOnly Secure SameSite=Lax
  host-only flow cookie. The central registered callback is exactly
  `https://bonggoggles.420integrated.org/social-api/auth/callback`.
  Login flows expire after five minutes and are atomically consumed before
  confidential token exchange; callback substitution and duplicate redemption
  fail closed. The signed-in app stores its 420ID bearer **encrypted at rest**
  using AES-GCM with a separately managed 256-bit key, and gives the browser
  only a distinct random HttpOnly Secure host-only app cookie (digest stored
  in PostgreSQL). No account/bearer secrets, tokens, session cookies or
  PKCE verifier are stored in localStorage, exposed to JavaScript, put in
  an application URL or delivered cross-origin.
- Every API request confidentially introspects the SSO session against
  420ID, including account suspension, logout and revocation. Unavailable
  420ID means 503 (no stale-authority fallback); invalid, expired or
  cross-account session means 401. App logout removes the browser session
  immediately and attempts to revoke that app's SSO session; it cannot
  revoke unrelated application sessions. Security headers, no-store,
  exact Host and HTTPS ingress, strict same-origin POST/PUT/DELETE, bounded
  JSON and no CORS are mandatory.
- Server-side records use only a pseudonymous app-scoped UUID. Posts are
  visible to **authenticated** community members only, not anonymous
  browsers. Feed and comment queries recheck both directions of blocking,
  exclude self-deleted and moderation-hidden posts, and never trust a
  caller-selected author/account ID. Following and blocking serialize
  against both member rows; blocking clears prior follow edges. Soft deletion
  removes a post from all feed/comment/reaction eligibility. Reports are
  private operator-review records, not an automatic takedown.
- Moderate only through the **operator-only** command with a separate
  migration/administration database credential:
  `bg-social moderate <post-uuid> hide|restore <reason>`.
  Every decision is retained in an append-only moderation log. Runtime
  SQL grants must NOT permit writing `posts.hidden_at`, moderation events
  or reviewing report records from the public HTTP process.
- Distributed PostgreSQL rate counters bound login starts and authenticated
  writes; operational edge firewall/bot rules are still required for actual
  public traffic. No user-supplied app/account/wallet address controls limits.

## Explicit restricted deployment (not performed by this PR)

The 420ID `sso-acceptance` mode now uses its own source app ID `420id`,
rather than `bong-goggles`, allowing BongGoggles to be a separate
confidential **destination**. This does not modify the older AUTH-2–6 modes;
it requires a newly approved 420ID SSO client manifest entry for
`bong-goggles` with the *actual* callback and an independent random secret,
plus migration 008 and its qualified grants. Other participating apps stay
scoped to their own registered client.

The separate Go social service is deliberately inert unless
`SOCIAL420_MODE=restricted-acceptance`. Use:

- `SOCIAL420_ORIGIN=https://bonggoggles.420integrated.org`
- `SOCIAL420_AUTH_ORIGIN=https://auth.420integrated.org`
- `SOCIAL420_CALLBACK_URI=https://bonggoggles.420integrated.org/social-api/auth/callback`
- `SOCIAL420_CLIENT_SECRET`: independent 32 random bytes, base64url, held in backend secret environment only
- `SOCIAL420_SESSION_KEY`: independent 32 random bytes, base64url, for AES-GCM; do not rotate without a session migration/invalidating sessions
- `SOCIAL420_DATABASE_URL`: certificate-verified, least-privileged social runtime PostgreSQL URL
- `SOCIAL420_TLS_TERMINATION=trusted-proxy`; Cloudflare/Render ingress must verify TLS and forward the validated canonical host and proto
- `SOCIAL420_OPERATOR_REF`: operator ID for audited moderation commands only (not in the runtime environment)
- `SOCIAL420_MIGRATION_DATABASE_URL`: separate operator-only migration/admin connection, **never** present in running service

Run `bg-social migrate` only with the operator connection; the service
never executes schema DDL on startup. Run all social HTTP endpoints behind
the **same-origin** `/social-api/*` reverse-proxy route at the canonical
BongGoggles host. Do not expose a default Render hostname directly.
No Cloudflare proxy route, Neon social schema or external SSO client secret
has been installed automatically by this repository change.

Minimal runtime privileges for a dedicated `bonggoggles_social_runtime` role
(operator must verify inheritance and default privileges separately):

```sql
GRANT USAGE ON SCHEMA bg_account_social TO bonggoggles_social_runtime;
GRANT SELECT, INSERT ON bg_account_social.members, bg_account_social.posts,
  bg_account_social.comments TO bonggoggles_social_runtime;
GRANT INSERT ON bg_account_social.reports TO bonggoggles_social_runtime;
GRANT UPDATE(display_name,bio) ON bg_account_social.members TO bonggoggles_social_runtime;
GRANT UPDATE(deleted_at) ON bg_account_social.posts TO bonggoggles_social_runtime;
GRANT SELECT, INSERT, DELETE ON bg_account_social.reactions,
  bg_account_social.follows, bg_account_social.blocks,
  bg_account_social.sessions, bg_account_social.login_flows
  TO bonggoggles_social_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON bg_account_social.rate_buckets TO bonggoggles_social_runtime;
```
The runtime must not receive unrestricted table UPDATE/DELETE, the
`moderation_events` table grants, any `account420` schema rights, or
the 420ID client secret via browser bundles.

The existing BongGoggles static site exposes `/social` with
`features.accountSocial=false` by default. Only after verifying the
real same-host proxy, 420ID confidential registered callback,
database migration/grants, rate-limit and moderation operations,
privacy-safe external browser sessions and incident rollback may an
operator enable that flag. The old wallet/chain-based social routes and
DISCOVER projection remain unchanged. The new feed explicitly labels
its records as off-chain and never merges them into canonical feeds.

## Qualification and deferred acceptance

Dedicated PostgreSQL 16 race tests verify email/passkey-derived app
identity modeled by the independently qualified 420ID SSO broker, encrypted
and single-use app sessions, revocation and outage denial, persistent
posts/comments/reactions, block/mute audience gating, reporting, moderation,
input validation, write throttling, and authorization failures.
Node 22 verifies UI route access without a wallet, exact same-origin API
calls, feed schema, XSS escaping and fail-closed session handling. Existing
AUTH-7 tests already qualify the separate confidential 420ID issuer.
A simulated in-process broker is NOT a real cross-domain browser sign-in:
real Render/Cloudflare/Neon/Resend, physical passkey, HTTPS SSO and
moderation ingress/rollback drills remain externally unqualified.
Do not claim the public site has been activated based on CI alone.


## AUTH-9 — wallet-independent account messages and games

**Scope:** wallet-free AUTH-7 app-scoped social members can have private
one-to-one conversations and play two explicitly **off-chain**, zero-wager
turn-based quick games in the same BongGoggles account app. Existing
`/messages` (canonical 420Messenger) and `/games` (canonical BG-15)
routes remain **wallet-backed and authoritative for their separate
protocols**; the new browser routes are `/account/messages` and
`/account/games`. No transport bridges, account-to-wallet
auto-associations, canonical Messenger encryption claims, on-chain game
transactions, tournament scores, token rewards, XP, wagers, payments or
payouts are created.

### Messaging boundaries

- `POST /social-api/v1/messages` sends from the **freshly validated**
  420ID-scoped BongGoggles session (never a caller-supplied sender) to
  another registered social member; both directions of the existing
  AUTH-8 block graph must permit the send. An atomic member-pair lock
  serializes sends against follow/block operations.
- `GET /social-api/v1/messages` returns at most 50 visible conversation
  peers and last timestamps, **not public message content**.
  `GET /social-api/v1/messages/{peerSubject}` returns the newest 100
  messages visible only to the involved viewer, sorted oldest-first
  within the page. It rechecks blocks and per-side deletion.
  `DELETE /social-api/v1/messages/item/{messageId}` hides one message
  from the requesting participant; it never deletes the other
  participant's copy.
- Message bodies are encrypted **at rest** using AES-256-GCM with random
  nonces and AAD bound to message ID, sender and recipient. The separate
  secret `SOCIAL420_MESSAGE_KEY` must be independently generated from
  `SOCIAL420_SESSION_KEY`; both remain in backend secret custody.
  This is **server-side encryption, not end-to-end encryption**:
  trusted service operators with the message key can decrypt stored
  messages, unlike the separate 420Messenger encrypted-envelope protocol.
  The UI states this explicitly. No cleartext message body is stored
  in PostgreSQL or sent in a push/public feed. Browser results are
  `no-store`, use only same-origin credentials and never persist
  private content in localStorage.
- Revoked, suspended, expired or unavailable AUTH-7 SSO fails closed,
  as in AUTH-8. All mutation requests enforce exact Origin, TLS host,
  strict JSON and distributed write limits. Private messages never
  become on-chain rewards or social posts.

### Zero-wager quick games

- `POST /social-api/v1/account-games` issues an invitation for either
  `tic_tac_toe` (3×3) or `connect_four` (7×6 gravity). Only the invited
  account may accept/decline, within 24 hours. The inviter makes
  the first move, and participants alternate. Game type and player
  subjects are server-bound; callers cannot submit a winner, wager,
  score, payout, RNG outcome, blockchain transaction or token fee.
- `GET /social-api/v1/account-games` returns at most 50 current/past
  games to a signed-in participant; `GET .../{gameId}` returns only
  participant-visible board and move history. Both check the block
  graph and never publicly disclose opponents' histories.
- `POST .../{gameId}/respond` requires explicit `accept: true|false`.
  `POST .../{gameId}/move` requires a legal position and the exact
  `expectedMove` (one higher than the stored move count). The server
  selects X/O and applies gravity for Connect Four, derives
  horizontal/vertical/diagonal wins and draws, and atomically records
  the board, next turn, terminal status and numbered move inside a
  PostgreSQL row-locked transaction. Concurrent/replayed or
  out-of-turn moves fail rather than double-spend a turn.
- Terminal game records are immutable to the app API. These are free
  off-chain practice/friendly games. They **do not** upgrade a social
  user to an on-chain BG-15 player, settle a wager, verify canonical
  rankings or issue tokens. The two supported local quick games
  are intentionally separate from the seven canonical BG-15 rulesets.

### Activation and schema

Migration `002_account_messages_games.sql` extends the dedicated
`bg_account_social` schema. It is applied only by the existing
operator-only `bg-social migrate` command; runtime still has no DDL
authority. Enable the backend only with
`SOCIAL420_ACCOUNT_EXTRAS=restricted-acceptance` **and**
a separate 32-byte Base64url `SOCIAL420_MESSAGE_KEY`.
Unknown activation values and weak/reused keys fail startup. Default
(non-activated) AUTH-8 server responds 404 on all AUTH-9 endpoints.
Frontend `features.accountMessaging` and `features.accountGames`
default false and require `features.accountSocial=true` in the
validated configuration; enabling a frontend flag alone cannot create
backend authorization or deploy a service.

Add least-privilege runtime grants **after** operator migration:
```sql
GRANT SELECT, INSERT ON bg_account_social.direct_messages
 TO bonggoggles_social_runtime;
GRANT UPDATE(sender_deleted_at,recipient_deleted_at)
 ON bg_account_social.direct_messages TO bonggoggles_social_runtime;
GRANT SELECT, INSERT, UPDATE ON bg_account_social.account_games
 TO bonggoggles_social_runtime;
GRANT SELECT, INSERT ON bg_account_social.account_game_moves
 TO bonggoggles_social_runtime;
```
Only the operator identity may manage schema, grant roles, inspect reports,
or change moderation events. Before a public launch, deploy and verify
the actual 420ID confidential client, Render service and Cloudflare
same-origin `/social-api/*` ingress, real email/passkey sign-ins,
key custody, outage/revocation, performance and safety moderation.
This repository qualification does not establish those live conditions.

### Focused qualification

Go race-enabled PostgreSQL tests cover message ciphertext privacy and AAD
binding, participant-only access, blocking, one-sided deletion, session
revocation and provider failure; game invite identity, acceptance/expiry,
server-calculated winners, ordering, history and concurrency replay,
Connect Four gravity, terminal immutability and no wager/rewards.
Node tests cover wallet-free routing, disabled-by-default flags,
secretless same-origin access, XSS-safe content, game move displays and
authoritative app-session failures. AUTH-8 account social remains
previously qualified; only affected regression suites are included.


## AUTH-10 — community contribution and off-chain XP v1

**Source of truth:** `bg_account_social.contribution_xp_events`, a
private, append-only PostgreSQL journal indexed by the AUTH-7/8
BongGoggles-scoped opaque subject. Never use a wallet address, 420ID
internal subject, email, game score, on-chain rewards projection or
browser-supplied member identifier to issue XP.

This is **non-economic, non-redeemable, off-chain community recognition**.
XP does not give a right to 420Token, staking/reward pools, loot, wagers,
credit, a token discount, a Creator payout or any external privileges.
It is not the canonical BongGoggles Rewards/ContributionRegistry420
accounting and cannot be submitted to reward distributors or the
canonical indexer. It is available only to its authenticated owner.
Public leaderboards and cross-app XP are deliberately not exposed.

### Frozen, versioned XP policy v1

- Original off-chain **post:** 5 XP when the stored body has at least
  25 Unicode characters after trimming; maximum **three awarded
  posts per subject per UTC calendar day** (15 XP per day).
- Original off-chain **comment on another member's post:** 2 XP when
  the body has at least 15 Unicode characters after trimming;
  maximum **ten awarded comments per subject per UTC day** (20 XP/day).
  A self-reply never earns XP.
- Each normalized (case-insensitive, trimmed) body may earn XP only
  **once per subject and source type for all time**, even if copied,
  restored or submitted concurrently. New posts/comments beyond limits
  remain valid social content but have zero XP credit. Limits count
  awarded grants even if later revoked to prevent delete/repost farming.
- Likes, follows, blocks, report submissions, messages, zero-wager
  games, wallet sign-in, 420Names and all on-chain events earn **zero
  XP** from this service. No browser can request an XP amount or a
  new action type. Unknown policy version/source type fails closed.
- Account XP = sum of committed grant/revoke journal entries. Level
  = `floor(max(0,totalXP)/100)+1`. A level has **no separate
  permissions or financial meaning**. User-facing history lists at most
  30 recent events; date and daily counters use UTC.

**Atomic issue and reversal:** `PublishPost` and `PublishComment`
create the social object and (if eligible) the XP grant in one
PostgreSQL transaction, holding the subject's membership row lock to
serialize caps across workers. Comment creation also locks the parent
post and checks the existing bidirectional block graph. The source
object ID has a **single grant** and at most **one compensating revoke**
by a uniqueness constraint. Deleting an author's post or hiding it via
operator moderation atomically reverses the post's award **and the
awards earned by all contributing commenters on that post**; the
journal remains append-only. Restoring a hidden post does not issue
a fresh grant or resurrect a spent daily allowance. No silent
background/batch recomputation invents rewards. Moderation continues
to use the private operator credential and appends the same audit trail
as AUTH-8. Historical contributions created before activation are not
retroactively credited.

### Explicit activation

The operator-only `bg-social migrate` command now applies
`003_contributions_xp.sql` after migrations 001–002.
The existing AUTH-8 and AUTH-9 runtime modes do **not** require the
new XP grants or query the XP journal. Only
`SOCIAL420_XP_MODE=restricted-acceptance` enables the issuer,
private `GET /social-api/v1/xp` endpoint and atomic write paths.
Unrecognized modes fail startup. When running privileged
`bg-social moderate ...` with XP mode enabled, that same mode must be
present so the operator hides content and writes reversals together.
The operator must never manually hide eligible posts in SQL
without the XP-aware moderation path; the public runtime account
cannot update `hidden_at`.

Grant both read and append rights to the dedicated social runtime role:
```sql
GRANT SELECT, INSERT ON bg_account_social.contribution_xp_events
 TO bonggoggles_social_runtime;
```
The startup gate verifies **SELECT and INSERT independently**, because
PostgreSQL treats a comma-separated privilege check as *either* privilege.
It also rejects UPDATE, DELETE, TRUNCATE and column-level UPDATE on the
journal for the runtime connection. Keep the operator/migration owner
separate: it uses the privileged `SOCIAL420_MIGRATION_DATABASE_URL` for
schema maintenance and XP-aware moderation, not the runtime connection.
Do **not** grant mutation privileges on the journal or direct browser access.
The operator credential may manage schema, inspect reports and execute
moderation; no extra app identity, wallet or CORS audience is added.

The web route `/account/xp` and `features.accountXP` are also **off
by default**. `accountSocial=true` is additionally required before
the validator permits `accountXP`; enabling the flag alone does not
activate a live server. The dashboard calls only the same-origin
`/social-api/v1/me` and `/social-api/v1/xp` endpoints through
a fresh 420ID browser cookie, never saves point totals or history in
localStorage, and clears sensitive content on an unavailable/revoked
session. All totals are presented as off-chain and nonredeemable.
BongGoggles' canonical wallet-based `/rewards` remains unchanged.

### Qualification and external acceptance limits

Focused PostgreSQL 16 `go test -race` suites must demonstrate atomic
issuance/revocation, repeat and concurrent submission suppression,
UTC caps, self-reply exclusion, cross-subject separation, 420ID logout
and provider-outage denial, a private subject-only read API and
least-privilege SQL journal grants. Focused Node browser tests must
exercise disabled flags, authenticated 420ID state, no-wallet access,
forged totals/subjects and non-economic labels; existing AUTH-8/9
Go/browser tests stay passing. The dedicated GitHub workflow records
the exact qualified commit SHA.

This repository task does **not** provision Neon schema, restricted
runtime DB grants, the 420ID confidential SSO client, Cloudflare
same-host `/social-api` routing, Render runtime, deployment secrets
or live end-to-end browser acceptance. XP remains disabled until those
operator-controlled prerequisites, privacy, moderation, rollback and
abuse tests are independently qualified.


## AUTH-11 — Wallet-free monetization and rewards programme readiness

The existing AUTH-8/9/10 member service stays independently available.
With `SOCIAL420_MONETIZATION_MODE=restricted-acceptance`, its
`GET /social-api/v1/monetization` returns only the authenticated user's
freshly 420ID-introspected participation consent and readiness stage.
Unknown modes fail startup and the endpoint is 404 when disabled.
No write/accept/claim/settlement API is installed in the social service.

A confidential backend-only 420ID SSO introspection call rechecks the
source account and child app session and returns the consent data without
a wallet address, email, internal account ID, bearer or monetary amount.
An unconfigured central `monetization-acceptance` mode or unknown field
values fails closed, rather than trusting cached browser or historical
permission. The public route `/account/monetization` uses the same-origin
420ID cookie and a separate default-off `features.accountMonetization`
flag, gated by `features.accountSocial=true`. No wallet is required to
read or participate in ordinary community features.

BongGoggles' existing wallet-backed `/rewards` remains the only canonical
reward lifecycle UI. Post creation, off-chain XP, profile level, free games,
a 420ID programme opt-in, and a merely linked wallet confer **no** claim
or payout. Valid canonical source, verifier, funded campaign, accrual,
beneficiary and separately wallet-confirmed on-chain claim/release remain
mandatory. Creator monetization requires a separately verified operator
programme and actual canonical payment source. Do not present `wallet_required`
as a payment obligation or `canonical_verification_required` as an earned
reward.

**Not live:** The opted-in 420ID service, social runtime, independent
database migration/grants, confidential SSO client, reverse proxy and real
browser integration are external deployment/acceptance boundaries; this
repository change does not activate accounts, campaigns or payouts.


## AUTH-12 — restricted runtime safety and privacy

`Store.ReadyRuntime` now enforces both the **required** permissions and
the absence of forbidden powers for the public serving credential.
PostgreSQL's `has_table_privilege(...,'SELECT,INSERT')` accepts either
privilege; readiness now requires the individual SELECT and INSERT
permissions, and likewise tests each other required grant. The public
social role must not read/change reports, write moderation events, set
`posts.hidden_at`, update/delete whole posts or comments, or delete
members. Full-table UPDATE on comments was unused by the application
and is no longer required or accepted: grant **SELECT,INSERT only**.

Request JSON property names must be ASCII and unique after
case-folding; Unicode and escaped duplicate aliases, oversized bodies
and trailing JSON are rejected. Existing Origin, TLS, rate, 420ID SSO
and app-session boundaries remain unchanged. No changes authorize
paid features, wallet spending, token payout or XP-to-420 conversion.

See `docs/audit/AUTH-12-SECURITY-PRIVACY-QUALIFICATION.md`.


## BC-0.5 — opt-in, zero-wager, wallet-free Classic multiplayer rooms

These rooms are persistent 420ID lobbies, not active matches or game
engines. They have no wallet identity, game moves, score, rewards, stake or
financial authority. Migration 004_classic_rooms.sql is applied only
through the existing operator-only bg-social migrate command.

The runtime must use these additional LEAST-PRIVILEGE grants, applied
only after the migration, on the existing bonggoggles_social_runtime role:

    GRANT SELECT,INSERT ON bg_account_social.classic_rooms,
      bg_account_social.classic_room_seats,
      bg_account_social.classic_room_invites TO bonggoggles_social_runtime;
    GRANT UPDATE(status,revision,updated_at) ON
      bg_account_social.classic_rooms TO bonggoggles_social_runtime;
    GRANT UPDATE(controller,subject,difficulty) ON
      bg_account_social.classic_room_seats TO bonggoggles_social_runtime;
    GRANT UPDATE(status,updated_at) ON
      bg_account_social.classic_room_invites TO bonggoggles_social_runtime;

Never grant full-table UPDATE/DELETE, permission to rewrite a room
host/game/visibility/team/seat count or an invitation target, or schema
DDL to the runtime. ReadyClassicRooms checks required grants and rejects
unsafe write permissions before activation.

Enable the server ONLY after the existing
SOCIAL420_ACCOUNT_EXTRAS=restricted-acceptance gate is qualified:
SOCIAL420_CLASSIC_ROOMS=restricted-acceptance. Any unknown activation
value fails startup; disabled/absent returns 404 for room routes.
After the backend is qualified, explicitly enable both Cloudflare Pages
text build settings BG_ACCOUNT_SOCIAL_ACTIVATION=true and
BG_CLASSIC_ROOMS_ACTIVATION=true. The latter defaults to false, can be
rolled back independently, and must not be set before the server is ready.
Do not change the 420ID SSO cookie or Cloudflare same-origin proxy.

The same-origin, freshly introspected 420ID routes are:
- GET /social-api/v1/classic-rooms: public/participant/invited rooms (max 50)
- GET /social-api/v1/classic-rooms/friends: mutual, unblocked 420ID friends
- POST /social-api/v1/classic-rooms: gameId, visibility, seatCount
- GET /social-api/v1/classic-rooms/{uuid}: authorized seat/invite detail
- POST /social-api/v1/classic-rooms/{uuid}/change: action,
  expectedRevision, seat, and optional target/difficulty.

Room actions: invite a mutual friend, accept, decline, cancel-invite,
join a public vacant seat, leave, bot, clear-bot, or cancel-room.
The server binds human seats to the verified 420ID principal, checks
friendship and bidirectional blocks, enforces canonical 25-game seat
limits, derives partner teams and supports computer-seat difficulty
easy/medium/hard. A PostgreSQL row lock and expected revision reject
concurrent or replayed seat mutations. Only the host can configure
bots or cancel invitations/rooms. Private room details are not available
after a member leaves or declines. Complete occupancy means lobby
status READY, not that a game has started. The zero-wager JSON response
flags onChain, wager, rewards and playable are all false.

BC-0.6 is still the authoritative match lifecycle/start/turn/score
boundary; BC-0.7/8 own actual game-specific rules and AI.
The new 25 Classics remain visibly nonplayable. This stage does not
claim online Cross-Country Chaos or a running room session in production.

Exact-head workflow: .github/workflows/bc-0-5-classic-rooms.yml
(PostgreSQL 16 integration, Go race/vet/build and targeted Node tests)
alongside the unchanged Bong Goggles Web Verification for mobile
layout, cards/maps/assets, wallet/social and static security gates.
