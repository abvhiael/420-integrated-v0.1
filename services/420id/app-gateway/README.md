# AUTH-13 — First-party 420ID application gateway

## Architecture

This is a **confidential application-side** 420ID authentication gateway, not
a new identity provider. Deploy one independent gateway instance, client
secret, encrypted session key, database and limited runtime role for each
approved first-party application. 420ID's central
`https://auth.420integrated.org/` host issues PKCE authorization codes
and app-scoped subjects. Each app's own site serves the gateway under its
same-origin `/420id-api/` path. An HTTPS reverse proxy must preserve the
original app Host and enforce the trusted TLS termination boundary.

App-scoped sign-in is optional and free. Public reading stays public;
members may keep using an app without linking a wallet. App sessions do not
grant 420Wallet approval, 420Identity credentials, 420Names control, 420Pay
spending, Exchange trades, treasury privileges, paid subscriptions,
moderator permissions, tenant roles, or cryptocurrency rewards.

The Go gateway persists 256-bit state and PKCE verifiers in its **own**
PostgreSQL schema encrypted with an app-specific AES-GCM key. Flow/state
digests and session-cookie digests are stored instead of raw secrets.
The 90-second central authorization code is validated via confidential,
single-use server-to-server exchange (flow expiry five minutes). New app
cookies are Secure, HttpOnly and SameSite Lax. Each status and backend
verification re-introspects the original central 420ID and scoped app
session; local logout revokes the local cookie before requesting central
revocation. No cross-origin cookies, shared identifier, bearer, wallet
link or client secret enter the browser.

## Approved application catalogue and actual integration

The checked-in `catalogue.json` is an application origin/callback
allowlist, **not proof of deployment or client registration**:

| Application | Origin | Integration in AUTH-13 |
|---|---|---|
| 420Town | `https://town.420integrated.org` | Default-off account panel; `town/api` optional off-chain actor verification |
| DoobTube | `https://doobtube.420integrated.org` | Default-off account panel; existing nonproduction Python gateway stays public-read only |
| 420Mail | `https://420mail.420integrated.org` | Default-off panel; optional private inbox/send bound to separate app subject; connectors and wallet actions excluded |
| 420Grow | `https://grow.420integrated.org` | Default-off panel; cultivation tenant/membership/certificate roles remain separate |
| 420Pay | `https://420pay.420integrated.org` | Default-off panel; payment and settlement still require the wallet |
| 420Exchange | `https://420exchange.420integrated.org` | Default-off panel; no trading, swaps or signing privileges |
| 420Launchpad | `https://launchpad.420integrated.org` | Allowed confidential app ID; website redesign on a concurrent PR is not modified here |
| BongGoggles | Existing separate AUTH-8–12 app-specific backend | Retained; do not replace it with an incompatible app ID |
| 420Media | Production URL not established in `media/web/runtime-config.json` | Browser module/panel shipped disabled and **not** approved for gateway activation until origin is pinned and verified |

The seven browser panels explicitly use `data-420id-enabled="false"`.
They can become usable only when a corresponding isolated backend is
deployed, central 420ID registers the exact app ID/callback, a verified
edge routes `/420id-api/` to that backend and an operator deliberately
enables that app's panel. No code grants a cross-app login implicitly.

## Deployment and operator workflow

1. Use the isolated operator database credential to run
   `go run ./cmd/420id-app-gateway migrate` with
   `APP420_MIGRATION_DATABASE_URL`. The DB name/schema are app-private;
   **do not point this service at central 420ID or another application's DB**.
2. Grant only `USAGE` on `app420_sso`, `SELECT,INSERT,DELETE` on
   `app420_sso.login_flows` and `app420_sso.sessions`, and
   `SELECT,INSERT,UPDATE,DELETE` on `app420_sso.rate_buckets`
   to a separate runtime credential. Do not grant DDL, UPDATE or TRUNCATE
   on the sensitive flow/session tables. Runtime readiness fails closed.
3. Register exactly one approved app/callback at central 420ID:
   `<pinned-origin>/420id-api/auth/callback`, with a distinct random
   32-byte client secret in protected `AUTH420_SSO_CLIENTS`. The
   central 420ID mode must be the qualified confidential SSO source.
   The client secret must match `APP420_CLIENT_SECRET`, but must never
   be written to browser config or Git.
4. Configure this app's server with
   `APP420_MODE=restricted-acceptance`,
   `APP420_TLS_TERMINATION=trusted-proxy`,
   `APP420_APP_ID`, `APP420_ORIGIN`, `APP420_DATABASE_URL`
   (`sslmode=verify-full`), `APP420_CLIENT_SECRET` and
   `APP420_SESSION_KEY`. The last two must be distinct independently
   generated 32-byte base64url values. `APP420_ORIGIN` must exactly
   equal the pinned origin. The default listener is port 10000.
5. Pin trusted HTTPS ingress (Cloudflare/Render or reviewed equivalent).
   Reverse-proxy `/420id-api/*` on the app's **same origin** to its
   gateway without forwarding public credential overrides. Validate the
   real-browser cookie, OAuth redirect, CSRF, sign-in, logout, previous
   account invalidation, credential rotation, failure handling, and
   rollback on the deployed host before turning a panel flag on.
6. For Town or Mail off-chain operations, only the **original backend**
   can explicitly attach the approved appgateway instance with
   `Enable420ID`. Authorization must continue applying domain-specific
   object ownership, moderation and other business checks. An app-only
   subject prefixed `420id:` is never a wallet address.
   Existing legacy bearer-authenticated requests take precedence.

Missing runtime role, unresolved domain, wrong client registration, failed
confidential provider introspection, wrong origin or absence of a verified
backend leaves the wallet-free login inaccessible rather than guessing.

## Qualification

`.github/workflows/auth-13-ecosystem.yml` exercises PostgreSQL 16
race-enabled integration and browser tests at the exact branch SHA,
including multi-instance state flow, cryptographic replay defense,
app separation, private session status, individual role grants,
host/Origin/CSRF limits, stale browser responses and actual dist packaging.
The involved application workflows qualify their existing behavior.
Exact successful run IDs and SHA are retained in the AUTH-13 PR.

No production readiness, paid feature, reward funding, live certificate,
database provisioning or deployed end-to-end integration is asserted by
repository-only qualification. Merge only on explicit user instruction.
