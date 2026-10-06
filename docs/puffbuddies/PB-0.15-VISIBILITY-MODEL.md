# PuffBuddies PB-0.15 visibility model

## Purpose

PB-0.15 defines the canonical audiences that may receive PuffBuddies fields and relationship-derived data.

It distinguishes:

- PRIVATE_SELF;
- DISCOVERABLE;
- MATCHED;
- PARTICIPANT_ONLY;
- MODERATOR_ONLY;
- SERVICE_MINIMUM;
- AGGREGATE_ONLY;
- PUBLIC_EXPLICIT;
- NEVER_PUBLIC.

Visibility is an authorization boundary, not merely a user-interface setting.

PB-0.15 defines policy only. It does not implement profile schemas, ACL engines, APIs, databases, clients, contracts, service IDs, addresses, deployments, or live visibility enforcement.

## Visibility principles

1. The default for sensitive PuffBuddies data is the narrowest audience that satisfies the product purpose.
2. DISCOVERABLE means visible only inside authorized PuffBuddies discovery; it does not mean public internet visibility.
3. MATCHED means visible only to a currently authorized matched participant where the field is specifically allowed.
4. MODERATOR_ONLY is purpose-limited and least-privilege, not blanket staff access.
5. PUBLIC_EXPLICIT requires an intentional user choice and must still exclude fields prohibited from public disclosure.
6. Visibility cannot override block, lifecycle, safety, eligibility, deletion, or consent authority.
7. Cached or derived copies inherit the source field's audience restrictions.

## Canonical visibility invariants

### PB-VIS-001 — PRIVATE_SELF audience

PRIVATE_SELF fields are visible only to the user and narrowly authorized internal services required to provide the user's own account experience.

### PB-VIS-002 — DISCOVERABLE audience

DISCOVERABLE fields may be shown only to authenticated, eligible PuffBuddies users who are currently authorized to receive that profile in discovery.

DISCOVERABLE does not imply unauthenticated, public, Search, Explorer, wallet, or chain visibility.

### PB-VIS-003 — MATCHED audience

MATCHED fields may be shown only to the other participant while a current authorized match relationship permits that field.

A prior match, stale cache, or archived conversation does not preserve MATCHED visibility after canonical revocation.

### PB-VIS-004 — PARTICIPANT_ONLY audience

PARTICIPANT_ONLY applies to relationship-specific content visible only to the directly authorized participants, such as private conversation content and explicitly shared relationship-scoped data.

### PB-VIS-005 — MODERATOR_ONLY audience

MODERATOR_ONLY data may be accessed only by authorized safety/moderation roles for a documented case/purpose under least privilege.

### PB-VIS-006 — SERVICE_MINIMUM audience

SERVICE_MINIMUM data may be disclosed only to an approved dependency/service in the minimum form necessary for a documented operation.

The receiving service does not gain broader PuffBuddies visibility authority.

### PB-VIS-007 — AGGREGATE_ONLY audience

AGGREGATE_ONLY data may be used only in privacy-safe aggregate/derived form that does not expose or practically reconstruct protected individual PuffBuddies state.

### PB-VIS-008 — PUBLIC_EXPLICIT audience

PUBLIC_EXPLICIT is allowed only for a field explicitly approved for public presentation and intentionally enabled by the user under later UX/policy.

PUBLIC_EXPLICIT does not authorize public disclosure of fields classified NEVER_PUBLIC.

### PB-VIS-009 — NEVER_PUBLIC audience

NEVER_PUBLIC fields must not be exposed through public APIs, public chain state, Registry, AppStore, Search, Explorer, wallet lookup, analytics output, public profile pages, or other publicly enumerable surfaces.

### PB-VIS-010 — Default deny for undefined audience

A PuffBuddies field without an explicit visibility classification must not be exposed beyond PRIVATE_SELF/SERVICE_MINIMUM handling required to establish its proper classification.

## Canonical field audience rules

### PB-VIS-011 — Membership is not publicly enumerable

PuffBuddies membership/account existence is not public merely because the user has a Wallet, Identity profile, .420 name, or other 420Integrated presence.

### PB-VIS-012 — Core profile presentation may be DISCOVERABLE

