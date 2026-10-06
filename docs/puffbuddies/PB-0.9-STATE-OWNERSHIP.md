# PuffBuddies PB-0.9 state ownership

## Purpose

PB-0.9 defines the canonical owner for every PuffBuddies state class.

For each state class, this document distinguishes:

- canonical authority owner;
- permitted writers/mutators;
- permitted readers/consumers;
- permitted derived/cache/projection copies;
- explicit non-authorities;
- freshness/revocation expectations.

PB-0.9 does not implement storage, database schemas, contracts, APIs, clients, service IDs, addresses, or live integrations.

## Ownership principles

1. Every security-relevant state class must have one canonical authority owner.
2. A cache, projection, index, analytics view, notification, client copy, or payment record does not become canonical merely because it contains similar data.
3. Conflicts resolve in favor of the canonical authority, never the broadest-access copy.
4. Derived systems must be rebuildable from canonical sources where their role permits.
5. Private PuffBuddies relationship state remains private/off-chain unless an earlier canonical invariant explicitly allows otherwise.
6. External dependencies retain authority only inside their own repository-defined domains.

## Canonical state ownership

### PB-STATE-001 — Wallet/account-control state

**Canonical owner:** 420Wallet / canonical account authority.

PuffBuddies may consume proof of current account control and approved session/capability grants.

PuffBuddies does not own private keys, passkey secrets, recovery material, or global wallet authority.

### PB-STATE-002 — PuffBuddies application membership state

**Canonical owner:** PuffBuddies private application state.

Whether an otherwise-valid ecosystem account currently has a PuffBuddies application account/profile is PuffBuddies-owned private state.

Wallet, Names, Identity, Registry, AppStore, Search, Explorer, and Analytics must not become membership authority.

### PB-STATE-003 — Adult eligibility evidence source state

**Canonical owner:** canonical identity/attestation authority, expected to be 420Identity or an approved successor/interface.

Raw age/identity evidence remains owned by the identity/attestation authority.

PuffBuddies consumes only the minimum approved eligibility conclusion.

### PB-STATE-004 — PuffBuddies eligibility decision state

**Canonical owner:** PuffBuddies policy evaluation over current authoritative identity/attestation evidence.

The identity system owns evidence/credential lifecycle; PuffBuddies owns the product-specific decision of whether that evidence satisfies current PuffBuddies policy.

Cached eligibility conclusions are non-authoritative when stale, expired, revoked, or policy-incompatible.

### PB-STATE-005 — PuffBuddies profile state

**Canonical owner:** PuffBuddies private application state.

Profile text, prompts, photos/media references, Dating/Buddy/Both mode, visibility state, and other PuffBuddies profile fields are PuffBuddies-owned.

Identity and Names may contribute bounded display/verification inputs but do not own the dating/social profile.

### PB-STATE-006 — Discovery preference state

**Canonical owner:** PuffBuddies private application state.

Age ranges, relationship preferences, cannabis compatibility preferences, lifestyle filters, distance preferences, and other discovery criteria are PuffBuddies-owned private state.

They must not become public Identity, Names, Registry, Search, Explorer, or Analytics authority.

### PB-STATE-007 — Precise location state

**Canonical owner:** PuffBuddies private location-processing boundary or an approved private location service acting under PuffBuddies authority.

Exact coordinates, raw GPS observations, and movement history are not owned by public-chain, Search, Explorer, Analytics, or payment systems.

Any coarse/derived discovery result remains subordinate to the private location authority.

### PB-STATE-008 — Discovery candidate/result state

**Canonical owner:** PuffBuddies discovery service as a derived, non-canonical view over current canonical profile, preference, eligibility, visibility, safety, and location state.

Discovery results are recalculable and must not become authority over the underlying profile, block, match, or eligibility state.

### PB-STATE-009 — Like state

**Canonical owner:** PuffBuddies private relationship state.

A like is an explicit PuffBuddies user action recorded under PuffBuddies authority.

Wallet signatures may authenticate the actor, but Wallet does not own like state.

