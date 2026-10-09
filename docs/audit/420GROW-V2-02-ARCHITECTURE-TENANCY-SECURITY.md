# GROW-V2-02 — Architecture, tenancy, roles and security model

**Decision status:** adopted as application-only V2 architecture baseline, subject to Level-1 exact-SHA evidence. **Scope:** architecture, authorization policy, security trust boundaries, negative tests and integration contracts; NOT persistence implementation (V2-03), feature endpoints (V2-04 onward), live identity integration, public deployment, or Genesis promotion.

## Repository fit and boundaries

- Inherit [GROW-V2-01](420GROW-V2-01-EXPANDED-PRODUCT-DECISION.md) five-pillar cultivation product and preserve original GROW-01–10 read-only directory, `grow/location`, `grow/service` and `grow/web`. The existing anonymous `/v1/grow/places` route only shows vetted public `420Location` records; it MUST NOT be reused to serve private cultivation data.
- Introduce `grow/security` as a standalone pure, deny-by-default authorization kernel, free of network, chain, database and authentication providers. It owns named roles, typed actions, tenant and scoped facility/zone decisions; later HTTP handlers MUST invoke it after trusted authentication, prior to persistence queries and writes. A caller-supplied user/tenant header, session cookie value, device label or public place ID is **not** an authenticated principal.
- Proposed Go service layers: HTTPS edge/session adapter (authN, CSRF and rate limits) -> cultivation API (principal/tenant/facility/zone context and validation) -> shared `grow/security` decision -> domain services (transactional state changes) -> PostgreSQL repository (parameterized tenant-scoped storage) -> append-only application audit/events; object media storage and environmental telemetry through dedicated bounded adapters. UI is an untrusted presentation layer.
- API namespace reservation: private `/v2/grow/**` requires authenticated principal and tenant; original `/v1/grow/places` stays isolated. Do NOT implement unsafe stub endpoints or claim a live authN/session system at this phase. Adopt JSON `v2`, opaque generated IDs, UTC timestamps, explicit schema/version errors, cursor pagination and concurrency/version controls for later specs.
- Multi-tenancy: one account may belong to multiple tenants, but the authenticated active tenant MUST be explicit and memberships re-checked on each request. A facility is owned by exactly one tenant; zone by exactly one facility; no cross-tenant joins, identifiers or exports. No automatic sharing between tenant and public-directory records. Home-grow tenant defaults PRIVATE.
- Isolation in V2-03: tenant ID is a mandatory repository partition predicate on every CRUD/list/export/event query; database row-level security as defence in depth where supported, fail-closed transaction tenant context, consistent partitioning of object keys/telemetry/events, negative dual-tenant tests and migrations. No privileged bypass for normal service requests.

## Principal, membership, grants and denial semantics

**Principal** (future authenticated identity): stable subject ID from validated server-side session/token, issuer + audience + expiry + nonce/session ID, authenticated channel and revocation status; NEVER supplied by an untrusted query parameter. Authentication adapter is a future independently qualified interface. Session strategy: server-issued opaque short-lived sessions, HttpOnly Secure SameSite cookies, rotating identifiers on login/privilege changes, CSRF tokens for state-changing browser requests, explicit logout/invalidation; verified MFA or step-up required for owner role grants, high-impact exports and equipment authorization. Tokens/keys not stored in browser JavaScript.

**Membership:** subject+tenant+role+state ACTIVE/SUSPENDED/REVOKED. Only ACTIVE grants authorize. Role changes are authoritative server-side and promptly invalidate old sessions/caches; never trust UI role claims. Scope is optional facility and zone restriction; missing required scope denies. Denial external response should be indistinguishable for unknown vs unauthorized private object (404-style concealment) while privileged audit records record a safe reason without secrets.

### Role and action matrix — enforce server-side

| Role | Read assigned cultivation data | Edit assigned cultivation observations/plants | Facility/zone setup | Inventory correction & audit export | Membership admin | Device/actuation |
| --- | --- | --- | --- | --- | --- | --- |
| OWNER | Yes | Yes | Yes | Yes | Yes, subject to last-owner safeguard | **Observe only**; distinct separately approved control grant |
| MANAGER | Yes | Yes | Yes | Yes | No owner grants | **Observe only**; distinct control grant |
| TECHNICIAN | Yes | Yes | No | No | No | Observe only |
| REVIEWER | Yes | No | No | Audit export only | No | No |
| MAINTAINER | Assigned equipment observations only | No | No | No | No | Observe only; control requires distinct approved capability |
| PUBLIC/none | No | No | No | No | No | No |