Later-approved display name/pseudonym, profile photo, general bio/prompts, mode, coarse location presentation, and other ordinary profile presentation fields may be DISCOVERABLE when specifically classified and current.

### PB-VIS-013 — Discovery preferences are PRIVATE_SELF

Age ranges, gender/orientation preferences, relationship filters, cannabis compatibility preferences, distance settings, and other discovery filters are PRIVATE_SELF unless a later field explicitly allows narrower intentional disclosure.

### PB-VIS-014 — Cannabis use/preferences are private by default

PB-0.14 cannabis fields are PRIVATE_SELF by default and may become DISCOVERABLE only field-by-field through explicit later product policy/user choice.

They must not become PUBLIC_EXPLICIT merely because a user allows them in discovery.

### PB-VIS-015 — Precise location is NEVER_PUBLIC

Exact coordinates, exact home/work address, raw GPS history, precise movement history, and equivalent location data are NEVER_PUBLIC.

### PB-VIS-016 — Coarse location may be DISCOVERABLE

Approved coarse area or approximate distance presentation may be DISCOVERABLE when designed to resist practical location triangulation.

### PB-VIS-017 — Likes and passes are private intent

Like/pass state is PRIVATE_SELF except that a later canonical recipient-facing like feature may intentionally disclose a specific like to its intended recipient.

The global like/pass graph remains NEVER_PUBLIC.

### PB-VIS-018 — Match state is PARTICIPANT_ONLY

The existence and status of a match are visible only to the authorized participants and narrowly required services.

The match graph is NEVER_PUBLIC.

### PB-VIS-019 — Blocks are PRIVATE_SELF / MODERATOR_ONLY

Block state is visible to the blocker and to narrowly authorized safety/services where needed.

The blocked person must not receive private block metadata beyond the minimum behavior necessary to enforce the deny state.

### PB-VIS-020 — Reports and moderation evidence are MODERATOR_ONLY

Reporter identity, report content, evidence, internal risk signals, notes, case history, and appeal evidence are MODERATOR_ONLY and NEVER_PUBLIC.

### PB-VIS-021 — Messages are PARTICIPANT_ONLY

Private message content, attachments, reactions, and relationship conversation data are PARTICIPANT_ONLY subject to narrowly authorized moderation/safety access under PB-0.10.

### PB-VIS-022 — Eligibility source evidence is NEVER_PUBLIC

Date of birth, identity-document images, government identifiers, raw identity evidence, or equivalent source evidence are NEVER_PUBLIC.

### PB-VIS-023 — Eligibility conclusion is SERVICE_MINIMUM

A minimum conclusion such as current PuffBuddies eligibility may be consumed by authorized PuffBuddies services without exposing source evidence.

### PB-VIS-024 — Wallet/account linkage is NEVER_PUBLIC by default

The link between a PuffBuddies profile and wallet/account identity is NEVER_PUBLIC unless a later explicitly public field is separately approved and intentionally linked by the user.

### PB-VIS-025 — Payment details are not profile visibility

Transaction history, payment volume, wallet balance, settlement evidence, and premium accounting data are not DISCOVERABLE/MATCHED profile fields.

Only the minimum self-facing entitlement state may be shown where needed.

### PB-VIS-026 — Lifecycle state is private

DEACTIVATED, RESTRICTED, SUSPENDED, BANNED, DELETE_REQUESTED, DELETION_IN_PROGRESS, DELETION_COMPLETE, and related lifecycle state are PRIVATE_SELF/MODERATOR_ONLY/SERVICE_MINIMUM as needed and NEVER_PUBLIC by default.

### PB-VIS-027 — Safety status is not a public badge

Report counts, block counts, moderation outcomes, internal risk state, abuse heuristics, and safety case history must not become PUBLIC_EXPLICIT, DISCOVERABLE reputation, or public trust badges.

### PB-VIS-028 — Internal ranking scores are NEVER_PUBLIC

Recommendation scores, compatibility scores, hidden features, model outputs, and other internal ranking artifacts are NEVER_PUBLIC and must not become user-facing social-credit scores.

### PB-VIS-029 — Session/security data is NEVER_PUBLIC

Session tokens, refresh tokens, device identifiers, fraud signals, authentication material, security logs, and recovery state are NEVER_PUBLIC.

