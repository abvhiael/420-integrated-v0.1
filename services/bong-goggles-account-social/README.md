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
