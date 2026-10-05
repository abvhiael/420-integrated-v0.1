# PuffBuddies PB-0.4 privacy invariants

## Purpose

PB-0.4 defines stable privacy invariants that every later PuffBuddies implementation, integration, client, service, contract, storage layer, indexer projection, analytics pipeline, moderation workflow, and release must preserve.

PB-0.3 determines **where classes of data may live**. PB-0.4 determines **what privacy guarantees must remain true regardless of implementation detail**.

This step does not choose cryptographic protocols, databases, retention periods, identity vendors, messaging internals, or deployment topology. Those belong to later roadmap steps.

## Privacy principles

PuffBuddies privacy is governed by five principles:

1. **Minimum disclosure** — reveal only the fact needed for the current authorization or product action.
2. **Purpose limitation** — data collected for one PuffBuddies purpose must not silently become a different product, advertising, ranking, or public-identity purpose.
3. **Relationship confidentiality** — ordinary observers must not be able to reconstruct likes, matches, blocks, reports, conversations, or relationship history.
4. **User separation** — wallet identity, ecosystem identity, legal identity, and PuffBuddies dating/social identity are distinct concepts unless the user intentionally links an allowed public field.
5. **Deletion-aware design** — data expected to be deletable must not be unnecessarily placed in immutable or publicly replicated systems.

## Canonical privacy invariants

### PB-PRIV-001 — Adult eligibility without public birth data

PuffBuddies may require proof that a user satisfies the canonical adult eligibility policy, but date of birth, identity-document images, government identifiers, and equivalent source evidence must not become public PuffBuddies state.

Where possible, PuffBuddies should consume a conclusion such as "eligible for PuffBuddies" rather than the underlying birth date or identity record.

### PB-PRIV-002 — Precise location confidentiality

Exact coordinates, raw GPS history, exact home/work address, precise movement history, and equivalent high-resolution location data must never be publicly exposed by PuffBuddies.

Discovery may later use approximate distance or coarse area, but the implementation must prevent reverse inference of precise location from API responses, map cells, sorting behavior, repeated queries, or public metadata.

### PB-PRIV-003 — Like and pass confidentiality

Likes and passes are private user intent.

A user's like or pass history must not be publicly queryable, publicly indexable, visible to unrelated users, exposed through wallet activity, or inferable through public blockchain state.

Later product design may intentionally reveal a like to its intended recipient where canonically authorized, but that does not make the global like graph public.

### PB-PRIV-004 — Match confidentiality

The existence, history, timing, and membership of a PuffBuddies match are private to the authorized participants and necessary private services.

The public must not be able to reconstruct the PuffBuddies match graph from chain activity, public APIs, Search, Explorer, Indexer, notifications, payment metadata, analytics, or predictable identifiers.

### PB-PRIV-005 — Message confidentiality

Private messages, attachments, reactions, and conversation content must remain confidential to authorized participants and only the narrowly-authorized systems required to deliver, protect, or moderate the service.

Private message content must never be public blockchain state or public search/index content.

Later Messenger architecture owns exact encryption and key-management semantics.

### PB-PRIV-006 — Preference confidentiality

Sexual, romantic, gender, age-range, relationship, cannabis, lifestyle, family, distance, and other discovery preferences are private application data.

Preferences must not become public identity attributes, public wallet metadata, public registry fields, public search filters about a user, or public-chain profile attributes.

### PB-PRIV-007 — Wallet/profile unlinkability

Knowledge of a public wallet address, 420Name, transaction history, token balance, or public ecosystem account must not provide a canonical public lookup from that identifier to PuffBuddies membership or profile identity.

Authentication may prove wallet control privately without creating public dating-profile discoverability.

### PB-PRIV-008 — PuffBuddies deletion independence

A user must be able to delete or deactivate PuffBuddies participation without being required to delete 420Wallet, 420Identity, 420Names, or unrelated 420Integrated state.

Later lifecycle/retention work may define narrow safety, legal, fraud, payment, or immutable-record exceptions, but those exceptions must not be used to preserve ordinary dating-profile state indefinitely.

### PB-PRIV-009 — Minimum disclosure by default

Every integration must request, receive, persist, and expose only the minimum data required for its documented PuffBuddies purpose.

Examples:

- consume an eligibility boolean/conclusion instead of date of birth where possible;
- consume a payment/entitlement conclusion instead of a user's broader transaction history;
- consume messaging authorization rather than exposing the user's full match graph to unrelated services;
- consume approximate discovery distance rather than exposing raw coordinates to clients that do not need them.

### PB-PRIV-010 — No privacy downgrade through metadata

Privacy guarantees apply to metadata as well as primary content.

Logs, events, request identifiers, notification payloads, URLs, cache keys, analytics events, telemetry, tracing spans, filenames, object keys, payment memos, and error messages must not unnecessarily encode sensitive profile, preference, match, block, report, location, or conversation information.

### PB-PRIV-011 — No hidden public correlation identifier

PuffBuddies must not create a stable public identifier derived from wallet address, legal identity, phone/email, device identifier, profile identifier, or private preferences if that identifier permits third parties to correlate a person across PuffBuddies and other systems.

Internal identifiers may exist, but their visibility and correlation risk must be constrained by later architecture.

### PB-PRIV-012 — No deterministic sensitive-data confirmation

Sensitive values must not be protected solely by deterministic unsalted hashes or predictable commitments when an observer can guess candidate values and confirm them.

Any later commitment scheme involving sensitive data must provide suitable entropy/privacy properties and a documented verification purpose.

### PB-PRIV-013 — Private safety actions

Blocks, reports, safety flags, moderation evidence, internal risk signals, and appeal records are private.

