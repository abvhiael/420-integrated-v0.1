# PuffBuddies PB-0.19 master implementation roadmap

## Purpose

PB-0.19 translates the complete PB-0 architecture into the canonical implementation order from PB-1 through launch. It is a planning and qualification authority document only: future phases remain unimplemented until their own repository work and exact-SHA qualification exist.

PB-0.20 must formally close PB-0 before PB-1 implementation begins.

## Canonical roadmap invariants

### PB-ROADMAP-001 — PB-0 remains architectural authority
Every later phase must preserve applicable PB-0 invariants unless a deliberate canonical architecture revision is reviewed, documented, migrated, and requalified.

### PB-ROADMAP-002 — Adult-only eligibility is release-gating
No phase may expose ordinary PuffBuddies participation without current adult eligibility satisfying PB-0.6 and PB-0.12.

### PB-ROADMAP-003 — Product modes remain canonical
Dating, Buddy, and Both remain first-class modes unless canonically revised.

### PB-ROADMAP-004 — Cannabis compatibility remains optional
Cannabis compatibility remains first-class while cannabis consumption remains unnecessary for eligibility.

### PB-ROADMAP-005 — Sensitive state stays private by default
Dating, preference, relationship, precise-location, cannabis, safety, moderation, lifecycle, and communication state stays private/off-chain except for explicitly justified minimum-disclosure authority.

### PB-ROADMAP-006 — Membership and relationship graphs are not public
Wallet ownership, Identity, Names, Registry, chain state, Search, Explorer, Indexer, Analytics, or public APIs must not make PuffBuddies membership or relationship graphs publicly enumerable.

### PB-ROADMAP-007 — Consent cannot be purchased or manufactured
Payment, premium status, administration, algorithms, AI, moderation, dependency state, or tokens cannot create another user's interpersonal consent.

### PB-ROADMAP-008 — Mutual authorized intent gates ordinary private messaging
One-sided interest is insufficient; ordinary private dating/social messaging requires the current canonical mutual authorization required by PB-0.5/PB-0.13.

### PB-ROADMAP-009 — Block and revocation remain supreme
Block, unmatch, eligibility loss, lifecycle restriction, deletion, and applicable safety revocation must invalidate stale downstream authorization and fail closed.

### PB-ROADMAP-010 — PuffBuddies retains application authority
PuffBuddies remains canonical owner for its relationship, lifecycle, and safety state; dependencies retain only their bounded native authority.

### PB-ROADMAP-011 — Derived systems remain derived
Search, Explorer, Indexer, Analytics, Notifications, caches, projections, recommendations, and similar consumers cannot become canonical relationship/consent/lifecycle/safety authority.

### PB-ROADMAP-012 — Deletion propagates
Caches, indexes, workers, queues, analytics, recommendations, notifications, backups/restores, and dependency projections must honor current deletion and revocation semantics.

### PB-ROADMAP-013 — Visibility is server-authorized
DISCOVERABLE, MATCHED, moderator, self, service-minimum, aggregate, public-explicit, and never-public audiences must be enforced by authoritative boundaries; client hiding alone is insufficient.

### PB-ROADMAP-014 — Matching exclusions precede ranking
Eligibility, block, lifecycle, safety, visibility, preference, and other hard exclusions must be applied before ranking/recommendation influence.

### PB-ROADMAP-015 — Cannabis data is not identity or proof
Cannabis state cannot become public/tokenized identity, medical/legal authority, impairment evidence, marketplace entitlement, or a coercive participation requirement.

### PB-ROADMAP-016 — Safety is baseline
Block, report, unmatch, deactivation/deletion, and other canonical baseline safety/account-exit capabilities cannot require premium payment.

### PB-ROADMAP-017 — Deferred does not mean prohibited
PB-0.2/PB-0.16 post-MVP deferrals may be considered only through later canonical roadmap work; categorical non-goals remain prohibited unless architecture is explicitly revised.

### PB-ROADMAP-018 — Reserved paths do not imply implementation
PB-0.17 repository locations become real implementation surfaces only when a later phase creates and qualifies them.

### PB-ROADMAP-019 — Dependency adapters fail closed
Wallet, Identity, Names, Messenger, Notifications, Pay, Registry/AppStore, Analytics, Search/Indexer/Explorer, and future adapters must reject stale, missing, revoked, contradictory, or over-broad authority.

### PB-ROADMAP-020 — Migrations preserve authority
Schema migrations, backfills, restores, cache rebuilds, reindexing, and replay must preserve privacy, consent, visibility, lifecycle, safety, and deletion semantics.