### PB-STATE-010 — Pass state

**Canonical owner:** PuffBuddies private relationship state.

Pass history is PuffBuddies-owned private state and must not be elevated into public analytics/search authority.

### PB-STATE-011 — Match state

**Canonical owner:** PuffBuddies private relationship state.

PuffBuddies owns whether reciprocal consent currently forms an active match.

Messenger conversations, notification events, payment state, AppStore state, or cached client state must not manufacture or restore a match.

### PB-STATE-012 — Unmatch state

**Canonical owner:** PuffBuddies private relationship state.

An unmatch is authoritative when accepted by PuffBuddies state and revokes match-dependent PuffBuddies authorization.

Messenger, notifications, queues, caches, and clients must follow the updated state rather than preserve stale authorization.

### PB-STATE-013 — PuffBuddies block state

**Canonical owner:** PuffBuddies private safety/relationship state.

PuffBuddies block state has supremacy over prior match/like/messaging/premium state.

A Messenger-native block is an additional deny condition. Messenger-native block state does not replace or weaken PuffBuddies block authority.

### PB-STATE-014 — Messenger-native block state

**Canonical owner:** 420Messenger within its own messaging domain.

PuffBuddies must respect a current Messenger-native deny where relevant to message delivery.

Messenger block state does not become authority for PuffBuddies profile visibility, eligibility, moderation history, or general application lifecycle.

### PB-STATE-015 — Conversation authorization state

**Canonical owner:** PuffBuddies for dating/social relationship authorization; 420Messenger for Messenger-native transport/conversation authority.

The effective permission to send a PuffBuddies matched-user message is the intersection of both authorities.

A deny from either applicable authority must fail closed.

### PB-STATE-016 — Message coordination/envelope state

**Canonical owner:** 420Messenger for its canonical messaging-coordination domain.

Endpoint state, conversation state, envelope commitments, and delivery/read coordination remain Messenger-owned.

PuffBuddies must not create a competing canonical Messenger transport state.

### PB-STATE-017 — Message plaintext/content state

**Canonical owner:** authorized message participants and the approved encrypted messaging/storage boundary, not public chain state.

PuffBuddies does not gain unrestricted plaintext authority merely because it authorized the relationship.

Any moderation access remains narrowly scoped under later policy.

### PB-STATE-018 — Notification event intent state

**Canonical owner:** PuffBuddies for deciding that a PuffBuddies event should generate a notification.

PuffBuddies owns the semantic event: for example, match-created, message-available, safety/account change, or service-state event.

### PB-STATE-019 — Notification delivery/presentation state

**Canonical owner:** 420Notifications for non-canonical delivery/presentation state.

Retries, provider acknowledgements, delivery receipts, and presentation state do not override PuffBuddies account, relationship, eligibility, or safety authority.

### PB-STATE-020 — Report state

**Canonical owner:** PuffBuddies private safety/moderation state.

Report submission, reporter linkage, target linkage, report category, evidence references, and current case status are PuffBuddies-owned private state.

### PB-STATE-021 — Moderation evidence and case-history state

**Canonical owner:** PuffBuddies private safety/moderation authority.

Evidence, notes, risk signals, adjudication history, and appeal records remain private and access-controlled.

Analytics, Search, Explorer, AppStore, Pay, and public Registry state must not become moderation authority.

### PB-STATE-022 — Suspension/ban state

**Canonical owner:** PuffBuddies safety/lifecycle authority.

Suspension or ban may restrict otherwise eligible/matched users and takes precedence over ordinary participation authorization.

Identity eligibility, Wallet control, Pay entitlement, or Messenger conversation state cannot override it.

### PB-STATE-023 — Account activation/deactivation state

**Canonical owner:** PuffBuddies lifecycle authority.

Whether the PuffBuddies application account/profile is active, paused, or deactivated is PuffBuddies-owned.

This state is distinct from whether Wallet, Identity, or Names remain active elsewhere in 420Integrated.

### PB-STATE-024 — PuffBuddies deletion state