A blocked or reported person must not gain access to private report content, reporter evidence, internal risk signals, or moderation notes merely because they are the subject of an action.

Later safety policy may define what notice is appropriate without violating reporter or victim privacy.

### PB-PRIV-014 — Notification privacy

Notifications must not expose sensitive dating or safety information beyond what is appropriate for the notification surface.

Lock-screen, email, push, browser, and shared-device notifications must be designed so that private message content, profile identity, match state, report status, or other sensitive context is not unnecessarily disclosed.

Exact notification presentation is defined later.

### PB-PRIV-015 — Analytics minimization

Analytics must not create a second user-level dating surveillance system.

PuffBuddies analytics should prefer aggregate, privacy-safe measures. User-level analytics events must be limited, purpose-defined, access-controlled, and must not expose private preference, message, match, block, report, or precise-location data without a documented operational necessity.

### PB-PRIV-016 — Search and discovery cannot become public enumeration

PuffBuddies discovery is an authorized in-app product function, not a public people-search engine.

Public Search, Explorer, wallet lookup, or unauthenticated APIs must not allow enumeration of PuffBuddies members, profiles, matches, preferences, or dating participation.

### PB-PRIV-017 — Access follows least privilege

Internal services, moderators, operators, support tools, and administrators must not receive unrestricted access to all PuffBuddies private data merely because they operate the system.

Later architecture must apply role- and purpose-appropriate access controls, with stronger restrictions for messages, identity evidence, reports, precise location, and private preferences.

### PB-PRIV-018 — Backups and derived data preserve privacy semantics

Backups, replicas, caches, search indexes, derived models, exports, logs, data warehouses, and disaster-recovery copies must preserve the same privacy classification as their source data.

Moving or deriving data does not make it less sensitive.

### PB-PRIV-019 — Retention must have a stated purpose

Private PuffBuddies data must not be retained indefinitely by default.

Later PB-0.11 data-lifecycle work must define retention/deletion rules by data class, including justified exceptions for safety, abuse prevention, legal obligations, settlement evidence, and immutable public protocol records.

PB-0.4 establishes the invariant that retention requires an explicit purpose.

### PB-PRIV-020 — No privacy sale or consent bypass

Payment, subscription, token ownership, staking, governance status, operator privilege, or administrative role must not buy access to another user's precise location, private preferences, report content, private messages, match graph, block state, or other protected PuffBuddies data.

This privacy invariant complements but does not replace PB-0.5 consent invariants.

## Privacy inference threats

Later implementations must account for privacy loss through inference even when raw fields are hidden.

Examples include:

- repeatedly changing a distance filter to triangulate location;
- observing online/offline timing to infer conversation partners;
- correlating payment timestamps with match or messaging events;
- correlating wallet transactions with profile activity;
- enumerating predictable profile IDs;
- probing block/report behavior to infer private safety actions;
- using response-time differences to reveal whether a target profile exists;
- using notification timing to reveal a match or message relationship;
- combining coarse attributes until a user becomes uniquely identifiable;
- reconstructing deleted profiles from stale caches, indexes, analytics, or backups.

## Privacy by surface

### Public blockchain

May expose only deliberately public protocol state permitted by PB-0.3 and later architecture. It must not expose private dating state directly or indirectly.

### PuffBuddies web/mobile clients

May show private data only to the authorized user or authorized relationship audience. Clients must not receive sensitive fields merely because they could hide them visually.

### Backend/API

Must enforce authorization server-side. Client-side hiding is not a privacy boundary.

### 420Messenger

Must receive only the relationship/authorization context necessary to support private messaging. Exact integration remains PB-6.

### 420Notifications

Must receive only the minimum event data needed to deliver an authorized notification. Exact integration remains PB-7.

### 420Pay / entitlement systems

Must not receive private dating preferences, match graphs, reports, messages, or precise location to process ordinary PuffBuddies payment/entitlement state.

### 420Indexer / Explorer / Search

Must not ingest private PuffBuddies application state merely to make it searchable. Public services remain limited to legitimately public protocol state.

### Moderation/support tooling

May require narrowly-authorized access to reports, evidence, or account state. Access must be purpose-limited and auditable; ordinary operators must not receive blanket private-data access.

## Data disclosure decision rule

Before any later component exposes or persists a PuffBuddies field outside its current trust boundary, the implementation must be able to answer:

1. What exact PuffBuddies purpose requires this field?
2. What is the minimum form of the data that satisfies that purpose?
3. Who must be able to read it?
4. Who must not be able to read it?
5. Is public persistence actually necessary?
6. Can an observer infer a sensitive fact from metadata or correlation?
7. What is the deletion/retention consequence?
8. What happens if this data is breached?
9. Does the disclosure preserve PB-0.1 through PB-0.4 invariants?

If the purpose can be satisfied with less disclosure, the less-disclosing design is canonical.

## PB-0.4 completion boundary

PB-0.4 is satisfied when the repository:

- records PB-PRIV-001 through PB-PRIV-020 exactly once and in sequence;
- covers eligibility, precise location, likes/passes, matches, messages, preferences, wallet correlation, deletion independence, and minimum disclosure;
- covers metadata, identifiers, deterministic hashes, safety actions, notifications, analytics, public enumeration, least privilege, backups/derived data, and retention;
- explicitly addresses inference/correlation attacks;
- defines privacy expectations by major ecosystem surface without claiming those integrations are implemented;
- preserves PB-0.1 product identity, PB-0.2 MVP scope, and PB-0.3 blockchain/off-chain boundary;
- introduces no contract, fixed address, service ID, storage implementation, or false live-integration claim.
