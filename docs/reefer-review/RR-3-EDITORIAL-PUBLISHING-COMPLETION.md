# RR-3 — Editorial Publishing Completion

RR-3 completes the repository-stage editorial lifecycle defined by the canonical roadmap: article reader, writer/publish workflow, revisions, tombstone lifecycle, restricted reads, moderation dashboard/history, and API/client parity.

## RR-3.A — Article reader

The web app exposes `#article/{publicationID}` and reads current article content through `GET /v1/publications/{id}`. Public and unlisted published content can be read without an actor. Restricted content requires the current repository-stage actor and backend authorization.

## RR-3.B — Writer and publish workflow

The Editorial workspace supports repository-stage actor selection, draft creation, editing title/summary/body/visibility, publishing DRAFT records, and listing editorial records scoped to the current author or development moderator/publisher authority.

## RR-3.C — Revision history

Every draft starts with revision 1. Every accepted edit appends a new `PublicationRevision`; prior revisions remain preserved. Published edits require a fresh Rights assertion over the new body digest before the new revision becomes current.

## RR-3.D — Tombstone lifecycle

DRAFT, PUBLISHED, or HIDDEN records may transition to TOMBSTONED when authorized. Tombstoning removes Search projection best-effort, blocks article reads, and blocks later edits. Physical deletion/retention policy remains later work.

## RR-3.E — Restricted reads

`GetForActor` applies the development visibility policy across PUBLIC, UNLISTED, PRIVATE, FOLLOWERS, COMMUNITY_ONLY, ORGANIZATION_MEMBERS, MODERATORS, and ADMINS. RR-4 replaces these development semantics with production 420Identity/Wallet capabilities.

## RR-3.F — Moderation dashboard and history

HIDE, RESTORE, and TOMBSTONE actions persist actor, action, reason, from/to status, and timestamp. The web moderation dashboard exposes scoped controls and history inspection.

## RR-3.G — API/client parity

New API surface:
- `GET /v1/editorial/publications`
- `PUT /v1/publications/{id}`
- `POST /v1/publications/{id}/tombstone`
- `GET /v1/publications/{id}/revisions`
- `GET /v1/publications/{id}/moderation`

The Go client covers readiness, get, update, publish, moderate, tombstone, revisions, moderation history, editorial list, public list, and RR-1 news interfaces.

## RR-3.H — Security and lifecycle invariants

Qualification must verify unauthorized edit rejection, private-read fail-closed behavior, tombstone terminal behavior, fresh rights evidence for published revisions, preserved revision history, durable moderation reasons, scoped editorial listing, and retained RR-2 safe-DOM/provenance behavior.

## Milestone

RR-3 completes the documented RR-2/RR-3 user-facing/editorial convergence and therefore requires app-scoped Level 2 qualification after Level 1 passes on the same exact implementation SHA.

## Exit criteria

RR-3 is complete when RR-3.A through RR-3.H are implemented, Level 1 passes on the exact implementation SHA, retained RR-1/RR-2/audit regressions pass, Level 2 app integration passes on that exact SHA, and durable evidence is committed.

## Next canonical step

**RR-4 — Identity & Permissions**
