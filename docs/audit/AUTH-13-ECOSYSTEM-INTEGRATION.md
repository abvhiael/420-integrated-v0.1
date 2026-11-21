# AUTH-13 — Ecosystem-wide application integration qualification

## Scope

This implementation extends the existing AUTH-7 confidential app-scoped
authorization flow to reusable, separately deployable 420ID consumer gateways.
It does **not** centralize wallets, cross-application social graphs, identity
credentials, on-chain rights, tenant memberships, moderation, subscriptions,
payments or XP rewards.

- Central 420ID is the single credential issuer and retains per-app consent.
- Each destination has its own app ID, independent random SSO client secret,
  independent AES-GCM session key, database role and opaque app-subject.
- Applications receiving a first-party session never receive the central
  account ID, email, wallet-link identity, 420Identity profile, reward balance,
  payment authorization, capability or another app's subject.
- The browser calls only same-origin cookie-based session and logout APIs
  with cache disabled; the backend does confidential PKCE/code exchange.
- Legacy authorization for finance, governance and tenant-restricted
  applications retains its original trust source.
- Application UI is disabled by default until a qualified backend and
  same-origin TLS edge are installed. This phase performs no production
  migrations, Cloudflare routing or 420ID SSO credential provisioning.

## Repository evidence

The canonical gateway is at `services/420id/app-gateway/` with
`catalogue.json`, `gateway.go`, `schema.sql` and adversarial tests.
The operator-controlled standalone entry is
`cmd/420id-app-gateway/main.go`.

The application view is copied into Town, DoobTube, Mail, Grow, Pay, Exchange
and Media static clients, with explicit off-by-default flags and distribution
build integration. The Town and Mail Go backends may opt in by attaching the
already approved same-app gateway; mail's opt-in identity is restricted to
personal inbox and send only, and Town uses a distinct off-chain actor
namespace. The existing BongGoggles AUTH-8–12 gateway remains authoritative.

`scripts/verify-doobtube-baseline.py` retains a strict file inventory and
adds only the reviewed optional DoobTube module. No new Media/DoobTube
contract, Genesis catalogue identity, token entitlement or bypass exists.

## Adversarial scenarios

1. Unknown app IDs, origin spoofing, cross-application callback/PKCE secrets
2. Failed TLS/Host, duplicate cookies, tampered AES-GCM ciphertext and
   untrusted origin on state-changing requests
3. Expired, replayed, mismatched, or concurrently exchanged OAuth flow
4. Multi-instance cookie verification and parent 420ID revocation
5. Failure of the confidential provider or unexpected response format
6. Runtime SQL-role missing privileges, forbidden extra grants and DDL
7. Legacy bearer priority over optional 420ID cookies
8. Cross-tab account-switch stale response and logout during pending fetch
9. App-only session status cannot assert wallet, financial or moderation rights
10. Real static-build inclusion and identical canonical browser code

The new `.github/workflows/auth-13-ecosystem.yml` runs the exact-head
PostgreSQL and browser/build checks. Related app workflows remain intact.
Document actual final workflow outcomes and current head in PR #1277.

## External release gate

A real app deployment must register the confidential client at central
420ID, install its separate schema/least-privilege role, configure trusted
HTTPS reverse proxy on the pinned app origin, keep secrets server-only,
exercise interactive consent, login, logout, revocation and restore behavior,
and deliberately activate the default-off UI. The pre-existing isolated
AUTH-2 420ID Render service has no presumed SSO or gateway readiness;
no unverified origin (including Media) may be silently approved.

All externally dependent operations must be reported as **not deployed**
until runtime evidence actually exists. AUTH-13 does not create a hypothetical
AUTH-14 phase or start the next task.
