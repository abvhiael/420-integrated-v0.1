# PB-1.5 — Authorization Primitives

PB-1.5 makes PuffBuddies visibility and private-data access an explicit server-side authorization decision. Authorization composes current eligibility, lifecycle, relationship, block/safety state, requested audience, principal type and purpose-limited service/moderator context.

Hard revocations precede ordinary visibility. DISCOVERABLE requires a current eligible ACTIVE user. MATCHED and participant-scoped access require a current canonical match. Block denies ordinary peer access. Deactivated, suspended, banned and deletion states cannot retain discovery/matched access through stale state. Moderator access requires a documented case context; SERVICE_MINIMUM requires an approved service context. Unknown tables and unrecognized authority fail closed.

The primitives do not implement transport authentication, sessions, APIs, migrations, production storage, workers, contracts, deployments or live dependency adapters.
