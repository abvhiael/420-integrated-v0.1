# GROW-V2-04 — Facility, room and zone management

**Status:** implementation candidate pending exact-SHA Level 1 qualification; no deployed private API or session authentication claimed.

## Canonical scope and hierarchy
- This step follows V2-01 product decision, V2-02 tenant security policy and V2-03 PostgreSQL tenancy/RLS schema. Entity hierarchy is **tenant -> facility -> room -> zone**. Tenant-private entities never share public 420Location identifiers or coordinate visibility.
- A facility has exactly one owning tenant; a room belongs to a facility and same tenant; each newly managed zone belongs to a room and its verified facility/tenant. Existing V2-03 historical zones with no room linkage remain legacy and cannot be considered room-owned by this service.
- `grow/facility/service.go` provides create, bounded tenant-private list/get and revision-checked rename for facilities/rooms/zones; no destructive deletion or reparenting without later audited lifecycle specification. Names must be valid UTF-8, nonempty, bounded and trimmed; identifiers must be opaque; database backend requires UUIDs. Versions increase monotonically on successful edits.
- Only server-verified active OWNER/MANAGER may manage topology via `security.FacilityManage`. A TECHNICIAN/REVIEWER can read subject to `security.View`; MAINTAINER can only observe authorized equipment per prior role policy, so topology read is denied. Scope restrictions remain narrow; cross-tenant parent checks fail closed.
- `grow/facility/postgres.go` uses application-supplied `database/sql` DB and one transaction per operation with a local tenant setting; all queries contain tenant predicate and omit any role escalation. It assumes a previously authorized Scope. No DB driver, external address, login, handler or Web surface is wired here; V2-13 owns frontend and future authenticated adapter must provide the validated principal.
- `0002_rooms.up.sql` adds tenant-keyed rooms, a nullable legacy-safe zone room ID and enforced composite room FK for new zones. FORCE RLS is enforced on rooms. Updates/reads of existing rooms/zones honor DB tenant partition. Legacy unmapped zones require explicit authorized migration strategy, not silent publishing or reparenting.
- Contention uses expected revision and atomic DB update; unknown or unauthorized lookups are concealed as unavailable. No wallet, chain contract, Registry/frozen-address changes or anonymous write access.

## Level 1 exit criteria
1. Policy-backed hierarchy operations and valid read/write flows implemented.
2. Denial cases include bad principal, wrong tenant, wrong parent, mismatched facility/room, least-privilege role, invalid name and stale revision.
3. PostgreSQL migration replay/checksum qualification and negative composite FK/RLS tests against actual database.
4. App Go unit/race/vet/format verification and retained original Grow regressions on exact SHA.
5. Evidence and roadmap record exact implementation SHA, run and job IDs; Level 2 at V2-05, Level 3 only V2-15.

**Limits:** No real production database, login/MFA, public API or UI; no claim of deployment readiness or independently qualified operations/runbook. Later API work must maintain service-side authorization and avoid trusting client-supplied membership.

**Next step:** GROW-V2-05 — Plant lifecycle, genetics and cloning records (Level 2 milestone).