Application `grow/security` authorizes specific actions: VIEW, PLANT_WRITE, FACILITY_MANAGE, INVENTORY_ADJUST, AUDIT_EXPORT, MEMBERS_MANAGE, EQUIPMENT_OBSERVE, DEVICE_CONTROL. Device control always fails closed in V2-02 independently of role. Future privileged command grants require a separate signed, scoped, expiring, nonce/idempotency-bounded capability, hardware interlock/manual override, rate limit and V2-07 hazard review. A reviewer cannot modify observations and a maintainer cannot browse unrelated plant data. A revoked/suspended membership has no rights.

**Ownership and lifecycle constraints:** last active owner cannot be deleted/demoted; transfer is a separately audited two-party operation. No self-elevation, cross-tenant role modification, export by public users, or replay of stale role snapshots. Service automation identities, when approved, must be distinct from human roles and bound to one tenant and least-privilege capability; webhook/sensor messages require signed/replay-protected ingest and cannot confer user access.

## API, data, audit and external trust policy

- Required future domain entities: tenant, membership, facility, zone, plant/lineage, readings, controls, harvest, inventory lot and movement, consent, export job, audit event. Each private entity must carry tenant ownership and stable IDs; related entities checked against parent ownership before reads/mutations. V2-03 to specify DDL, migration/recovery, transaction isolation and retention; V2-04 first CRUD surface.
- Versioned mutations use optimistic concurrency, idempotency keys for consequential actions, strict field/unit/time parsing and bounded uploads, audit before acknowledging commits; avoid duplicate inventory movements or replay.
- Audit: actor/subject, tenant, action, object reference, server time, revision, outcome and normalized reason; immutable chronological event history or corrections rather than deletion of prior custody. Prevent storing credentials, precise private coordinates, raw plant images or sensitive AI prompts in logs.
- Encryption in transit, restricted encrypted data at rest, isolated backup keys, secret manager, safe structured redacted logs, retention/deletion and consent controls required before any live customer data; do not commit keys. Threat model includes cross-tenant IDOR/cache/query leakage, confused deputy/public projection, stolen sessions, CSRF, forged sensor telemetry, replay/double-spend inventory, unsafe actuation, exfiltration via AI/jobs, unsafe attachment/metadata and backup export.
- Public 420Location entries are independent from private facility identities; public opt-in requires a separate authenticated explicit approval plus coarse-coordinate privacy checks. No inference of private addresses through map, search, reports or notifications. External 420AI/Compute/Storage/Notifications/Identity/Wallet require V2-12 explicit API/consent/authority decision; no new contract, token, Genesis ID or Registry authority.
- Observed telemetry, operator-entered facts, estimated forecasts, AI outputs and externally verified assertions must remain distinctly attributed with source/provenance and dates. Equipment operations remain unavailable until V2-07.
- Compliance posture: configurations can represent jurisdictions, licensing and retention rules, but **do not certify legal permissibility or government seed-to-sale submission**. Require human legal/compliance review for future jurisdiction-specific workflows.

## Implementation mapping and acceptance checklist

| Requirement | Owner / implemented now | Negative proof |
| --- | --- | --- |
| Role-specific closed matrix, active membership, tenant/facility/zone binding | `grow/security/policy.go` | `grow/security/policy_test.go` table denies unknown roles/actions/IDs, suspended and cross-tenant access |
| Device-control separation | `grow/security/policy.go` | always denies, even OWNER, pending V2-07 qualified capability |
| Existing anonymous directory retained | `grow/service`, `grow/location`, `grow/web` unchanged | previous `420grow-fast.yml` checks |
| Architecture and privacy/identity trust boundaries | this document; product decision V2-01 | `scripts/verify-grow-v2-02.py` scoped invariants |
| Persistent secure tenant CRUD/session/DB RLS | V2-03 and V2-04 | NOT IMPLEMENTED by this document or policy kernel |
| Level 2 convergence | V2-05 plus cumulative V2-02–05 | not required for V2-02 |
| Exact-SHA Level 1 app CI | `.github/workflows/420grow-v2-fast.yml` | PASS required before COMPLETE |
| Phase Level 3 and live acceptance | V2-15, V2-16 | explicitly deferred |

**Step exit criteria:** architecture, tenant isolation, principal/session trust boundary, role/action matrix, equipment safety, schema/API ownership, audit/retention and compliance boundaries, concrete policy enforcement kernel and adversarial negative tests documented and verified at one exact SHA. No representation that unimplemented authentication/database/device integration is operational. **Next canonical step: GROW-V2-03 — Persistent storage, schemas and migrations.**