### PB-VIS-030 — Audit evidence is protected

Protected audit records are MODERATOR_ONLY/SERVICE_MINIMUM according to purpose and must not reveal private relationship state publicly.

## Visibility interaction invariants

### PB-VIS-031 — Block revokes discovery/matched visibility

A current block must prevent ordinary DISCOVERABLE and MATCHED presentation between the affected users regardless of stale caches, payment, ranking, or prior relationship state.

### PB-VIS-032 — Lifecycle revocation removes ordinary visibility

DEACTIVATED, SUSPENDED, BANNED, deletion states, and scoped RESTRICTED states remove ordinary discovery/matched visibility according to PB-0.12.

### PB-VIS-033 — Unmatch revokes MATCHED-only fields

After canonical unmatch, fields whose only authority was MATCHED must no longer be disclosed to the former match unless another explicit independent authorization exists.

### PB-VIS-034 — Deletion removes active visibility

DELETE_REQUESTED and later deletion states must remove active profile/discovery/matched visibility even before asynchronous storage cleanup is complete.

### PB-VIS-035 — Visibility changes invalidate stale copies

Caches, clients, queues, search indexes, discovery results, notifications, analytics materializations, and derived views must not preserve broader visibility after a canonical visibility or lifecycle change.

### PB-VIS-036 — Client hiding is not authorization

A client receiving a field and visually hiding it does not satisfy a stricter audience restriction.

Backend/service authorization must prevent unauthorized field disclosure.

### PB-VIS-037 — Notification surfaces receive minimum presentation data

Lock-screen, email, push, browser, and shared-device notifications must receive only the minimum field set appropriate to the configured notification surface.

### PB-VIS-038 — Search/Explorer cannot turn DISCOVERABLE into public

420Search, 420Explorer, public wallet lookup, and unauthenticated APIs must not ingest or expose private PuffBuddies DISCOVERABLE/MATCHED data merely because it is visible inside the app.

### PB-VIS-039 — Economic state cannot buy visibility into another user

Payment, premium status, token holdings, staking, sponsorship, boosts, or promotions cannot unlock PRIVATE_SELF, MATCHED, PARTICIPANT_ONLY, MODERATOR_ONLY, or NEVER_PUBLIC fields belonging to another user.

### PB-VIS-040 — Visibility changes must be auditable without publishing them

Later implementation must record enough protected evidence to diagnose field-visibility decisions and changes while avoiding a public visibility-history or relationship graph.

## Field-classification decision rule

Before later implementation exposes a PuffBuddies field, it must document:

1. canonical field name;
2. canonical owner;
3. default audience;
4. allowed audience transitions;
5. who may change visibility;
6. discovery/match/participant implications;
7. block/safety/lifecycle/deletion overrides;
8. service-minimum disclosure needs;
9. public-enumeration risk;
10. inference/correlation risk;
11. retention/deletion behavior;
12. stale-cache invalidation behavior;
13. audit requirements.

If an audience is not explicitly authorized, the narrower audience is canonical.

## PB-0.15 completion boundary

PB-0.15 is satisfied when the repository:

- records PB-VIS-001 through PB-VIS-040 exactly once and in sequence;
- defines PRIVATE_SELF, DISCOVERABLE, MATCHED, PARTICIPANT_ONLY, MODERATOR_ONLY, SERVICE_MINIMUM, AGGREGATE_ONLY, PUBLIC_EXPLICIT, and NEVER_PUBLIC audiences;
- distinguishes in-app DISCOVERABLE from public internet/public protocol visibility;
- defines canonical audiences for profile fields, preferences, cannabis data, location, likes/passes, matches, blocks, reports, messages, identity evidence, eligibility conclusions, wallet linkage, payments, lifecycle/safety state, ranking state, sessions/security data, and audit evidence;
- requires block/lifecycle/unmatch/deletion changes to revoke broader audiences;
- requires caches/clients/notifications/search/analytics/derived services to preserve source visibility boundaries;
- prohibits economic purchase of another user's protected field visibility;
- preserves PB-0.1 through PB-0.14;
- introduces no profile schema, ACL engine, API, database, client implementation, contract, address, service ID, deployment, or false live-visibility claim.