**Canonical owner:** PuffBuddies lifecycle/data-governance authority.

PuffBuddies owns the request and execution state for deleting PuffBuddies application data, subject to later retention/legal/safety rules.

Deletion does not delete unrelated 420Wallet, 420Identity, or 420Names state.

### PB-STATE-025 — Identity profile/credential state

**Canonical owner:** 420Identity.

PuffBuddies may consume approved credential/profile results but cannot mutate Identity truth merely because a dating profile changes.

### PB-STATE-026 — .420 name state

**Canonical owner:** 420Names.

Name ownership, expiry, forward/reverse resolution, and canonical name transfer remain Names-owned.

PuffBuddies display caches must re-resolve current canonical name state when security or identity presentation depends on it.

### PB-STATE-027 — Service identity/version state

**Canonical owner:** 420Registry / ProtocolRegistry.

Canonical service identity, implementation/version history, activation/deprecation state, and registration commitments remain Registry-owned.

PuffBuddies configuration caches and AppStore views are subordinate.

### PB-STATE-028 — AppStore catalogue/presentation state

**Canonical owner:** 420AppStore for its non-canonical catalogue/presentation metadata.

Catalogue title, screenshots, category, descriptions, ranking, and similar AppStore presentation data do not become canonical PuffBuddies product or protocol state.

### PB-STATE-029 — Payment settlement state

**Canonical owner:** 420Pay and the underlying canonical payment/settlement protocol for the integrated payment domain.

PuffBuddies must not maintain a contradictory canonical payment truth.

### PB-STATE-030 — PuffBuddies premium entitlement state

**Canonical owner:** PuffBuddies entitlement policy evaluated from approved current payment/subscription evidence.

420Pay owns settlement evidence; PuffBuddies owns the product-specific conclusion that a particular feature entitlement is currently active.

Entitlement never owns consent, block, eligibility, or another user's private-data access.

### PB-STATE-031 — Public chain/protocol observation state

**Canonical owner:** the underlying chain/protocol contract that owns the record.

PuffBuddies may observe canonical public state directly or through qualified derived projections, but the projection does not replace source authority.

### PB-STATE-032 — Indexer projection state

**Canonical owner:** none; 420Indexer projections are derived/rebuildable observations.

Indexer is not canonical authority. It may own its local projection database operationally but not the canonical protocol truth represented by that database.

### PB-STATE-033 — Search/Explorer presentation state

**Canonical owner:** none for underlying protocol truth; Search/Explorer own only their derived presentation/indexing artifacts.

Their results must never become canonical PuffBuddies membership, relationship, safety, or private-profile state.

### PB-STATE-034 — PuffBuddies analytics event/aggregate state

**Canonical owner:** none for product authority; approved PuffBuddies analytics datasets are derived, purpose-limited, and rebuildable where possible.

Analytics must not become a shadow canonical store for private dating state.

### PB-STATE-035 — 420Analytics outputs

**Canonical owner:** none for underlying PuffBuddies truth; 420Analytics owns only its non-canonical derived metric methodology/output domain.

Metrics, cohorts, rankings, anomalies, and forecasts must never mutate PuffBuddies canonical user state.

### PB-STATE-036 — Client/UI state

**Canonical owner:** none for protected server authority.

Browser/mobile local state, optimistic UI, cached cards, unread badges, and locally persisted settings are presentation copies unless a later canonical specification explicitly says otherwise.

Security-sensitive actions must recheck authoritative server/protocol state.

### PB-STATE-037 — Session/access-token state

**Canonical owner:** PuffBuddies authentication/session authority for PuffBuddies sessions, while Wallet/capability systems retain authority over any underlying wallet/session capability they issue.

A client-held token is evidence of a granted session, not independent authority beyond its scope/expiry/revocation.

### PB-STATE-038 — Rate-limit/anti-abuse operational state

**Canonical owner:** PuffBuddies security/abuse-prevention services.

Rate-limit counters, bot scores, abuse heuristics, and operational deny signals are security state, not public profile or social-ranking state.

They must not silently become a public desirability/reputation score.