### PB-ROADMAP-021 — Exact-SHA qualification is required
Implementation-bearing phases must record exact implementation SHA evidence; substantive later changes invalidate earlier qualification at the applicable level.

### PB-ROADMAP-022 — Milestones are app-focused
Level 2 is used at meaningful accumulated PuffBuddies integration boundaries, not as ceremonial repository-wide qualification after every phase.

### PB-ROADMAP-023 — Launch requires operational controls
Launch readiness includes privacy/safety/deletion operations, incident response, rollback/recovery, observability without sensitive leakage, dependency health, migration/restore proof, and release evidence.

### PB-ROADMAP-024 — Roadmap changes require reconciliation
A roadmap change must identify affected PB-0 invariants, authority changes, privacy/consent/lifecycle/deletion/security consequences, migration compatibility, test impact, and qualification impact.

## Current phase-number authority
### Current PB-15 qualification scope

Current **PB-15 — Qualification** promotes the app-specific release-candidate qualification portion of the legacy PB-0.19 release-candidate boundary. It freezes and qualifies accumulated PB-1 through PB-14 behavior through one exact-head retained PuffBuddies suite, web/mobile release builds, dependency compatibility verification, security/adversarial/static gates and durable evidence reconciliation. This is **Level 2 milestone E**, not the comprehensive repository-wide Level-3 closeout. Under the current phase-based audit policy, final reconciliation with then-current `main`, canonical full Solidity/Genesis/global/Docs/Geth/deployment qualification and monolithic merge-candidate evidence remain later Level-3 work after the required pre-closeout roadmap phases.

### Current PB-14 backend/API-hardening scope

Current **PB-14 — Backend/API hardening** materializes the reserved `puffbuddies/api/` transport boundary required by PB-0.17 and already consumed contractually by PB-11/PB-12. PB-14 owns authenticated HTTP/edge hardening, strict route/body/session/origin/replay/rate-limit/audit/error controls and stale-authority rejection, while canonical relationship, consent, eligibility-decision, lifecycle, visibility, deletion, safety and premium/private-access decisions remain owned by the existing PuffBuddies domain/application layer. PB-14 is repository-qualified transport implementation only; live endpoint deployment remains PB-17+ work.

### Current PB-12 mobile-applications scope

Current **PB-12 — Mobile applications** explicitly promotes the iOS and Android clients that PB-0.2 deferred behind the web-first MVP. PB-12 preserves the PB-11 client/domain authority model while adding only bounded native device capabilities: device-bound session storage, lifecycle resume/revalidation, media handoff, OS notification-registration handoff and verified app/universal links. Device/store signing, live push credentials, live API binding and distribution remain later external/release gates.


### Current PB-10 payments/premium scope

Current **PB-10 — Payments and premium entitlements** promotes the premium/monetization work explicitly deferred by PB-0.2 while preserving PB-0.5/PB-0.7/PB-0.8/PB-0.9/PB-0.12/PB-0.16: canonical settlement remains 420Pay-owned, PuffBuddies owns only product feature entitlement, and no economic state can create or restore consent, bypass block/safety/lifecycle, buy protected private-person data, or become dating desirability/reputation. PB-10 implements the entitlement policy boundary; PB-11 later owns web-client mechanics.


### Current PB-9 verification/reputation scope

Current **PB-9 — Verification and reputation** promotes the advanced verification/reputation work explicitly deferred by PB-0.2, but remains constrained by PB-0.8/PB-0.9/PB-0.10/PB-0.13: bounded verification indicators may be presented narrowly; 420Verify is not interpersonal identity/reputation authority; safety/report history and economic state cannot become public reputation; and no universal desirability/trust/social-credit score is permitted. Cross-app reputation aggregation and portable external dating credentials remain deferred until a canonical issuer/verification authority exists.



The implementation-phase numbering below is the original PB-0.19 planning map and is retained as historical scope guidance. The current numbered phase authority is `docs/puffbuddies/PUFFBUDDIES-ROADMAP.md` under **Post-PB-0 phase names** and any detailed step committed there. Where numbering conflicts, the current roadmap controls. In particular, current **PB-3 — Profiles** carries forward the profile/editing/media/mode/visibility/lifecycle-control portion of the legacy PB-2 planning scope; legacy PB-3 discovery/matching scope is split across current **PB-4 — Discovery** and **PB-5 — Likes and matching**; PB-4 carries only discovery/recommendation behavior and PB-5 owns likes, passes, reciprocal consent and match formation. This reconciliation changes numbering authority only and does not weaken any PB-0 invariant or silently claim implementation.

## Canonical implementation phases

