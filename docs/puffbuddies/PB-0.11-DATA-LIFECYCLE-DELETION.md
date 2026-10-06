# PuffBuddies PB-0.11 data lifecycle and deletion

## Purpose

PB-0.11 defines canonical PuffBuddies data lifecycle and deletion semantics.

It establishes:

- deactivation versus deletion semantics;
- lifecycle states and authority;
- deletion scope;
- retention-purpose boundaries;
- backup/cache/index/derived-data handling;
- safety/moderation evidence exceptions;
- third-party/dependency deletion boundaries;
- immutable/public-chain limitations;
- user-facing completion semantics.

PB-0.11 does not implement databases, deletion workers, retention schedulers, backup systems, object stores, schemas, APIs, contracts, addresses, service IDs, deployments, or live erasure workflows.

## Lifecycle principles

1. Deactivation and deletion are distinct actions.
2. Deactivation is reversible only under later lifecycle policy; deletion is intended to remove PuffBuddies-owned user data to the maximum extent permitted by canonical retention and immutable-record constraints.
3. PuffBuddies deletion does not silently delete unrelated 420Wallet, 420Identity, 420Names, payment-protocol, or other ecosystem state.
4. A deletion request must immediately stop ordinary participation before asynchronous cleanup can finish.
5. Retention requires an explicit purpose, bounded access, bounded duration or review condition, and a documented authority.
6. Backups, caches, indexes, analytics, logs, derived copies, and external processors must preserve the same deletion/privacy semantics as the source data.
7. PuffBuddies must never promise erasure of public-chain records that the protocol cannot actually erase.
8. Safety/legal evidence retention must be narrow and must not recreate a usable dating profile or relationship graph.

## Canonical data-lifecycle invariants

### PB-DATA-001 — Deactivation is not deletion

Deactivation pauses ordinary PuffBuddies participation and visibility according to later lifecycle rules while preserving data necessary for possible reactivation.

Deactivation must not be presented as permanent erasure.

### PB-DATA-002 — Deactivation revokes ordinary participation authority

A deactivated account must not continue ordinary discovery, matching, likes, or match-dependent messaging merely because clients, queues, sessions, or caches still contain earlier authorization.

### PB-DATA-003 — Deactivation does not imply ecosystem-account deletion

Deactivating PuffBuddies does not deactivate or delete the user's 420Wallet, 420Identity, 420Names, or unrelated 420Integrated participation.

### PB-DATA-004 — Deletion is PuffBuddies-scoped

A PuffBuddies deletion request applies to PuffBuddies-owned application data and derived copies subject to explicit canonical exceptions.

It is not an instruction to destroy unrelated canonical ecosystem state.

### PB-DATA-005 — Delete request immediately closes ordinary participation

Once an authenticated deletion request is accepted, ordinary PuffBuddies participation must fail closed even if asynchronous erasure, backup expiry, processor cleanup, or evidence review remains pending.

### PB-DATA-006 — Deletion must not be blocked by payment status

Outstanding or active premium/payment state must not prevent a user from requesting PuffBuddies deletion.

Any legitimately retained accounting record remains bounded to accounting/legal purpose and cannot preserve dating access.

### PB-DATA-007 — Deletion must not require interpersonal consent

A user does not need approval from matches, prior matches, reporters, moderators, or other users to request deletion of that user's PuffBuddies account/profile.

### PB-DATA-008 — Profile and preference data are deletion targets

PuffBuddies-owned profile content, media references, prompts, Dating/Buddy/Both mode, discovery preferences, cannabis/lifestyle preferences, and visibility settings are in-scope deletion targets unless a narrow canonical retention exception applies.

### PB-DATA-009 — Private relationship state is a deletion target subject to safety/audit exceptions

Likes, passes, match/unmatch records, PuffBuddies block relationships, and private relationship metadata should be removed or irreversibly de-identified from ordinary product use when no longer needed for a stated safety, abuse-prevention, legal, or audit purpose.

### PB-DATA-010 — Precise location data requires aggressive minimization

Exact coordinates, raw location observations, and movement history must not be retained merely because an account was once active.

Deletion and retention policy must favor removal or irreversible de-identification unless a documented, narrow purpose requires temporary retention.

### PB-DATA-011 — Message-content deletion is bounded by participant and Messenger authority

PuffBuddies may delete PuffBuddies-controlled message metadata or copies that it owns, but account deletion must not falsely promise erasure of another participant's independently-held message copy or 420Messenger state that PuffBuddies does not canonically own.

Later messaging architecture must define the exact participant-side and Messenger deletion behavior.

### PB-DATA-012 — Notification data follows source lifecycle

