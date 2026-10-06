# PuffBuddies PB-0.17 repository structure

## Purpose

PB-0.17 freezes the intended repository layout and ownership boundaries before implementation expands. The paths below are **reserved future structure**, not claims that runtime components already exist.

PB-0.17 creates documentation authority only. It does not create a runtime client, API, domain service, database, worker, integration, contract, fixed/Genesis address, service ID, deployment, or live endpoint.

## Canonical layout

| Reserved path | Canonical purpose | Authority boundary |
| --- | --- | --- |
| `docs/puffbuddies/` | product, architecture, roadmap, audit, qualification, operations documentation | documentation authority only |
| `puffbuddies/web/` | web client presentation and client-local state | never canonical relationship/consent/safety authority |
| `puffbuddies/api/` | authenticated API/edge transport and request adapters | transport boundary; delegates canonical decisions inward |
| `puffbuddies/domain/` | lifecycle, consent, matching, visibility, safety, relationship policy/domain logic | canonical PuffBuddies application decision layer |
| `puffbuddies/storage/` | private persistence adapters, migrations, retention/deletion and cache invalidation | persists state under domain policy |
| `puffbuddies/integrations/` | bounded dependency adapters | capability-limited; dependencies retain only their own domains |
| `puffbuddies/workers/` | asynchronous jobs and projections | derived/subordinate; cannot create canonical authority |
| `puffbuddies/tests/` | integration/adversarial/privacy/consent/lifecycle/deletion/safety tests | qualification only |
| `contracts/src/puffbuddies/` | optional later minimum-disclosure on-chain components | only if explicitly justified later |

App-scoped scripts, workflows, deployment/configuration, fixtures, and generated artifacts follow existing repository conventions rather than create competing top-level authorities.

## Dependency direction

The intended direction is inward:

`web / API / workers / integrations -> domain interfaces -> canonical PuffBuddies policy/state ownership`.

Storage implements domain-owned persistence interfaces. Integrations translate bounded dependency capabilities. A client, adapter, cache, queue, projection, Search/Indexer/Explorer/Analytics surface, payment result, identity result, messaging service, or optional contract must not become canonical owner of PuffBuddies likes, matches, blocks, consent, lifecycle, safety, deletion, visibility, or relationship state.

Circular authority is prohibited: convenience dependencies may not call back into PuffBuddies in a way that manufactures or restores authority the canonical domain revoked.

## Canonical structure invariants

### PB-STRUCT-001 — Documentation authority
`docs/puffbuddies/` is the canonical home for PuffBuddies architecture, roadmap, audit, qualification, and operational documentation.

### PB-STRUCT-002 — Web boundary
`puffbuddies/web/` is reserved for the web client; browser/client state is not canonical security or relationship authority.

### PB-STRUCT-003 — API boundary
`puffbuddies/api/` is reserved for authenticated transport/edge handling and delegates canonical authorization decisions to the domain layer.

### PB-STRUCT-004 — Domain authority
`puffbuddies/domain/` is reserved for PuffBuddies-owned lifecycle, consent, matching, visibility, safety, and relationship policy/domain logic.

### PB-STRUCT-005 — Storage boundary
`puffbuddies/storage/` is reserved for private persistence, migrations, retention/deletion enforcement, and cache invalidation under domain policy.

### PB-STRUCT-006 — Integration boundary
`puffbuddies/integrations/` is reserved for capability-limited dependency adapters and cannot expand a dependency's canonical authority.

### PB-STRUCT-007 — Worker boundary
`puffbuddies/workers/` is reserved for asynchronous jobs whose queues, caches, projections, and outputs remain derived and subordinate.

### PB-STRUCT-008 — Test boundary
`puffbuddies/tests/` is reserved for cross-component/adversarial qualification; colocated unit tests remain permitted by repository convention.

### PB-STRUCT-009 — Optional contract boundary
`contracts/src/puffbuddies/` is reserved only for later explicitly justified minimum-disclosure on-chain components and is not required by product identity.

### PB-STRUCT-010 — Inward dependency direction
Clients, transports, workers, storage adapters, and integrations depend on canonical domain interfaces rather than making the domain depend on presentation or derived-service authority.

### PB-STRUCT-011 — Single canonical owner
No repository area may create a shadow canonical owner for PuffBuddies relationship, consent, block, lifecycle, safety, deletion, matching, or visibility state.

### PB-STRUCT-012 — Derived services remain derived
Search, Indexer, Explorer, Analytics, Notifications, caches, projections, and reporting surfaces remain non-canonical consumers of minimum necessary data.