### PB-1 — Domain model and private persistence
Implement canonical domain types, state machines, private persistence schemas, repositories, migrations, and authorization primitives for profile, eligibility projection, preferences, visibility, lifecycle, relationship, safety, matching inputs, and cannabis taxonomy.

**PB-0 authorities:** PB-0.3 through PB-0.15, PB-0.17.
**Required gates:** schema/migration tests; state-machine tests; authorization negatives; deletion/revocation tests; privacy/static checks; no public leakage.
**Level 2:** not automatically required until the PB-1 accumulated domain/persistence boundary is complete.

### PB-2 — Eligibility, account, profile, and visibility
Implement adult-eligibility consumption, registration/activation, profile editing/media metadata, Dating/Buddy/Both mode, field-level visibility, pause/deactivate/delete initiation, and current-authority session controls.

**PB-0 authorities:** PB-0.1, PB-0.2, PB-0.4, PB-0.6, PB-0.11, PB-0.12, PB-0.15.
**Required gates:** eligibility fail-closed tests; profile/visibility authorization; lifecycle transitions; deletion initiation; wallet/profile unlinkability.
**Level 2 milestone A:** accumulated PB-1/PB-2 account/profile/private-state integration.

### PB-3 — Discovery and matching
Implement candidate eligibility filtering, hard exclusions, coarse-location privacy controls, preferences, cannabis compatibility, like/pass state, ranking as non-canonical derived output, reciprocal matching, stale-match invalidation, and recommendation boundaries.

**PB-0 authorities:** PB-0.4, PB-0.5, PB-0.7, PB-0.13, PB-0.14, PB-0.15.
**Required gates:** exclusion-before-ranking tests; stale-cache/replay tests; reciprocal-intent tests; location inference/adversarial tests; sensitive-inference review.

### Current split for legacy messaging/notifications scope

The legacy PB-0.19 **PB-4 — Messaging authorization and notifications** planning block predates the current phase reservation. Its scope is now split by the current canonical roadmap: **PB-6 — 420Messenger integration** owns Messenger authorization/coordination handoff, while **PB-7 — 420Notifications integration** owns notification delivery handoff. This is a numbering/scope reconciliation only; it does not transfer PuffBuddies consent/relationship authority to Messenger or Notifications and does not claim live integration before the corresponding current phase is qualified.

### PB-4 — Messaging authorization and notifications
Integrate bounded 420Messenger/420Notifications capabilities after canonical PuffBuddies match authorization. Enforce current mutual authorization on conversation entry and delivery-trigger decisions.

**PB-0 authorities:** PB-0.5, PB-0.8, PB-0.9, PB-0.13.
**Required gates:** matched/unmatched authorization; unmatch/block/revocation races; stale Messenger capability rejection; notification privacy; dependency failure behavior.
**Level 2 milestone B:** accumulated discovery/match/messaging/notification integration.

### Current mapping for legacy safety scope

The legacy PB-0.19 **PB-5 — Safety, moderation, block, report, and appeals** planning block predates the current phase reservation. Its implementation scope is carried forward by current **PB-8 — Safety and moderation**. This is a numbering/scope reconciliation only: PB-8 must preserve every PB-0.10/PB-0.11/PB-0.12 safety, privacy, retention, appeal and lifecycle invariant and does not claim live moderation infrastructure.

### PB-5 — Safety, moderation, block, report, and appeals
Implement private safety cases, report evidence boundaries, block/unmatch behavior, moderation actions, restriction/suspension/ban handling, appeal workflow, least-privilege moderation access, and auditability without public reputation.

**PB-0 authorities:** PB-0.5, PB-0.7, PB-0.9, PB-0.10, PB-0.12, PB-0.15, PB-0.16.
**Required gates:** abuse/adversarial tests; moderator authorization; block supremacy; appeal non-consent; privacy/audit tests; report-count-not-guilt behavior.

### PB-6 — Deletion, retention, derived-state invalidation, and recovery
Implement deletion workers, retention policy, cache/index/recommendation invalidation, dependency cleanup requests, backup expiry/restore suppression, tombstone/minimum-retention semantics, and honest deletion completion state.

**PB-0 authorities:** PB-0.4, PB-0.9, PB-0.11, PB-0.12, PB-0.15.
**Required gates:** deletion propagation; restore/backfill/reindex adversarial tests; stale-state resurrection rejection; dependency-boundary tests; retention-purpose tests.
**Level 2 milestone C:** accumulated lifecycle/safety/deletion integration.

### Current PB-11 web-application mapping