PuffBuddies notification intent, payload fragments, and PuffBuddies-owned delivery metadata must expire or be deleted according to the source event's privacy/lifecycle requirements.

420Notifications-owned operational delivery state remains subject to its own canonical retention authority and any PuffBuddies integration contract.

### PB-DATA-013 — Session and access state is revoked on deletion

PuffBuddies sessions, refresh tokens, access tokens, device sessions, delegated PuffBuddies capabilities, and equivalent application authorization must be invalidated when deletion begins.

### PB-DATA-014 — Cached copies cannot preserve deleted authority

Client caches, server caches, workers, queues, search indexes, recommendation caches, derived discovery lists, and local materializations must not keep an account interactable after canonical deletion state revokes it.

### PB-DATA-015 — Search and discovery removal follows deletion

Deleted PuffBuddies profiles must not remain discoverable through PuffBuddies search/discovery surfaces or be republished through 420Search/420Explorer as private-member records.

### PB-DATA-016 — Analytics cannot become a deletion bypass

PuffBuddies analytics and 420Analytics must not preserve user-level private dating state merely by relabeling it as metrics, cohorts, rankings, logs, or derived data.

Where aggregate data is retained, it must not permit practical reconstruction of deleted private user state.

### PB-DATA-017 — Backups are not ordinary active storage

Backups may temporarily contain deleted data only under a documented backup/restore purpose and bounded retention window.

Deleted data restored from backup must re-enter deletion processing before it can return to ordinary application use.

### PB-DATA-018 — Backup retention must be bounded

A backup policy must define retention duration or an equivalent bounded expiry/replacement rule.

"Backups may exist forever" is not an acceptable deletion policy.

### PB-DATA-019 — Logs require purpose and minimization

Operational, security, and audit logs may retain only fields needed for a documented purpose.

Logs must not become an indefinite shadow copy of deleted profiles, preferences, location, relationship graphs, or message content.

### PB-DATA-020 — Derived data inherits source privacy

Embeddings, features, recommendation vectors, moderation features, caches, thumbnails, transformed media, indexes, and other derived artifacts remain subject to the source data's privacy and lifecycle rules unless they are irreversibly anonymized for a permitted purpose.

### PB-DATA-021 — De-identification must resist practical relinking

Replacing a user identifier with a stable hash, wallet address, profile ID, deterministic token, or other reversible/correlatable identifier is not sufficient to claim irreversible anonymization.

### PB-DATA-022 — Moderation evidence may outlive ordinary profile deletion only for a narrow purpose

Reports, evidence, moderation notes, case history, block/ban-evasion evidence, and protected safety audit records may be retained after ordinary profile deletion only when needed for a documented safety, abuse-prevention, legal, dispute, or audit purpose.

### PB-DATA-023 — Safety retention cannot recreate ordinary participation

Retained moderation/safety evidence must not be usable to republish a deleted profile, restore ordinary discovery/matching, market to the user, rank desirability, or create a public reputation record.

### PB-DATA-024 — Retained evidence remains least-privilege

Deletion does not convert safety/legal evidence into broadly accessible operator data.

Access remains purpose-limited, role-limited, auditable, and subject to later retention review.

### PB-DATA-025 — Ban-evasion controls may retain minimum necessary identifiers

Where later policy permits retaining identifiers to prevent ban evasion or serious abuse, the retained set must be the minimum necessary and must not become a general-purpose identity database or public deny list.

### PB-DATA-026 — Legal/regulatory retention requires explicit authority

Any retention required by law, legal process, accounting obligations, or regulatory policy must identify the applicable authority and purpose.

"Legal reasons" without an identified policy basis is not a sufficient indefinite-retention rule.

### PB-DATA-027 — Retention expiry requires deletion or reauthorization

When a retention purpose expires, the retained data must be deleted, irreversibly anonymized, or explicitly reauthorized under a current documented purpose.

### PB-DATA-028 — Processor/dependency copies require lifecycle contracts

Later integrations that receive PuffBuddies private data must define deletion/retention behavior, including how PuffBuddies requests cleanup and how failure or unavailability is handled.

PuffBuddies must not send private data to a dependency that cannot meet the required lifecycle contract.

### PB-DATA-029 — Ecosystem canonical state remains independently owned

420Identity credentials, 420Names records, 420Wallet/account state, ProtocolRegistry records, 420Pay settlement records, and other ecosystem canonical data follow their own authority/lifecycle policies.

PuffBuddies deletion must not falsely claim to erase them.

### PB-DATA-030 — Public-chain immutability is an explicit limitation

