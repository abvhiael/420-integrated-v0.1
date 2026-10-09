# GROW-V2-16 — secure testnet deployment and acceptance gates

**State: IN PROGRESS / NOT RELEASE-QUALIFIED.** This is a deployment architecture and operator checklist, not evidence of a live endpoint. The V2-15 Level 3 qualification remains valid for its exact implementation; new runtime, authentication, or deployment code requires new qualification.

## Proven constraint: certificate trust cannot originate from Render request headers

`grow/cmd/private-server/main.go` uses native TLS 1.3 `ListenAndServeTLS`, a configured client CA, and `tls.VerifyClientCertIfGiven`. `grow/dashboard/certificate.go` rejects missing `r.TLS.VerifiedChains` and binds SPIFFE tenant/subject identities plus SHA-256 leaf fingerprints to active database records. `grow/dashboard/auth.go` further requires `r.TLS` for sessions. Render's public HTTPS ingress terminates client TLS and cannot supply those verified chains to the unmodified service. Do not deploy `private-server` as a conventional Render public web service or synthesize `r.TLS` from `CF-Client-Cert`, `X-Forwarded-Client-Cert`, or any other client-controlled header.

**Chosen boundary:** keep Render workspace `reefer review` for separately scoped data/support services only. Run the existing private workspace on an operator-owned TLS-pass-through endpoint where the Go server itself terminates browser/client TLS and verifies client certificates. If a CDN or gateway is used, it must pass TLS through unchanged, or a separately specified and audited signed upstream-identity protocol must be implemented with cryptographically authenticated gateway-to-app transport, replay protection, origin isolation, and end-to-end tests **before** changing this architecture. Cloudflare mTLS at its edge alone does not satisfy the existing Go `r.TLS.VerifiedChains` requirement.

## Hosting and finance prerequisites

- Record an approved testnet hostname, DNS owner, TLS-capable ingress host, secrets manager, operator and incident responder. Do not publish internal Postgres connectivity or client CA material.
- Confirm Render Postgres region, cost/plan, point-in-time recovery availability, backup retention and restore capability before provisioning. Avoid claiming free-tier backups/PITR. Use separately scoped migration and non-owner runtime database roles, RLS, and `sslmode=verify-full`. Preserve the database CA root and hostname verification.
- Build the static workspace and private Go service from a pinned Git commit with artifact digests. Release runbook must record SHA, compiler/tool versions, hostname, TLS chain, exact non-secret config, backup IDs and deployment IDs.
- Keep the existing `reeferreview-rss-preview` service, its environment, and its database entirely untouched.
- Startup must fail closed on absent `GROW_PRIVATE_DATABASE_URL`, server certificate/key, trusted `GROW_PRIVATE_CLIENT_CA`, static assets or DB availability. Never loosen `databaseURL`'s verify-full or change the certificate-only login flow to an unauthenticated fallback.

## Mandatory real acceptance evidence (all gates)

1. **TLS and identity** — externally observe TLS 1.3 on the actual endpoint; capture public server chain verification, client CA issuance, authorized enrollment, fingerprint matching, hostname mismatch rejection, unknown issuer rejection, malformed/duplicate SPIFFE SAN rejection, key rotation, stale leaf rejection, revocation and suspended tenant/member rejection. Validate absence of login without an enrolled certificate.
2. **Database isolation and recovery** — apply ordered checksum migrations; verify runtime role lacks SUPERUSER/BYPASSRLS and cannot access other tenants/facilities/zones; collect encrypted backup and PITR restore drills to isolated infrastructure, with recovery timing and integrity checks. Avoid copying identifiable production data into testnet.
3. **Browser/device** — exercise real desktop/mobile browsers with enrolled certs, CSRF/origin/session-recovery/accessibility/XSS, stale cookies, offline/disconnected and revoked-client cases. Record browser versions, device model and sanitized evidence.
4. **Sensors/equipment** — identify actual hardware, calibration references, measurement drift, timestamp/replay, disconnect/reconnect, out-of-range data, fail-closed equipment behavior and proof that no unauthorized physical actuation exists.
5. **Ecosystem services** — prove real Identity, Wallet, Registry, Location, Storage, Notifications subscription/recipient/delivery authority, and 420AI/Compute model/provider/media-sanitization integration where supported. Record exact upstream URLs/protocol versions and denied/unavailable behavior; unsupported live adapters remain blocked, not silently treated as pass.
6. **Operations** — monitor live health and incident alerts, exercise dependency outage and recovery, inspect privacy-preserving logs, roll back an actual deployment, perform incident response and record named operator sign-off.

## Release evidence manifest

Store a sanitized, non-secret release manifest with: implementation SHA, deployment URLs/IDs, artifact digests, provider plan and PITR capabilities, TLS/CA/fingerprint enrollment test outputs, devices/calibration IDs, upstream service addresses and revision proofs, GitHub Action run/job IDs, negative/adversarial observations, backup/restore checks, outstanding issues, dates and operator sign-off. Keep private keys, DB credentials, session cookies and tenant personal data outside Git.

**Stop conditions:** no verified native client TLS, no live DB with correct roles, no recoverable backups, no real physical-device evidence, no testnet upstream authority, missing negative/security cases, or missing operator sign-off. Any one means **GROW-V2-16 BLOCKED**, regardless of prior V2-15 CI. Never equate a green build or a static Render site with complete live acceptance.

## Current evidence (2026-10-09)

The `reefer review` Render workspace (`tea-db3riuei0phs73baf850`) has one unrelated `reeferreview-rss-preview` service and no Render PostgreSQL instances. No private 420Grow release deployment, enrolled real clients, actual sensor tests, backups/restore, or external provider proofs were found during this inspection. No paid resources were provisioned. This is a snapshot, not a permanent inventory claim.

**Next:** operator approval of an mTLS-capable pass-through host and costed PITR-backed Postgres plan, followed by live deployment, targeted Level 1 validation of any changed implementation, and collection of each acceptance artifact. V2-16 cannot close before then.