The legacy PB-0.19 **PB-7 — Web MVP and baseline user experience** scope is implemented by current **PB-11 — Web application**. Current PB-11 carries the complete web-first MVP client requirement, while current PB-14 remains the later backend/API-hardening owner and PB-17+ remain live-environment/release owners. This mapping changes numbering only and does not promote the legacy PB-11 launch-readiness meaning into current PB-11.

### PB-7 — Web MVP and baseline user experience
Implement the web-first MVP across eligibility, account/profile, discovery, matching, matched messaging entry, notifications, safety controls, lifecycle controls, and deletion status. Baseline safety/account-exit capabilities remain non-premium.

**PB-0 authorities:** all PB-0 product, privacy, consent, safety, lifecycle, matching, cannabis, visibility, and non-goal authorities.
**Required gates:** build/lint/type; UI authorization boundaries; accessibility; end-to-end happy/negative paths; sensitive logging review; client cache revocation.

### Current PB-13 cross-app integration mapping

The legacy PB-0.19 **PB-8 — Bounded ecosystem integration hardening** scope is implemented by current **PB-13 — 420Integrated cross-app integration**. Current PB-13 retains the original dependency-contract/interface, stale/revoked capability, failure-injection, metadata/privacy and authority-conflict gates plus the documented **Level 2 milestone D** complete retained PuffBuddies integration suite. This is a numbering/scope reconciliation only and does not promote legacy testnet/release work into PB-13.

### PB-8 — Bounded ecosystem integration hardening
Harden Wallet, Identity, Names, Messenger, Notifications, Pay where later approved, Registry/AppStore presentation, and derived Analytics/Search/Indexer/Explorer boundaries without transferring PuffBuddies authority.

**PB-0 authorities:** PB-0.3, PB-0.7, PB-0.8, PB-0.9, PB-0.16.
**Required gates:** dependency contract/interface tests; stale/revoked capability tests; failure injection; metadata/privacy review; authority-conflict tests.
**Level 2 milestone D:** complete retained PuffBuddies integration suite.

### PB-9 — Testnet and operational readiness
Deploy only canonically approved components to the production-equivalent testnet environment; validate secrets/config, migrations, dependency endpoints, observability, abuse controls, deletion operations, incident/rollback procedures, restore behavior, and privacy-safe telemetry.

**External/testnet prerequisites:** live approved testnet dependencies, canonical deployment/config authority, required credentials/secrets, and operator access.
**Required gates:** deployment/config verification; smoke/integration; fault/recovery; deletion/restore drills; security/static analysis; privacy/telemetry review; runbooks/evidence.

### PB-10 — Release candidate
Freeze the release candidate, reconcile current main, migrations, dependency versions, docs, user-facing policy/controls, operational runbooks, and all retained PuffBuddies qualification against one exact implementation SHA.

**Required gates:** release build; retained app suites; migration rehearsal; dependency compatibility; security/adversarial/static; docs/evidence reconciliation; unresolved-risk review.
**Level 2 milestone E:** final app-specific release-candidate integration before comprehensive release closeout.

### PB-11 — Launch readiness and launch
Complete the applicable comprehensive release/phase closeout, deployment approval, production configuration, rollback/recovery readiness, monitoring/alerting, privacy/safety/deletion operations, incident response, and post-launch validation.

**Level 3 boundary:** reconcile with current main and use canonical repository-wide workflow ownership without duplicating expensive inventories. Solidity Contracts owns the full repository Foundry inventory; Genesis Address Authority owns address/namespace/predeploy/frozen-address/manifest authority; global/Docs and affected service/client suites run only for their distinct coverage purpose and all shared evidence must bind to the same merge-candidate SHA.

Launch does not waive live/testnet/external blockers. Any unresolved dependency, deployment, credential, operational, privacy, safety, or deletion blocker remains explicit.

## Cross-phase release gates

Every implementation-bearing phase must document: implementation scope; affected PB-0 invariants; authority owners; migrations; privacy/consent/lifecycle/deletion consequences; tests and adversarial cases; dependency changes; exact implementation SHA; CI evidence; deferred external requirements; limitations/blockers; and next canonical phase.

## Change control

Future roadmap edits may add detail beneath these phases but must not silently renumber away canonical phases or weaken PB-0. Any change affecting authority, public/private classification, consent, eligibility, lifecycle, deletion, safety, matching, cannabis semantics, visibility, dependency ownership, or non-goals requires explicit architecture reconciliation and qualification impact analysis.

## PB-0.19 completion boundary

PB-0.19 is complete when PB-1 through launch are ordered, mapped to PB-0, supplied with qualification/release gates and milestone boundaries, future external/testnet dependencies are explicit, PB-0.20 remains the required PB-0 closeout gate, and machine verification prevents silent roadmap drift.
