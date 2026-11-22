# CCC live multiplayer release and recovery (operator-only)

This runbook prepares the dedicated Node 22 game authority. It does **not**
authorize a live release just because GitHub tests or a merge pass. It must be
applied to an explicitly selected Render workspace; no credentials or Render
resources are modified by this checked-in file.

## 1. Restore existing social and 420ID first

Verify `https://auth.420integrated.org/healthz` responds HTTP 200
and `https://bonggoggles.420integrated.org/social-api/healthz` responds
HTTP 200. A 502 from the latter is an existing Cloudflare-to-Render or social
service availability failure; activating the new game service does not cure it.
The existing social Render service is documented as
`srv-dc0iijm1egvs7382fkag` (verify it in the selected workspace rather than
assuming it still exists). Inspect its latest deploy, runtime logs, environment,
build/start commands, plan and paused/suspended state. Restore the authenticated
health path without weakening Cloudflare's `SOCIAL420_EDGE_SECRET` binding or
bypassing canonical Host/TLS checks.

A Render Free service may sleep. The current Worker has a bounded login-only
cold-start retry page; this does **not** make the API continuously available.
Do not enable an automatic retry of callbacks, writes or authenticated messages.
Do not upgrade a paid hosting plan without the operator's approval.

## 2. Migrate and provision separated database roles

Run `go run ./cmd/bong-goggles-social migrate` from the repository root
using only the operator's `SOCIAL420_MIGRATION_DATABASE_URL`
(certificate-verified, `sslmode=verify-full`). Confirm migration
`services/bong-goggles-account-social/migrations/007_chaos_multiplayer.sql`
has created both game tables; earlier migrations 004–006 belong to Classic
Rooms/Sessions and must not be overwritten.

The Neon `bonggoggles_chaos_runtime` role has been provisioned with
**NOLOGIN** and exact table/column grants; keep it disabled until a secure
independent random password is set through the operator's credential workflow.
Only then change it to LOGIN and supply the resulting least-privilege URL to
Render. No role inheritance may expose social sessions or moderation. For
new environments, create the same isolated role and apply
`deployments/bong-goggles-chaos/chaos-role-grants.sql` as the database
operator. Check positive table/column grants and negative access to
`bg_account_social.sessions`, `login_flows`, moderation data and DELETE.
Never put operator/migration credentials in either web service runtime.

## 3. Provision the separate game web service

Use the Render Blueprint
`deployments/bong-goggles-chaos/render.yaml` in the confirmed workspace,
or configure the equivalent Node 22 web service manually. It must check out
this repository, use root directory `services/bong-goggles-chaos`,
build with `npm ci --omit=dev --no-audit --no-fund --ignore-scripts`,
start with `node main.mjs`, and check `/healthz`.

Secret variables (Render backend only): `CHAOS_DATABASE_URL` for the
dedicated game DB role, with `sslmode=verify-full`, and `CHAOS_PROXY_KEY`
containing exactly 32 CSPRNG bytes encoded as *unpadded* base64url.
`CHAOS_MODE=restricted-acceptance` is explicitly required. Do not place the
session encryption key or 420ID bearer/client secret in the game service.
Direct unsigned requests to its `/v1/chaos/rooms` MUST return 401 even
when its unauthenticated `/healthz` is healthy.

## 4. Connect existing Social to game authority

On the **existing** Go BongGoggles Social service set
`SOCIAL420_CHAOS_MODE=restricted-acceptance`,
`SOCIAL420_CHAOS_ORIGIN=https://<the-verified-game-service>.onrender.com`
(actual HTTPS Render hostname only, no path or query), and
`SOCIAL420_CHAOS_PROXY_KEY` to **the exact same** base64url key as the
game service. Keep `SOCIAL420_EDGE_SECRET` independent and unchanged.
Redeploy the social service only after the Node health check succeeds.
Its proxy verifies a fresh 420ID session and signs exact method/path/time,
app-scoped subject, display name and SHA-256(body) for Node. Never trust
browser-provided `X-Chaos-*` headers.

The public Cloudflare route remains
`bonggoggles.420integrated.org/social-api/*`; do not add a second public
game route or expose the Node hostname as a trusted login entry.

## 5. Acceptance and rollback

Run the authoritative Node+real PostgreSQL workflow, Go Account Social tests,
BongGoggles Web Verification and the uncredentialed live probe:
`CHAOS_PUBLIC_ORIGIN=https://<the-verified-game-service>.onrender.com npm run smoke:live`
from `services/bong-goggles-chaos` on a trusted operator machine.
Then, with **two real, different 420ID accounts in different browsers**,
create/join a private room, confirm per-account hidden hands and legal actions,
test reconnect, 409 stale turn, 403 block, chat/report/mute, bot seat,
cross-regional progression, service restart and mobile viewport.
Check denied direct Node access and never expose stored room JSON or keys.
Only then describe public live testing as qualified.

If any check fails, keep `SOCIAL420_CHAOS_MODE=disabled` on the existing
Social service (or remove its optional activation), preserving established
social login and public feed. The web room route must fail closed rather
than revert to shared-screen play. Do **not** roll back established social
migrations or replace approved maps, cards and account features.
