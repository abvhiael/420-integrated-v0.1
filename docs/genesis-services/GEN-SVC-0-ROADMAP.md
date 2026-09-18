# GEN-SVC-0 — Genesis Consumer Services Architecture Reconciliation

## Purpose

GEN-SVC-0 establishes the common architecture required by the Genesis consumer-service expansion without silently changing the frozen `config/genesis-applications.json` decision. It defines the service registry, shared domain objects, on-chain/off-chain boundary, permissions, moderation model, API conventions, SDK expectations, feature flags, threat model and common integration fixtures used by later GEN-SVC phases.

## Frozen-catalog rule

`config/genesis-applications.json` remains the authoritative frozen Genesis application decision. `config/genesis-consumer-services.json` is a composition and implementation registry. A `GENESIS_FACING_*` role in the consumer-service registry is an implementation target, not an automatic amendment to the frozen application catalog. Promotion into the frozen catalog requires a separate explicit decision update and reconciliation.

## Phase status

- GEN-SVC-0.1 Canonical service registry — IMPLEMENTED
- GEN-SVC-0.2 Shared domain objects — IMPLEMENTED
- GEN-SVC-0.3 On-chain/off-chain boundary — IMPLEMENTED
- GEN-SVC-0.4 Shared permission model — IMPLEMENTED
- GEN-SVC-0.5 Shared moderation model — IMPLEMENTED
- GEN-SVC-0.6 API conventions — IMPLEMENTED
- GEN-SVC-0.7 SDK/service-client contract — IMPLEMENTED AS CONTRACT REQUIREMENT
- GEN-SVC-0.8 Genesis feature flags — IMPLEMENTED
- GEN-SVC-0.9 Threat model — IMPLEMENTED
- GEN-SVC-0.10 Integration fixture/test harness contract — IMPLEMENTED

## GEN-SVC-0.1 — Canonical service registry

Canonical registry: `config/genesis-consumer-services.json`.

The registry records stable service IDs, service roles, Genesis implementation targets, authority classification and direct dependencies for:

- 420Media
- 420Town Community Boards
- 420Classifieds
- 420Travel
- 420Reputation
- 420Events
- 420Location
- 420Launchpad Crowdfunding
- Reefer Review Publishing
- 420Learn + 420Knowledge
- 420University
- 420Mail
- 420Calendar
- 420Freelance

No registry entry may claim consensus, settlement, identity, rights, governance, registry, bridge, validator, treasury or custody authority merely because it is user-facing.

## GEN-SVC-0.2 — Shared domain objects

The common vocabulary is frozen for the phase at:

`User, Organization, Profile, Location, Place, Event, Listing, Review, ReputationRecord, Content, Publication, Community, Post, Comment, Vote, Campaign, Contribution, Reward, Message, Conversation, CalendarEvent, Booking, Job, Gig, Credential, MediaAsset, Stream, Subscription`.

Later application-specific schemas may extend these objects but should not create incompatible duplicate concepts when the shared object applies.

Every object implementation must define:

1. stable opaque ID;
2. owner/authority reference where applicable;
3. creation/update timestamps;
4. visibility scope;
5. provenance/source classification;
6. canonical-vs-derived status;
7. deletion/tombstone behavior where applicable;
8. application namespace and version.

## GEN-SVC-0.3 — On-chain/off-chain boundary

### On-chain by default

Use chain state only for authority-bearing commitments that benefit from deterministic settlement or durable verification, including:

- canonical identity references;
- ownership and rights commitments;
- payments and escrow state;
- verified attestations and credential proofs;
- campaign/settlement state where contracts are authoritative;
- governance-authorized state transitions;
- other protocol-owned commitments explicitly adopted by a protocol decision.

### Off-chain by default

Keep high-volume, private, rebuildable or transport-oriented data off-chain, including:

- video/audio payloads and livestream segments;
- message/mail bodies;
- search indexes and recommendation/feed projections;
- map tiles and geospatial indexes;
- review/article/post/comment bodies unless an app explicitly anchors a digest;
- large media attachments;
- analytics and rankings;
- transient presence and live-chat transport.

A digest or reference may be anchored on-chain without making the underlying off-chain payload canonical protocol state.

## GEN-SVC-0.4 — Shared permission model

Canonical visibility scopes:

- `PUBLIC`
- `UNLISTED`
- `FOLLOWERS`
- `COMMUNITY_ONLY`
- `PURCHASERS_OR_BACKERS`
- `PRIVATE`
- `ORGANIZATION_MEMBERS`
- `MODERATORS`
- `ADMINS`

Rules:

- permissions are evaluated before indexing, delivery and notification fan-out;
- a search/feed service cannot widen visibility;
- admin/moderator capability is scoped to an application/community domain and does not grant wallet or protocol authority;
- private data must not be placed on-chain merely to simplify authorization;
- app services must fail closed when visibility/authorization context is unavailable.

