# GROW-V2-07 — Equipment adapters, monitoring and safe controls

**Disposition:** implementation candidate; exact-SHA Level 1 CI must pass before COMPLETE.

## Architecture and safety boundary
- Provides a typed, read-only `Adapter.Observe` boundary for equipment monitoring, an authenticated tenant/zone authorization check and strict denial for offline equipment. Observe is separate from V2-06 sensor observations; the adapter never trusts a public place ID or browser-provided role.
- Defines a cryptographically verified control approval *precondition* for OWNER/MANAGER with verified MFA, valid Ed25519 signature bound to the DB-authoritative device-specific public key and covering subject, tenant, facility, zone, device, action, target, nonce and short expiry, plus safe numeric bounds, live equipment, confirmed interlock and no manual override. This validation alone **does not dispatch commands**.
- `grow/storage/migrations/0005_equipment.up.sql` supplies a private tenant/facility/zone-keyed equipment registry and immutable nonce uniqueness with FORCE RLS. `grow/equipment/postgres.go` implements tenant-local database lookups and atomic `ClaimNonce`. V2-07 SQL adversarial tests verify cross-tenant references, invalid safety limits, nonce replay and tenant RLS. No hardware commands use these tables in this phase.
- All `Dispatch` calls are hard denied. No code in V2-07 can energize equipment. This is deliberate because a live, independently certified physical device transport, credential lifecycle, fault-safe hardware interlocks, human emergency cutoff, persistent durable nonce claiming and atomic command audit/acknowledgement are not present. These requirements cannot be substituted by an in-memory nonce map, optimistic RPC or simulated device.
- `Store.ClaimNonce` is an explicit future interface for persistent tenant/device-scoped replay prevention; no deployment may use command dispatch without its atomic implementation, audited command state, rate limiting, reauthentication, hardware acknowledgement, safe-state timeout and device-specific hazard analysis.
- An equipment maintainer may observe assigned equipment; REVIEWER cannot issue commands or generally observe device state; owner/manager have observation but do not automatically receive device-control privileges under `grow/security`.
- Monitoring fails closed for invalid principal, revoked/incorrect tenant memberships, wrong device identity, missing/offline device, missing adapter or invalid sensor response. No hardware command endpoint, URL, MQTT credential, USB control transport, deployment configuration or user-facing device control UI is exposed.

## Qualification and limits
- Targeted tests exercise valid read-only adapter observation, unauthorized pre-query denial, stale/invalid/forged signed approvals, override/interlock/offline states, nonsensical setpoint, wrong tenant, revoked credentials and denial of every dispatch attempt.
- V2-07 is app-scoped Level 1; previous cumulative Level 2 at V2-05 remains valid and the next Level 2 is V2-10. Level 3 and external deployment occur at V2-15 and V2-16 respectively.
- No statement of certified physical safety or production device control is made. Deployment of a real actuation adapter requires a distinct future safety/operational acceptance milestone; an actual device-control permission may not be introduced by merely changing role lists or deleting denial assertions.

**Next step:** GROW-V2-08 — Nutrients, irrigation and environmental history.