### PB-STATE-039 — Configuration/policy-version state

**Canonical owner:** the later-designated PuffBuddies configuration/policy authority, resolved through approved repository/deployment governance and Registry mechanisms where applicable.

Clients, caches, and downstream services must not override a newer authoritative policy version with stale local configuration.

### PB-STATE-040 — Audit/security evidence state

**Canonical owner:** PuffBuddies protected audit/security authority for PuffBuddies-specific operational evidence.

Audit records support incident diagnosis and qualification but must not become public relationship, moderation, or identity registries.

## Canonical ownership matrix

| State class | Canonical owner | Derived/cache consumers | Explicit non-authorities |
| --- | --- | --- | --- |
| wallet/account control | 420Wallet/account authority | PuffBuddies session/auth | PuffBuddies profile DB, AppStore, Analytics |
| PuffBuddies membership | PuffBuddies private app state | client/session caches | Wallet, Names, Registry, Search |
| eligibility evidence | 420Identity/approved attestation authority | PuffBuddies eligibility evaluator | client self-assertion, Pay |
| eligibility decision | PuffBuddies policy evaluator | session/profile cache | Wallet, Pay, AppStore |
| profile/preferences | PuffBuddies private app state | discovery client views | Identity, Registry, public Search |
| precise location | private PuffBuddies location boundary | coarse discovery derivations | public chain, Analytics |
| likes/passes/matches | PuffBuddies private relationship state | client/discovery views | Wallet, Messenger, Pay |
| PuffBuddies blocks | PuffBuddies safety/relationship state | Messenger gateway, discovery | Pay, Notification, cache |
| Messenger block/coordination | 420Messenger | PuffBuddies messaging gateway | PuffBuddies discovery/profile |
| notifications | PuffBuddies event intent + 420Notifications delivery | clients/providers | notification receipts as auth |
| reports/moderation | PuffBuddies safety authority | authorized moderation tooling | Analytics, AppStore, public services |
| lifecycle/delete | PuffBuddies lifecycle authority | clients/support tools | Wallet/Identity deletion |
| name state | 420Names | PuffBuddies display cache | profile DB as canonical name authority |
| identity credentials | 420Identity | PuffBuddies policy evaluator | PuffBuddies direct credential mutation |
| service discovery | 420Registry | AppStore/Indexer/client caches | AppStore as Registry replacement |
| payment settlement | 420Pay/payment protocol | PuffBuddies entitlement evaluator | entitlement cache as payment truth |
| premium entitlement | PuffBuddies entitlement policy | client UI | Pay as interpersonal consent |
| chain public records | owning protocol contract | Indexer/Explorer/Search | derived services |
| analytics | derived/non-canonical | dashboards | canonical PuffBuddies state |
| client/UI cache | none for protected authority | user device | security-sensitive authority |

## Conflict-resolution rule

When two copies disagree:

1. identify the canonical owner of the state class;
2. reject stale or unauthorized derived copies;
3. re-resolve current canonical state;
4. apply revocation/finality/freshness rules;
5. fail closed where the protected decision remains uncertain.

The broadest-access or most convenient copy must never win merely because it is available.

## PB-0.9 completion boundary

PB-0.9 is satisfied when the repository:

- records PB-STATE-001 through PB-STATE-040 exactly once and in sequence;
- defines canonical owners for wallet/account control, PuffBuddies membership, eligibility evidence/decision, profiles/preferences, precise location, discovery results, likes/passes/matches/unmatches, PuffBuddies and Messenger block state, messaging, notifications, reports/moderation, lifecycle/deletion, Identity, Names, Registry, AppStore, payments/entitlements, chain observations, Indexer, Search/Explorer, Analytics, client state, sessions, abuse-prevention state, configuration, and audit evidence;
- distinguishes canonical ownership from operational storage and derived/cache ownership;
- defines conflict resolution in favor of canonical authority;
- preserves PB-0.1 through PB-0.8;
- introduces no database implementation, API, contract, address, service ID, deployment, or false live-wiring claim.