## GEN-SVC-0.5 — Shared moderation model

Canonical moderation actions:

`REPORT, HIDE, BLOCK, MUTE, SUSPEND, APPEAL, MODERATOR_DECISION, RESTORE, LOCK`.

Applications may add domain-specific reasons but must retain compatible state transitions and audit events.

Moderation rules:

- content moderation never mutates canonical ownership, payment, rights or protocol state unless a separate authorized protocol action exists;
- blocking/muting are user-scoped by default;
- community moderators are domain-scoped;
- suspension is application/service scoped unless an explicit authority layer says otherwise;
- appeals preserve prior decision provenance;
- irreversible financial remedies route through the authoritative payment/arbitration layer, not moderation UI.

## GEN-SVC-0.6 — API conventions

All GEN-SVC APIs should use:

- `/v1` version prefix for the first stable service contract;
- cursor-based pagination;
- RFC 3339 UTC timestamps;
- opaque stable object identifiers;
- domain-separated signed payloads for signed actions;
- signed replay-protected webhooks;
- stable machine error codes plus human-readable messages;
- explicit provenance on authority-bearing records;
- idempotency keys for retriable writes that can create payments, bookings, campaigns, contributions, listings or messages;
- explicit pagination limits and rate-limit metadata;
- normalized `created_at`, `updated_at`, `status`, `visibility`, `source` and `version` fields where applicable.

## GEN-SVC-0.7 — SDK/service-client contract

Every service promoted into implementation must expose a typed client in the shared SDK or an application-local client generated from the same canonical service contract.

Minimum client responsibilities:

- service discovery through canonical configuration/Registry where applicable;
- request/response type validation;
- chain/network provenance validation before authority-bearing actions;
- wallet-signing boundary handoff rather than key custody;
- idempotency support;
- consistent pagination and error handling;
- feature-capability discovery;
- compatibility/version reporting.

A later GEN-SVC implementation phase may choose language-specific packages, but must preserve this contract.

## GEN-SVC-0.8 — Genesis feature flags

Canonical feature flags are stored in `config/genesis-consumer-services.json`.

Genesis-enabled baseline:

- `media.livestreaming`

Explicitly deferred by default:

- `travel.bnb_booking`
- `travel.doobr_transactions`
- `mail.external_smtp`
- `university.freelance_ui`
- `launchpad.securities_or_equity`
- `publishing.paid_external_newsletters`
- `calendar.external_provider_sync`

Deferred features must fail closed and be omitted or visibly marked unavailable rather than exposing incomplete paths.

## GEN-SVC-0.9 — Threat model

The mandatory threat domains are documented in `docs/genesis-services/THREAT-MODEL.md` and validated against the registry.

Minimum threat domains:

- spam;
- Sybil abuse;
- fake reviews;
- seller fraud;
- crowdfunding abuse;
- location privacy leakage;
- messaging abuse;
- moderation abuse;
- content/rights abuse;
- escrow failure;
- index poisoning;
- webhook replay.

## GEN-SVC-0.10 — Integration fixture/test harness contract

Canonical fixture personas:

- USER
- BUSINESS
- CREATOR
- MODERATOR
- BUYER
- SELLER
- STUDENT
- PUBLISHER
- BACKER
- TRAVELLER
- FREELANCER
- CLIENT

The fixture contract is described in `docs/genesis-services/INTEGRATION-FIXTURES.md`. Later application phases should reuse these identities and relationship patterns so cross-application journeys can be composed without bespoke fixture semantics.

## Validation

Run:

```bash
python3 scripts/validate-gen-svc-0.py
```

The validator fails if the consumer-service registry:

- stops referencing the frozen application catalog;
- claims that the frozen catalog was modified implicitly;
- contains duplicate service IDs or names;
- omits required shared objects, visibility scopes, moderation actions, API invariants, feature flags, threat domains or fixture personas;
- enables deferred securities/equity crowdfunding at Genesis;
- enables external SMTP, full 420BnB booking or Freelance UI by default;
- omits the core service records expected by the GEN-SVC program.

## Exit criteria

GEN-SVC-0 passes when:

1. the frozen Genesis application decision remains unchanged by this phase;
2. the consumer-service registry is committed and validates cleanly;
3. all later GEN-SVC apps share the same canonical object vocabulary;
4. permissions and moderation boundaries are explicit;
5. authority-bearing state is separated from rebuildable/application data;
6. API and SDK conventions are specified;
7. deferred features are explicitly feature-gated;
8. the shared threat model exists;
9. reusable cross-app fixture personas exist; and
10. CI can execute the GEN-SVC-0 validator before later service phases merge.

## Next phase

After GEN-SVC-0 qualification and merge, proceed to **GEN-SVC-1 — 420Reputation**.
