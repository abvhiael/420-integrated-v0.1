# RR-9 — Web UX & Deployment

## Scope and status

Canonical RR-9 requires production frontend/backend configuration, API routing, security headers/rate limits, logs/metrics/alerts, backup/restore and browser E2E/accessibility/load qualification.

**PARTIAL / not qualified for production.** Production startup remains fail-closed until real dependency composition is qualified. Current repository command `cmd/reefer-review/main.go` explicitly fails closed for non-development deployment modes; real session verifier, live dependencies and operator deployment configuration are not connected. Do not change this gate merely to obtain a green test.

## Repository controls delivered

- Encryption/restore primitives now offer bounded authenticated snapshots of selected local metadata files; live multi-provider disaster recovery is not yet qualified.
- Existing browser application retains semantic sections, skip-link, keyboard-accessible controls, feedback announcements and DOM `textContent` rendering.
- API uses bounded direct-peer request throttling. Production ingress must additionally enforce distributed IP/request rate budgets.
- API responses include no-store policy, no sniffing, framing denial, same-origin resource policy, restrictive CSP, no referrer and denied browser permissions.
- Authentication remains the session/capability boundary established in RR-4. No permissive CORS has been enabled.
- App-scoped tests protect those headers on normal and denied responses and check that unknown cross-origin preflights are not granted.
- RR-9 targeted workflow verifies exact source SHA, Go compilation/regressions/race/vet, frontend syntax and retained app verifiers.

## Release-blocking work

1. **Deployment/API routing:** Establish approved TLS termination and same-origin `/v1/*` routing to an independently qualified live backend. Provide real Identity/Wallet session verifier, Storage/Rights, Search, Notifications and Mail integration. Do not ship development `AllowIdentity`, `DevAuthorizer` or no-op adapters as production.
2. **Rate limit and ingress controls:** A bounded in-process direct-peer token bucket now returns 429 for excess calls and ignores untrusted `X-Forwarded-For`; deployment still requires production-aware reverse-proxy trust policy, distributed ingress enforcement, distinct route budgets, and verified body bounds.
3. **Observability:** Repository API now has bounded redacted method/status/latency logs and atomic request/error/rate-limit counters. Exporting those counters to an operator metrics system, alert policies and production-grade aggregation remains outstanding. Never log Wallet tokens, private publication bodies or credentials.
4. **Backups:** AES-256-GCM authenticated, owner-only bounded snapshot/isolated restore primitives now cover explicitly provided local durable files, including publication metadata, feed checkpoints and integration outbox when supplied by an operator. Tests cover round-trip, tampering, wrong keys, symlinks, and refusal to overwrite existing directories. Production retention scheduling, managed external key custody, off-site replication, provider-backed article bodies, disaster-recovery drills and integrated multi-store consistency remain release gates.
5. **Browser qualification:** Run real browser E2E, WCAG accessibility and responsive mobile checks for anonymous, authenticated, forbidden and revoked-session paths. Exercise API/backend routing and secure cookies/session gateway.
6. **Load and incident readiness:** Confirm concurrency/rate-limiting, recovery, front-end cache behavior and rollbacks using production-equivalent infrastructure.

Repository-source Level 1 is not proof of deployed browser behavior. These gates must remain explicit and cannot be satisfied by static verifier markers.

## Next canonical step

**RR-10 — Repository Level 3 Closeout** only after RR-9's own required release-stage criteria are satisfied.
