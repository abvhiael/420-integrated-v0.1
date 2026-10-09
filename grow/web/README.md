# 420Grow web — public directory and private cultivation workspace

## Private cultivation workspace (Grow V2)

`workspace.html`, `workspace.js` and `workspace.css` provide the separate private cultivation UI. The build includes these assets alongside the retained public directory. The committed private runtime configuration is disabled; opening the static workspace alone does not create a tenant, session, database or live service.

The dedicated `grow/cmd/private-server` serves the built assets and `/v1/private/` API over TLS 1.3. It supplies same-origin private runtime configuration and disables public directory configuration. It requires:

| Variable | Required value / behavior |
| --- | --- |
| `GROW_PRIVATE_DATABASE_URL` | Operator-provided PostgreSQL URL with authenticated `sslmode=verify-full`; use a non-owner runtime role without `BYPASSRLS` |
| `GROW_PRIVATE_TLS_CERT` / `GROW_PRIVATE_TLS_KEY` | Paths to the server certificate and private key |
| `GROW_PRIVATE_CLIENT_CA` | Path to the trusted client CA PEM |
| `GROW_PRIVATE_STATIC_DIR` | Built static asset directory containing `workspace.html` |
| `GROW_PRIVATE_LISTEN_ADDR` | Optional listener; defaults to `127.0.0.1:8443` |

Apply the ordered, checksum-verified migrations with `python3 scripts/grow-v2-migrate.py`, using the separate privileged `GROW_MIGRATION_DATABASE_URL`. Review migration checksums and backups before deployment. Provision tenant membership, facility/zone scope, runtime grants and certificate enrollment independently; CI fixture provisioning is not a production provisioning script. Login requires a TLS-verified client certificate, a `spiffe://420integrated.org/grow/tenants/<tenant UUID>/subjects/<subject>` URI, an enrolled SHA-256 certificate fingerprint and active membership. Session cookies and every private request remain subject to expiry, revocation, membership, role and scope checks. Client-provided forwarding headers cannot establish identity.

Authorized sections cover facilities, plants/genetics/cloning, telemetry, equipment observation, cultivation history, harvest/analytics, inventory, human-reviewed AI assistance and notification outbox state. Available forms follow server-projected permissions; writes use CSRF-bound requests and stable UUID idempotency keys. Inventory exports are internal provenance-bearing CSV, not certified regulatory submissions. AI results remain advisory and human reviewed; equipment actuation and live external providers are not enabled by this UI.

For repository qualification, `420grow-v2-fast.yml` runs actual PostgreSQL migration/RLS/role checks, Go unit/race/vet/build/format checks, private HTTP and certificate integration, frontend tests, Chromium desktop/mobile accessibility/XSS/revocation/recovery checks and targeted security tests. `420grow-fast.yml` retains the original directory, SDK and service checks. Comprehensive Level 3 is GROW-V2-15; production-equivalent TLS/database deployment, certificate issuance/rotation, real devices, external providers and operator recovery acceptance remain GROW-V2-16.

Canonical phase state and evidence: [V2 roadmap](../../docs/audit/420GROW-V2-ROADMAP.md) and [Level 3 reconciliation](../../docs/audit/420GROW-V2-15-LEVEL-3-GATE-AND-RECONCILIATION.md).

## Retained public directory (GROW-04)

A static, read-only public directory consuming the versioned 420Location `GET /v1/places` API, not a protocol Registry or wallet authority.

## Local development and qualification

Node >=22. Run `npm run qualify` in `grow/web`. The build emits `dist/` (do not commit generated build output). Serve `grow/web` or `dist` via an HTTP server. Do not open `index.html` as a file URL.

The committed `runtime-config.js` sets `enabled:false`, so the interface deliberately reports unavailable rather than making up listings. To exercise real public data in a controlled test deployment, configure an approved HTTPS 420Location endpoint at `locationBaseUrl`, with the source's explicit CORS consent if cross-origin, then enable it. Prefer a same-origin reverse-proxy `/v1/places` for production. The endpoint must serve `application/json`, v1 envelope, and public records only. API URL credentials, opaque auth secrets and wallet keys must never be embedded in the browser config.

## UX and security boundaries

- Search, FARM/BUSINESS filtering, list and schematic pin map, place details, coarse-area listings, refresh, empty/loading/error states.
- A schematic map does **not** present provider tiles, route distance, or an accurate geographical projection. Only exact public pins appear; approximate records stay text-only. Public coordinates may link to OpenStreetMap.
- Source and Registry record references identify provenance, not independent Verify status or endorsement.
- Untrusted API strings use `textContent` and never `innerHTML`; no fixture listings, private coordinate escalation, or wallet transaction UI.
- Keyboard-operable buttons, skip link, labelled search/filter, live status, high contrast and mobile layout are provided. Manual assistive-tech and device/browser checks remain a release milestone.
- Public-directory publishing/editing/claiming is unsupported until upstream authorization has been specified and qualified. These anonymous directory endpoints do not expose the private cultivation workspace or commerce authority.
- Source API is capped at 500 public items without cursor pagination; production scalable discovery belongs to GROW-05/GROW-07.
- Real live API, DNS, credentials, monitoring, TLS and deployed end-to-end tests belong to GROW-10.
