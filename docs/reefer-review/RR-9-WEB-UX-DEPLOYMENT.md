# RR-9 — Web UX & Deployment

## Scope and status

Canonical RR-9 requires production frontend/backend configuration, API routing, security headers/rate limits, logs/metrics/alerts, backup/restore and browser E2E/accessibility/load qualification.

**PARTIAL / not qualified for production.** Production startup remains fail-closed until real dependency composition is qualified. Current repository command `cmd/reefer-review/main.go` explicitly fails closed for non-development deployment modes; real session verifier, live dependencies and operator deployment configuration are not connected. Do not change this gate merely to obtain a green test.

## Repository controls delivered

- Existing browser application retains semantic sections, skip-link, keyboard-accessible controls, feedback announcements and DOM `textContent` rendering.
- API uses bounded direct-peer request throttling. Production ingress must additionally enforce distributed IP/request rate budgets.
- API responses include no-store policy, no sniffing, framing denial, same-origin resource policy, restrictive CSP, no referrer and denied browser permissions.
- Authentication remains the session/capability boundary established in RR-4. No permissive CORS has been enabled.
- App-scoped tests protect those headers on normal and denied responses and check that unknown cross-origin preflights are not granted.
- RR-9 targeted workflow verifies exact source SHA, Go compilation/regressions/race/vet, frontend syntax and retained app verifiers.

## Release-blocking work

1. **Deployment/API routing:** Establish approved TLS termination and same-origin `/v1/*` routing to an independently qualified live backend. Provide real Identity/Wallet session verifier, Storage/Rights, Search, Notifications and Mail integration. Do not ship development `AllowIdentity`, `DevAuthorizer` or no-op adapters as production.
2. **Rate limit and ingress controls:** A bounded in-process direct-peer token bucket now returns 429 for excess calls and ignores untrusted `X-Forwarded-For`; deployment still requires production-aware reverse-proxy trust policy, distributed ingress enforcement, distinct route budgets, and verified body bounds.
3. **Observability:** Bound and redact structured logs; publish health/latency/error metrics and actionable alerts. Never log Wallet tokens, private publication bodies or credentials.
4. **Backups:** Document and test encrypted, owner-controlled backup and restore of publication metadata, feed checkpoints and integration outbox, with disaster recovery and consistency checks.
5. **Browser qualification:** Run real browser E2E, WCAG accessibility and responsive mobile checks for anonymous, authenticated, forbidden and revoked-session paths. Exercise API/backend routing and secure cookies/session gateway.
6. **Load and incident readiness:** Confirm concurrency/rate-limiting, recovery, front-end cache behavior and rollbacks using production-equivalent infrastructure.

Repository-source Level 1 is not proof of deployed browser behavior. These gates must remain explicit and cannot be satisfied by static verifier markers.

## Next canonical step

**RR-10 — Repository Level 3 Closeout** only after RR-9's own required release-stage criteria are satisfied.