### PB-STRUCT-013 — Secrets stay out of source control
Credentials, signing material, production secrets, raw eligibility evidence, raw private user data, moderation evidence, and production database contents must not be committed.

### PB-STRUCT-014 — Generated artifacts are non-canonical
Build outputs, caches, local databases, generated credentials, temporary exports, and environment-specific runtime artifacts are not source-of-truth repository state unless an explicit repository rule says otherwise.

### PB-STRUCT-015 — Private state stays private
Repository layout must not create a public/static-data shortcut exposing private profiles, preferences, location, likes, matches, blocks, reports, messages, lifecycle, or safety state.

### PB-STRUCT-016 — Revocation crosses boundaries
Block, unmatch, suspension, ban, deactivation, deletion, eligibility loss, and visibility changes must invalidate stale authority across API, storage, workers, integrations, clients, and derived services.

### PB-STRUCT-017 — New areas require justification
A future new top-level PuffBuddies implementation area must document owner, purpose, authority, data classes, dependency direction, privacy impact, and relationship to PB-0 invariants.

### PB-STRUCT-018 — No parallel deployment authority
Future deployment/configuration must use repository conventions and must not create an undocumented second manifest, address, namespace, or environment authority.

### PB-STRUCT-019 — Reserved does not mean implemented
A path named in PB-0.17 is a reserved architecture location only; absence is valid during PB-0 and presence later requires the roadmap step that actually implements it.

### PB-STRUCT-020 — PB-0 remains non-runtime
PB-0.17 does not authorize or prove runtime features, contracts, services, databases, service IDs, addresses, deployments, clients, or live integrations.

## Source-control rules

Future implementation must keep secrets and protected user/safety data out of Git. Local databases, caches, generated credentials, environment files containing secrets, raw moderation exports, raw eligibility evidence, and production data dumps are prohibited repository content.

Generated build/test outputs remain reproducible artifacts rather than canonical source unless an explicit repository-wide rule requires a particular generated artifact committed.

## PB-12 mobile implementation area authorization

Current **PB-12 — Mobile applications** authorizes a new app-scoped implementation area at `puffbuddies/mobile/` under PB-STRUCT-017.

- **Owner:** PuffBuddies client presentation/runtime.
- **Purpose:** repository source for the iOS and Android PuffBuddies clients plus shared mobile client logic.
- **Authority granted:** presentation, device-local secure session handling, lifecycle resume/revalidation, bounded media handoff, OS notification registration handoff, and verified app-link routing.
- **Authority denied:** relationship creation, consent manufacture, block override, lifecycle/safety adjudication, eligibility assertion, payment truth, Messenger conversation authority, Notifications authority, or any server/domain canonical decision.
- **Data classes:** device-bound session token in native secure storage; transient in-memory derived profile/discovery/match/notification/premium presentation; opaque device/media references only.
- **Dependency direction:** `mobile -> authenticated PuffBuddies API -> canonical domain interfaces`; no domain dependency on mobile presentation code.
- **Privacy impact:** no precise-location permission, wallet-address persistence, raw eligibility evidence, moderation evidence, private-message store, public match graph, or canonical relationship cache is introduced.
- **Revocation behavior:** resume, authority-generation change, protected denial, sign-out, and current safety/lifecycle state invalidate or clear derived client state.
- **Deployment implication:** repository implementation does not assert signed device builds, push-provider credentials, App Store/Play Store distribution, live API binding, testnet or production readiness.
- **Qualification owner:** PB-12 app-specific mobile workflow plus directly affected PB-0 structure/authority verification.

This authorization materializes a new client path after PB-0; it does not retroactively change PB-0.17 into runtime implementation evidence.

## Structure change-control rule

Any later structural change that creates a new top-level PuffBuddies area or changes an ownership boundary must document purpose/owner, data classes, authority granted/denied, dependency direction, privacy/consent/safety/lifecycle/deletion effects, stale-state behavior, public exposure changes, test ownership, deployment implications, and affected PB-0 invariants.

A directory move or adapter split cannot silently transfer canonical authority.

## PB-0.17 completion boundary

PB-0.17 is satisfied when PB-STRUCT-001 through PB-STRUCT-020 freeze the intended layout, future paths are distinguished from implemented paths, source-control exclusions and dependency direction are explicit, shadow authority is prohibited, accumulated PB-0 invariants remain intact, and no runtime implementation is introduced merely to demonstrate structure.