If a legitimate PuffBuddies-related public-chain record exists under an approved later design, PuffBuddies must not promise physical deletion of immutable chain history when the chain cannot provide it.

### PB-DATA-031 — Public-chain use must minimize future deletion conflict

Because public-chain history may be irreversible and globally replicated, later PuffBuddies architecture must avoid placing profile content, relationship state, preferences, precise location, moderation evidence, or other deletion-sensitive private data on chain.

### PB-DATA-032 — Deletion cannot rely on encrypt-and-forget alone without policy

Key destruction or cryptographic erasure may be part of a later deletion design, but PB-0.11 does not treat inaccessible ciphertext as automatically equivalent to deletion without an explicit threat, key-lifecycle, backup, and recovery analysis.

### PB-DATA-033 — Account identifiers must not be silently recycled

Later implementation must prevent a newly created PuffBuddies account from unintentionally inheriting deleted relationship, moderation, entitlement, or discovery state merely because an identifier, wallet, device, or name is reused.

### PB-DATA-034 — Re-registration is a new lifecycle decision

A user who later returns after completed deletion must be evaluated under current eligibility, safety, policy, and account-creation rules.

Completed deletion does not guarantee restoration of prior profile, matches, preferences, premium state, or interpersonal consent.

### PB-DATA-035 — Deletion completion must have honest semantics

PuffBuddies may claim deletion COMPLETE only when ordinary PuffBuddies-owned data is removed from active systems and any retained copies are limited to explicitly documented backup, safety, legal, security, or accounting exceptions.

The product must not claim "everything everywhere is erased" when known external/immutable/backup exceptions remain.

### PB-DATA-036 — Deletion evidence must not recreate deleted private state

Protected deletion/audit evidence may record that a lifecycle action occurred, its authorization, timing, scope, and completion status.

It must not preserve unnecessary copies of deleted profile, preference, relationship, location, or message content.

## Lifecycle state model

PB-0.11 defines policy semantics, not database enums. Later implementation should represent enough state to distinguish at least:

- ACTIVE;
- DEACTIVATED;
- DELETE_REQUESTED;
- DELETION_IN_PROGRESS;
- DELETION_COMPLETE;
- a protected retained-evidence condition where necessary without treating the account as active.

Any later state machine must preserve the invariant that DELETE_REQUESTED and later deletion states do not authorize ordinary participation.

## Retention decision rule

Before retaining PuffBuddies private data after it is no longer needed for ordinary product operation, later implementation must document:

1. data class;
2. canonical owner;
3. purpose;
4. legal/policy authority where applicable;
5. minimum fields retained;
6. access roles;
7. duration or review/expiry condition;
8. deletion/anonymization trigger;
9. backup/replica/processor handling;
10. audit evidence;
11. whether the retained form can be practically relinked to the user.

If those answers are absent, continued retention is not canonically justified.

## Deletion-surface checklist

A later deletion implementation must account for every applicable copy/surface:

- primary PuffBuddies profile store;
- profile media/object storage;
- preferences;
- precise/coarse location stores;
- likes/passes/matches/unmatches/blocks;
- report/moderation systems;
- sessions/tokens/devices;
- message metadata/copies owned by PuffBuddies;
- notifications;
- discovery/recommendation caches;
- search/index projections;
- analytics/telemetry;
- operational/security logs;
- backups/snapshots;
- derived features/embeddings/thumbnails;
- payment/entitlement projections;
- approved external processors/dependencies;
- protected deletion/audit evidence.

The checklist does not imply PuffBuddies owns or can erase canonical state belonging to another protocol.

## PB-0.11 completion boundary

PB-0.11 is satisfied when the repository:

- records PB-DATA-001 through PB-DATA-036 exactly once and in sequence;
- distinguishes deactivation from deletion and immediately revokes ordinary participation once deletion begins;
- defines deletion scope for PuffBuddies-owned profile, preference, relationship, location, session, notification, search/discovery, analytics, cache, log, backup, and derived-data surfaces;
- defines narrow moderation/safety/legal/accounting retention exceptions;
- requires purpose, minimum fields, least privilege, bounded retention/expiry, processor handling, and eventual deletion/anonymization;
- explicitly addresses backups and restore behavior;
- explicitly addresses Messenger/participant and 420Integrated dependency ownership boundaries;
- explicitly documents immutable public-chain deletion limitations and minimizes deletion-sensitive on-chain data;
- defines honest deletion-completion semantics and prevents re-registration from silently restoring prior consent/state;
- preserves PB-0.1 through PB-0.10;
- introduces no database, deletion worker, retention scheduler, API, contract, address, service ID, deployment, or false live-erasure claim.
