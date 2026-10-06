# PuffBuddies roadmap

## Qualification model

PuffBuddies uses the repository's phase-based qualification model:

- **Level 1:** targeted qualification for ordinary roadmap steps;
- **Level 2:** retained app-specific integration qualification at meaningful milestones;
- **Level 3:** one comprehensive exact-SHA app-phase closeout after reconciliation with current `main`.

Broad repository inventories are not required after every ordinary PuffBuddies step unless the step materially changes shared repository authority.

## PB-0 — Canonical foundation

### PB-0.1 — Canonical app identity — COMPLETE

**Purpose:** establish one authoritative product identity before implementation work begins.

**Canonical requirements:**

1. Define the canonical name as **PuffBuddies**.
2. Classify PuffBuddies as a 420Integrated **adult dating and social-discovery application**.
3. Define the primary intent modes as **Dating**, **Buddy**, and **Both**.
4. Define cannabis compatibility as a first-class product dimension without requiring cannabis consumption.
5. State that ordinary users should not need to understand blockchain internals.
6. State that wallet ownership or a wallet address alone must not publicly reveal PuffBuddies profile membership.
7. Define the initial high-level user journey without falsely claiming later features are implemented.
8. Fix initial non-goals that prohibit public relationship/cannabis/preference registries, tokenized consent, pay-to-message-strangers semantics, wagering, and dating social-credit scoring.
9. Explicitly state that PB-0.1 creates documentation authority only and does not create contracts, Genesis addresses, service IDs, deployments, clients, live integrations, or testnet readiness.
10. Record stable PB-ID invariants that later roadmap work must preserve unless a future canonical change explicitly revises them.

**Affected repository components:**

- `docs/puffbuddies/PUFFBUDDIES.md`
- `docs/puffbuddies/PUFFBUDDIES-ROADMAP.md`
- `scripts/verify-puffbuddies-pb0.py`
- `.github/workflows/puffbuddies-pb0.yml`
- durable PB-0.1 qualification evidence

**Qualification level:** Level 1.

**Milestone relationship:** PB-0.1 is the first PB-0 step and is not itself a Level 2 integration milestone.

**Dependencies:** none beyond current repository documentation/CI conventions. PB-0.1 must not fabricate dependency implementations.

**Exit criteria:**

- one canonical PuffBuddies identity document exists;
- every PB-0.1 canonical requirement above is represented;
- PB-ID-001 through PB-ID-008 exist and are unique;
- the document contains no claim of implemented/live PuffBuddies contracts, addresses, services, deployments, or integrations;
- the app-scoped verifier passes;
- the exact-head PuffBuddies PB-0 workflow passes for the implementation SHA;
- durable qualification evidence records the tested implementation SHA and current base SHA.

### PB-0.2 — MVP scope — COMPLETE

**Purpose:** define and freeze the canonical first-release capability boundary and explicit post-MVP deferrals without prematurely defining later implementation mechanics.

**Canonical requirements:**

1. Define one complete MVP user journey from eligibility through profile, discovery, like/pass, mutual match, private communication, safety controls, and account exit.
2. Require PB-MVP-001 through PB-MVP-015.
3. Require PB-SCOPE-001 through PB-SCOPE-008.
4. Make blocking, reporting, unmatching, deactivation, deletion, eligibility enforcement, and core matched-user messaging part of the MVP rather than premium/post-launch cleanup.
5. Define the first complete MVP client surface as the web application.
6. Explicitly defer native mobile, rich synchronous media, group/event experiences, AI/advanced matchmaking, premium monetization, advanced verification/reputation, and social/community expansion unless later promoted by canonical roadmap change.
7. Distinguish deferred features from behavior incompatible with the canonical product identity, including purchased consent, block bypass, unmatched unsolicited messaging, public wallet/profile enumeration, public relationship/preference/cannabis registries, wallet-wealth desirability ranking, and administrator-manufactured consent.
8. Preserve PB-0.1 invariants and make clear that scope inclusion does not assert implementation, deployment, integration, or release readiness.
9. Leave detailed privacy, authority, lifecycle, storage, matching, safety, integration, API, deployment, and qualification mechanics to their later canonical roadmap owners.

**Affected repository components:**

- `docs/puffbuddies/PB-0.2-MVP-SCOPE.md`
- `docs/puffbuddies/PUFFBUDDIES-ROADMAP.md`
- `scripts/verify-puffbuddies-pb0.py`
- `docs/puffbuddies/PB-0.2-QUALIFICATION.md`

**Qualification level:** Level 1.

**Milestone relationship:** PB-0.2 is not a Level 2 integration milestone; it introduces no shared authority or runtime component.

**Dependencies:** PB-0.1 must remain COMPLETE and its PB-ID invariants must remain intact.

**Exit criteria:**

- one canonical PB-0.2 MVP scope document exists;
- PB-MVP-001 through PB-MVP-015 exist exactly once and in sequence;
- PB-SCOPE-001 through PB-SCOPE-008 exist exactly once and in sequence;
- the complete core user journey is represented;
- MVP, post-MVP deferrals, and incompatible/excluded behaviors are clearly separated;
- launch-critical safety/account-exit features remain in MVP;
- web-first MVP and post-MVP native clients are explicit;
- no PuffBuddies contract, service ID, fixed address, deployment, client implementation, or live integration is falsely claimed;
- the app-scoped verifier passes;
- the exact-head PuffBuddies PB-0 workflow passes for the implementation SHA;
- durable PB-0.2 evidence records exact run/job evidence and base SHA.

### PB-0.3 — Blockchain/off-chain boundary — COMPLETE

**Purpose:** define which PuffBuddies state may use public-chain authority and which state must remain private/off-chain, encrypted, or represented only through minimum-disclosure attestations/commitments.

**Canonical requirements:**

1. Define four canonical zones: public-chain authority, private application state, encrypted communication state, and minimum-disclosure attestations/commitments.
2. Record PB-BOUNDARY-001 through PB-BOUNDARY-018.
3. Explicitly keep profile content/media, dating and lifestyle preferences, likes, passes, matches, unmatches, blocks, reports/moderation evidence, precise location, private messages, and relationship graph state off public chain.
4. Permit only narrowly-scoped public protocol/config/registration/payment/entitlement/eligibility/verification conclusions where later architecture demonstrates a concrete need and minimum disclosure.
5. Preserve wallet-to-profile unlinkability: public wallet or 420Name knowledge must not create a canonical public mechanism to enumerate PuffBuddies membership.
6. Prohibit side-channel leakage through contract events/logs, calldata, deterministic hashes, metadata, payment payloads, Indexer, Explorer, Search, and analytics.
7. State that hashing sensitive state does not automatically make public-chain persistence privacy-safe.
8. State that off-chain classification does not weaken security: private state still requires authentication, authorization, encryption, integrity protection, auditability, and later threat-model controls.
9. Do not assign contracts, service IDs, fixed addresses, deployment topology, storage implementation, or false live integrations in PB-0.3.

**Affected repository components:**

- `docs/puffbuddies/PB-0.3-BLOCKCHAIN-OFFCHAIN-BOUNDARY.md`
- `docs/puffbuddies/PUFFBUDDIES-ROADMAP.md`
- `scripts/verify-puffbuddies-pb0.py`
- `docs/puffbuddies/PB-0.3-QUALIFICATION.md`

**Qualification level:** Level 1.

**Milestone relationship:** PB-0.3 is not a Level 2 integration milestone; it defines authority/data-placement rules without introducing executable shared integration.

**Dependencies:** PB-0.1 and PB-0.2 must remain COMPLETE and their canonical identity/scope invariants must remain intact.

**Exit criteria:**

- one canonical PB-0.3 boundary document exists;
- PB-BOUNDARY-001 through PB-BOUNDARY-018 exist exactly once and in sequence;
- public/private/encrypted/attestation zones are explicit;
- all sensitive MVP state classes are explicitly classified off public chain;
- allowed public categories are minimum-disclosure and purpose-limited;
- public side-channel leakage is prohibited;
- wallet/profile unlinkability remains explicit;
- no PuffBuddies contract, service ID, fixed address, deployment, storage implementation, or live integration is falsely claimed;
- the cumulative app-scoped verifier passes;
- the exact-head PuffBuddies PB-0 workflow passes for the implementation SHA;
- durable PB-0.3 evidence records exact run/job evidence and base SHA.

### PB-0.4 — Privacy invariants — COMPLETE

**Purpose:** define stable privacy guarantees that every later PuffBuddies implementation, integration, client, service, storage layer, moderation tool, analytics path, and release must preserve.

**Canonical requirements:**

1. Record PB-PRIV-001 through PB-PRIV-020.
2. Cover minimum disclosure and purpose limitation.
3. Keep eligibility source evidence, precise location, likes/passes, matches, messages, discovery/preferences, wallet/profile linkage, safety actions, and protected moderation state private.
4. Preserve PuffBuddies deletion/deactivation independence from unrelated 420Wallet/420Identity/420Names state.
5. Protect metadata, logs, analytics, notifications, identifiers, hashes/commitments, backups, caches, indexes, derived data, and retention paths from recreating private relationship state.
6. Prohibit public wallet-to-profile enumeration and unauthenticated public member enumeration.
7. Require least-privilege access for services, moderators, operators, support, and administrators.
8. Address inference/correlation attacks, including location triangulation, timing correlation, predictable identifiers, response differences, and stale derived copies.
9. Define a minimum-disclosure decision rule for later data sharing/persistence.
10. Preserve PB-0.1 through PB-0.3 and do not claim runtime integrations or implementations that do not exist.

**Affected repository components:**

- `docs/puffbuddies/PB-0.4-PRIVACY-INVARIANTS.md`
- `docs/puffbuddies/PUFFBUDDIES-ROADMAP.md`
- `scripts/verify-puffbuddies-pb0.py`
- `docs/puffbuddies/PB-0.4-QUALIFICATION.md`

**Qualification level:** Level 1.

**Milestone relationship:** PB-0.4 is not a Level 2 integration milestone; it adds canonical privacy requirements without introducing executable shared integration.

**Dependencies:** PB-0.1, PB-0.2, and PB-0.3 must remain COMPLETE and their identity, MVP-scope, and blockchain/off-chain boundary invariants must remain intact.

**Exit criteria:**

- one canonical PB-0.4 privacy-invariants document exists;
- PB-PRIV-001 through PB-PRIV-020 exist exactly once and in sequence;
- eligibility, location, likes/passes, matches, messages, preferences, wallet correlation, deletion independence, and minimum disclosure are explicitly covered;
- metadata, identifiers, hashes, notifications, analytics, enumeration, least privilege, backups/derived data, and retention are explicitly covered;
- inference/correlation threats are documented;
- privacy expectations are defined across major PuffBuddies/420Integrated surfaces without false integration claims;
- no contract, fixed address, service ID, storage implementation, deployment, or live integration is falsely claimed;
- the cumulative app-scoped verifier passes;
- the exact-head PuffBuddies PB-0 workflow passes for the implementation SHA;
- durable PB-0.4 evidence records exact run/job evidence and base SHA.

### PB-0.5 — Consent invariants — COMPLETE

**Purpose:** define stable consent/authorization guarantees for mutual matching, messaging access, unmatch, block supremacy, revocation, premium/payment boundaries, administrative authority, and stale-authorization failure behavior.

**Canonical requirements:**

1. Record PB-CONSENT-001 through PB-CONSENT-020.
2. Require a currently valid mutual match or explicitly equivalent reciprocal-consent mechanism before ordinary private messaging.
3. Make clear that likes, profile views, inactivity, payments, subscriptions, boosts, tokens, badges, reputation, or administrative actions are not themselves messaging consent.
4. Make unmatch unilateral and immediately revoking for match-dependent authorization.
5. Make block supremacy explicit over prior likes, matches, conversations, cached authorization, invitations, premium/payment state, boosts, recommendation state, and prior ordinary interaction consent.
6. Prohibit purchased access, tokenized consent, paid block bypass, paid unmatched messaging, paid private-data access, and payment-based match creation.
7. Prohibit administrators, moderators, operators, governance actors, smart contracts, automation, and recommendation systems from manufacturing mutual interpersonal consent.
8. Define consent as revocable, action-scoped, and current-state authoritative; stale authorization must fail closed.
9. Ensure deactivation/deletion/suspension/ineligibility can revoke active ordinary interaction authorization under later lifecycle rules.
10. Define canonical failure-path classes for later tests, including stale caches, queued delivery after block, retries, premium state after block, forced-match attempts, and one-sided messaging attempts.

**Affected repository components:**

- `docs/puffbuddies/PB-0.5-CONSENT-INVARIANTS.md`
- `docs/puffbuddies/PUFFBUDDIES-ROADMAP.md`
- `scripts/verify-puffbuddies-pb0.py`
- `docs/puffbuddies/PB-0.5-QUALIFICATION.md`

**Qualification level:** Level 1.

**Milestone relationship:** PB-0.5 is not a Level 2 integration milestone; it adds canonical consent requirements without introducing executable shared integration.

**Dependencies:** PB-0.1 through PB-0.4 must remain COMPLETE and their identity, scope, data-boundary, and privacy invariants must remain intact.

**Exit criteria:**

- one canonical PB-0.5 consent-invariants document exists;
- PB-CONSENT-001 through PB-CONSENT-020 exist exactly once and in sequence;
- mutual/reciprocal authorization is required before ordinary private messaging;
- one-sided likes and public/product signals do not create messaging authority;
- unmatch is unilateral and revoking;
- block supremacy is explicit;
- payment/token/subscription/admin state cannot create or restore consent;
- consent is revocable, action-scoped, current-state authoritative, and stale authorization fails closed;
- canonical failure-path classes are documented;
- no matching engine, messaging runtime, payment runtime, contract, fixed address, service ID, deployment, or live integration is falsely claimed;
- the cumulative app-scoped verifier passes;
- the exact-head PuffBuddies PB-0 workflow passes for the implementation SHA;
- durable PB-0.5 evidence records exact run/job evidence and base SHA.

### PB-0.6 — Adult eligibility policy — COMPLETE

**Purpose:** define the canonical adult-eligibility floor, minimum-disclosure eligibility interface, policy conclusions, revocation/staleness/reverification rules, and dependency contract for later canonical identity/attestation integration.

**Canonical requirements:**

1. Establish 18+ as the PuffBuddies adult floor; jurisdiction-specific policy may tighten but never lower it.
2. Define ELIGIBLE, INELIGIBLE, and UNKNOWN, with UNKNOWN failing closed for ordinary participation.
3. Record PB-ELIG-001 through PB-ELIG-020.
4. Prefer an eligibility conclusion over raw DOB, legal identity, government ID, or precise residence.
5. Define expiry, revocation, staleness, reverification, issuer failure, and policy-version reevaluation semantics.
6. Make eligibility necessary but not sufficient: suspension, ban, deletion, deactivation, block, and consent rules remain authoritative.
7. Prohibit payment, token ownership, subscription, reputation, admin convenience, or self-assertion from substituting for authoritative proof where required.
8. Preserve wallet/profile unlinkability and minimum disclosure.
9. Require later canonical identity/attestation integration to define issuer/verifier, subject binding, policy binding, revocation, freshness, replay resistance, and failure behavior.
10. Define adversarial/failure classes for later implementation testing without claiming identity integration exists.

**Affected repository components:**

- `docs/puffbuddies/PB-0.6-ADULT-ELIGIBILITY-POLICY.md`
- `docs/puffbuddies/PUFFBUDDIES-ROADMAP.md`
- `scripts/verify-puffbuddies-pb0.py`
- `docs/puffbuddies/PB-0.6-QUALIFICATION.md`

**Qualification level:** Level 1.

**Milestone relationship:** PB-0.6 is not a Level 2 integration milestone; it defines a policy/interface contract without introducing executable shared integration.

**Dependencies:** PB-0.1 through PB-0.5 must remain COMPLETE.

**Exit criteria:**

- one canonical PB-0.6 policy document exists;
- 18+ floor is explicit and cannot be weakened by jurisdiction policy;
- ELIGIBLE/INELIGIBLE/UNKNOWN semantics exist with UNKNOWN fail-closed;
- PB-ELIG-001 through PB-ELIG-020 exist exactly once and in sequence;
- minimum-disclosure eligibility consumption is explicit;
- expiry/revocation/staleness/reverification/policy-version behavior is explicit;
- eligibility cannot override consent/safety/lifecycle restrictions;
- payment/token/admin/self-assertion bypass is prohibited;
- canonical identity/attestation dependency requirements and adversarial cases are documented;
- no identity contract, fixed address, service ID, provider integration, deployment, or live verification is falsely claimed;
- cumulative app-scoped verifier passes;
- exact-head PuffBuddies PB-0 workflow passes;
- durable PB-0.6 evidence records exact run/job evidence and current-main/base state.

### PB-0.7 — Threat/trust model — COMPLETE

**Purpose:** define canonical protected assets, actor classes, trust boundaries, abuse cases, authority-ownership rules, fail-closed assumptions, required security-control classes, and residual-risk acceptance criteria.

**Canonical requirements:**

1. Record PB-THREAT-001 through PB-THREAT-040.
2. Identify protected assets including identity/eligibility evidence, profiles/media, preferences, relationship state, precise location, messages, wallet unlinkability, moderation evidence, sessions/secrets, entitlement context, deletion intent, and safety audit trails.
3. Define ordinary/malicious/Sybil/compromised-user, operator, service, client, dependency, public-chain, network, breach, and bot adversary classes.
4. Define trust boundaries for client/server, 420Identity, 420Messenger, 420Notifications, 420Pay, public chain, Search/Indexer/Explorer, and privileged human access.
5. Cover canonical abuse cases including triangulation, graph reconstruction, wallet correlation, block/ban bypass, post-revocation delivery, eligibility bypass, scraping/enumeration, impersonation, moderation abuse, insider misuse, metadata leakage, deletion remanence, credential compromise, resource abuse, dependency compromise, and replay/stale state.
6. Require one canonical authority owner per critical decision class and prohibit conflict resolution that silently broadens access.
7. Require safety/consent/eligibility uncertainty to fail closed.
8. Require external services to be capability-limited and privileged access to be least-privilege/auditable.
9. Define later security-control expectations and residual-risk acceptance rules.
10. Preserve PB-0.1 through PB-0.6 without falsely claiming runtime security controls or integrations exist.

**Affected repository components:**

- `docs/puffbuddies/PB-0.7-THREAT-TRUST-MODEL.md`
- `docs/puffbuddies/PUFFBUDDIES-ROADMAP.md`
- `scripts/verify-puffbuddies-pb0.py`
- `docs/puffbuddies/PB-0.7-QUALIFICATION.md`

**Qualification level:** Level 1.

**Milestone relationship:** PB-0.7 is not a Level 2 integration milestone; it defines threat and trust requirements without introducing executable shared integration.

**Dependencies:** PB-0.1 through PB-0.6 must remain COMPLETE.

**Exit criteria:**

- one canonical PB-0.7 threat/trust document exists;
- PB-THREAT-001 through PB-THREAT-040 exist exactly once and in sequence;
- protected assets, actor classes, trust boundaries, abuse cases, authority-ownership, fail-closed behavior, security-control expectations, and residual-risk rules are explicit;
- no runtime security control, contract, fixed address, service ID, deployment, or live integration is falsely claimed;
- cumulative app-scoped verifier passes;
- exact-head PuffBuddies PB-0 workflow passes;
- durable PB-0.7 evidence records exact run/job evidence and current-main/base state.

### PB-0.8 — Ecosystem dependencies — COMPLETE

**Purpose:** define exact narrow authority/capability roles for approved 420Integrated dependencies without allowing any integration to inherit PuffBuddies profile, consent, relationship, safety, privacy, or lifecycle authority outside its canonical domain.

**Canonical requirements:**

1. Record PB-DEP-001 through PB-DEP-024.
2. Define exact narrow roles for 420Wallet, 420Identity, 420Names, 420Messenger, 420Notifications, 420Pay, 420Registry, 420AppStore, and 420Analytics.
3. Define derived/non-canonical roles for 420Indexer, 420Explorer, 420Search, and bounded 420Verify use.
4. Keep Wallet limited to account/signing/session authority and prohibit wallet connection from implying PuffBuddies membership, eligibility, consent, match, or safety state.
5. Keep Identity limited to canonical identity-profile/credential lifecycle and minimum-disclosure eligibility evidence; it must not automatically establish legal identity, wallet ownership, consent, or match authority.
6. Keep Names limited to current .420 presentation/resolution and prohibit treating names as identity, membership, eligibility, or reputation proof.
7. Keep Messenger authoritative only for its messaging-coordination domain while PuffBuddies owns the dating/social authorization handed to Messenger.
8. Keep Notifications non-canonical and delivery-only; keep Pay limited to payment/entitlement evidence; prohibit either from creating consent, eligibility, or safety overrides.
9. Keep Registry authoritative for service identity/version/active state and AppStore as a Registry-backed non-authoritative catalogue/presentation surface.
10. Keep Analytics and Indexer/Explorer/Search rebuildable/derived and prohibit protected PuffBuddies payloads or private-member enumeration.
11. Prohibit authority inheritance among dependencies and require dependency failure/staleness to preserve the owning canonical authority.
12. Define an integration decision rule requiring minimum data exchange, freshness/revocation behavior, privacy classification, authority owner, discovery/version checking, and fail-closed behavior before later runtime integration.

**Affected repository components:**

- docs/puffbuddies/PB-0.8-ECOSYSTEM-DEPENDENCIES.md
- docs/puffbuddies/PUFFBUDDIES-ROADMAP.md
- scripts/verify-puffbuddies-pb0.py
- docs/puffbuddies/PB-0.8-QUALIFICATION.md

**Qualification level:** Level 1.

**Milestone relationship:** PB-0.8 is not a Level 2 integration milestone; it defines dependency contracts without implementing cross-component runtime wiring.

**Dependencies:** PB-0.1 through PB-0.7 must remain COMPLETE.

**Exit criteria:**

- one canonical PB-0.8 ecosystem-dependencies document exists;
- PB-DEP-001 through PB-DEP-024 exist exactly once and in sequence;
- every named canonical dependency has an explicit allowed role and explicit non-authority boundary;
- derived services remain subordinate to canonical protocol state;
- Messenger cannot manufacture PuffBuddies consent, Notifications cannot create authorization, Pay cannot create consent/eligibility, and Registry/AppStore/Analytics cannot acquire ambient PuffBuddies authority;
- authority inheritance across dependencies is explicitly prohibited;
- dependency failure/freshness and integration-decision rules are documented;
- no integration client, contract, fixed address, service ID, deployment, or live wiring is falsely claimed;
- cumulative app-scoped verifier passes;
- exact-head PuffBuddies PB-0 workflow passes;
- durable PB-0.8 evidence records exact run/job evidence and current-main/base state.

### PB-0.9 — State ownership — COMPLETE

**Purpose:** define one canonical authority owner for every PuffBuddies state class and distinguish canonical authority from operational storage, caches, projections, delivery state, client state, analytics, and other derived copies.

**Canonical requirements:**

1. Record PB-STATE-001 through PB-STATE-040.
2. Define canonical ownership for wallet/account control, PuffBuddies membership, eligibility evidence/decision, profile/preferences, precise location, discovery results, likes/passes/matches/unmatches, blocks, messaging, notifications, reports/moderation, lifecycle/deletion, identity, names, service discovery, payment/entitlement, chain observations, derived projections, analytics, client/session state, abuse-prevention state, configuration, and audit evidence.
3. Preserve 420Wallet, 420Identity, 420Names, 420Messenger, 420Notifications, 420Pay, 420Registry, 420AppStore, 420Analytics, 420Indexer, 420Explorer, 420Search, and 420Verify boundaries established in PB-0.8.
4. Require exactly one canonical owner for each protected decision/state class and prohibit caches, clients, projections, delivery receipts, analytics, or derived services from becoming canonical by duplication.
5. Distinguish raw eligibility evidence ownership from the PuffBuddies-specific eligibility decision.
6. Distinguish payment settlement ownership from PuffBuddies premium-entitlement policy ownership.
7. Distinguish PuffBuddies relationship authorization from Messenger coordination and Messenger-native deny state.
8. Make PuffBuddies block, safety, moderation, lifecycle, deletion, profile, preference, relationship, and precise-location state explicitly PuffBuddies-owned private state.
9. Define conflict resolution in favor of the canonical authority with freshness/revocation checks and fail-closed behavior.
10. Do not claim schemas, storage engines, APIs, contracts, addresses, service IDs, deployments, or live wiring in PB-0.9.

**Affected repository components:**

- `docs/puffbuddies/PB-0.9-STATE-OWNERSHIP.md`
- `docs/puffbuddies/PUFFBUDDIES-ROADMAP.md`
- `scripts/verify-puffbuddies-pb0.py`
- `docs/puffbuddies/PB-0.9-QUALIFICATION.md`

**Qualification level:** Level 1.

**Milestone relationship:** PB-0.9 is not a Level 2 integration milestone; it freezes state authority boundaries without introducing executable shared integration.

**Dependencies:** PB-0.1 through PB-0.8 must remain COMPLETE.

**Exit criteria:**

- one canonical PB-0.9 state-ownership document exists;
- PB-STATE-001 through PB-STATE-040 exist exactly once and in sequence;
- all major PuffBuddies state classes have one explicit canonical authority owner;
- external ecosystem state owners remain bounded to their canonical domains;
- caches/projections/clients/analytics/delivery state are explicitly non-authoritative where appropriate;
- ownership conflict resolution, freshness/revocation, and fail-closed behavior are explicit;
- no database/API/contract/address/service-ID/deployment/live-wiring implementation is falsely claimed;
- cumulative app-scoped verifier passes;
- exact-head PuffBuddies PB-0 workflow passes;
- durable PB-0.9 evidence records exact run/job evidence and current-main/base state.

### PB-0.10 — Safety/moderation principles — COMPLETE

**Purpose:** define canonical report classes, policy-level moderation states, stable safety invariants, and escalation boundaries while preserving privacy, consent, state ownership, and dependency authority.

**Canonical requirements:**

1. Record PB-SAFETY-001 through PB-SAFETY-040.
2. Define report classes for harassment/threats, stalking/doxxing/location abuse, impersonation/deceptive identity, minor/adult-eligibility concerns, sexual exploitation/non-consensual sexual content, fraud/scam/extortion, hate/severe discriminatory abuse, spam/bot/platform manipulation, block/ban evasion, serious dangerous/unlawful conduct, cannabis-related coercion/unsafe transactional conduct, and other/policy-unclear concerns.
3. Define policy-level moderation states RECEIVED, TRIAGED, REVIEWING, RESTRICTED_PENDING_REVIEW, ACTIONED, NO_ACTION, APPEALED, and CLOSED.
4. Preserve immediate independent block authority and keep report state separate from block state.
5. Prohibit report-count guilt, payment/premium safety exceptions, moderator-manufactured consent, retaliation enablement, public moderation/reputation state, and stale-authorization bypass.
6. Require private reporter/evidence state, least-privilege moderator access, protected auditability, evidence integrity, and explicit automation limits.
7. Require current safety actions to override convenience, delivery, recommendation, cached authorization, and monetization state.
8. Define standard, high-priority, emergency/external-authority, and cross-service escalation boundaries.
9. Define appeal/restoration principles that never force unblock, rematch, conversation restoration, or renewed contact.
10. Do not claim moderation tooling, classifiers, operator consoles, evidence databases, contracts, addresses, service IDs, deployments, or live enforcement in PB-0.10.

**Affected repository components:**

- `docs/puffbuddies/PB-0.10-SAFETY-MODERATION-PRINCIPLES.md`
- `docs/puffbuddies/PUFFBUDDIES-ROADMAP.md`
- `scripts/verify-puffbuddies-pb0.py`
- `docs/puffbuddies/PB-0.10-QUALIFICATION.md`

**Qualification level:** Level 1.

**Milestone relationship:** PB-0.10 is not a Level 2 integration milestone; it defines policy and escalation boundaries without executable cross-component integration.

**Dependencies:** PB-0.1 through PB-0.9 must remain COMPLETE.

**Exit criteria:**

- one canonical PB-0.10 safety/moderation document exists;
- PB-SAFETY-001 through PB-SAFETY-040 exist exactly once and in sequence;
- all required report classes and moderation states are explicit;
- independent block authority, report/block separation, privacy, least privilege, auditability, evidence integrity, automation limits, stale-state safety, and anti-retaliation principles are explicit;
- escalation boundaries and appeal/restoration constraints are explicit;
- no moderation runtime/classifier/operator-console/evidence-database/contract/address/service-ID/deployment/live-enforcement implementation is falsely claimed;
- cumulative app-scoped verifier passes;
- exact-head PuffBuddies PB-0 workflow passes;
- durable PB-0.10 evidence records exact run/job evidence and current-main/base state.

### PB-0.11 — Data lifecycle/deletion — COMPLETE

**Purpose:** define canonical deactivation/delete semantics, retention-purpose boundaries, backup/restore behavior, moderation-evidence exceptions, dependency/participant deletion limits, and irreversible public-chain limitations.

**Canonical requirements:**

1. Record PB-DATA-001 through PB-DATA-036.
2. Distinguish deactivation from deletion and prohibit presenting deactivation as erasure.
3. Require deletion acceptance to revoke ordinary PuffBuddies participation immediately even if asynchronous cleanup remains pending.
4. Define PuffBuddies-scoped deletion targets across profile/media, preferences, relationship state, precise location, sessions/tokens, notifications, discovery/search, analytics, logs, caches, backups, and derived artifacts.
5. Define message-participant/420Messenger and 420Integrated dependency ownership boundaries so PuffBuddies does not promise erasure of data it does not canonically own.
6. Require explicit narrow purposes for safety/moderation/legal/security/accounting retention, minimum fields, least privilege, bounded duration/review, and eventual deletion/anonymization.
7. Require backup retention bounds and reapplication of deletion after restore.
8. Prohibit analytics/log/cache/derived-data and deterministic-hash pseudo-anonymization from becoming deletion bypasses.
9. Explicitly document immutable public-chain limitations and require later architecture to minimize deletion-sensitive on-chain data.
10. Define honest deletion-completion semantics, deletion audit minimization, and re-registration behavior that does not silently restore prior relationships/consent.

**Affected repository components:**

- `docs/puffbuddies/PB-0.11-DATA-LIFECYCLE-DELETION.md`
- `docs/puffbuddies/PUFFBUDDIES-ROADMAP.md`
- `scripts/verify-puffbuddies-pb0.py`
- `docs/puffbuddies/PB-0.11-QUALIFICATION.md`

**Qualification level:** Level 1.

**Milestone relationship:** PB-0.11 is not a Level 2 integration milestone; it defines lifecycle/retention policy without executable storage or cross-component runtime integration.

**Dependencies:** PB-0.1 through PB-0.10 must remain COMPLETE.

**Exit criteria:**

- one canonical PB-0.11 data-lifecycle/deletion document exists;
- PB-DATA-001 through PB-DATA-036 exist exactly once and in sequence;
- deactivation, deletion, retention, backup, moderation-evidence, dependency, public-chain, and completion semantics are explicit;
- ordinary participation is revoked once deletion begins;
- retained exceptions remain narrow, purpose-limited, least-privilege, bounded, and non-public;
- backups/restores and derived copies cannot silently resurrect deleted active state;
- immutable/public/external records are not falsely promised as erasable;
- no database/deletion-worker/retention-scheduler/API/contract/address/service-ID/deployment/live-erasure implementation is falsely claimed;
- cumulative app-scoped verifier passes;
- exact-head PuffBuddies PB-0 workflow passes;
- durable PB-0.11 evidence records exact run/job evidence and current-main/base state.

### PB-0.12 — User lifecycle — COMPLETE

**Purpose:** define canonical PuffBuddies account/application lifecycle states, transition authorities, revocation effects, failure behavior, and re-entry rules.

**Canonical requirements:**

1. Record PB-LIFE-001 through PB-LIFE-040.
2. Define canonical states UNREGISTERED, ELIGIBILITY_PENDING, ELIGIBILITY_FAILED, PROFILE_INCOMPLETE, ACTIVE, DEACTIVATED, RESTRICTED, SUSPENDED, BANNED, DELETE_REQUESTED, DELETION_IN_PROGRESS, DELETION_COMPLETE, RETAINED_EVIDENCE_ONLY, and APPEAL_REVIEW.
3. Define entry, activation, deactivation/reactivation, restriction/suspension/ban, appeal, eligibility-loss, deletion, and post-deletion re-registration transitions.
4. Keep PuffBuddies lifecycle authority separate from Wallet, Identity, Names, Messenger, Notifications, Pay, relationship state, sessions, clients, queues, and derived state.
5. Require eligibility and profile-completeness gating before ACTIVE.
6. Require deactivation, restriction, suspension, ban, and deletion states to revoke applicable ordinary participation even when stale clients/sessions/caches/queues/payment/match state disagree.
7. Prohibit appeal, payment, wallet/name changes, client refresh, or dependency recovery from silently restoring lifecycle permissions.
8. Require DELETION_COMPLETE to re-enter through a new registration lifecycle rather than direct restoration to ACTIVE.
9. Require conflicting/unknown protected lifecycle state to fail closed and lifecycle state itself to remain private/non-enumerable.
10. Require protected transition auditability without falsely claiming lifecycle services, databases, APIs, queues, workers, contracts, addresses, service IDs, deployments, or live processing.

**Affected repository components:**

- `docs/puffbuddies/PB-0.12-USER-LIFECYCLE.md`
- `docs/puffbuddies/PUFFBUDDIES-ROADMAP.md`
- `scripts/verify-puffbuddies-pb0.py`
- `docs/puffbuddies/PB-0.12-QUALIFICATION.md`

**Qualification level:** Level 1.

**Milestone relationship:** PB-0.12 is not treated as a Level 2 integration milestone because it defines lifecycle policy/state-machine semantics only and introduces no executable lifecycle authority or cross-component integration.

**Dependencies:** PB-0.1 through PB-0.11 must remain COMPLETE.

**Exit criteria:**

- one canonical PB-0.12 user-lifecycle document exists;
- PB-LIFE-001 through PB-LIFE-040 exist exactly once and in sequence;
- all required lifecycle states and transition classes are explicit;
- lifecycle authority and dependency/non-authority boundaries are explicit;
- stale authorization cannot survive lifecycle revocation;
- direct post-deletion restoration is prohibited;
- conflicting/unknown protected lifecycle state fails closed;
- lifecycle privacy and protected auditability are explicit;
- no lifecycle-service/database/API/queue/worker/contract/address/service-ID/deployment/live-processing implementation is falsely claimed;
- cumulative app-scoped verifier passes;
- exact-head PuffBuddies PB-0 workflow passes;
- durable PB-0.12 evidence records exact run/job evidence and current-main/base state.

### PB-0.13 — Matching principles — COMPLETE

**Purpose:** define allowed matching inputs, hard exclusions, ranking constraints, match-formation consent boundaries, and prohibited economic influence.

**Canonical requirements:**

1. Record PB-MATCH-001 through PB-MATCH-040.
2. Define allowed matching inputs including mode, explicit private preferences, adult age-range compatibility, explicit gender/orientation compatibility, cannabis compatibility, lifestyle/relationship preferences, coarse proximity, bounded activity freshness, canonical profile completeness, and bounded verification indicators.
3. Define hard exclusions for current blocks, non-participating lifecycle states, eligibility failure/unknown, visibility denial, scoped safety restrictions, deletion state, economic bypass attempts, self-match, stale-rematch state, and unknown protected authority.
4. Define ranking as derived/non-canonical and subordinate to current consent, block, safety, lifecycle, eligibility, visibility, and privacy authority.
5. Require current authoritative security-relevant inputs and reject stale ranking output after revocation.
6. Minimize sensitive inference and prohibit unrelated security/payment/identity data from silently becoming dating desirability inputs.
7. Prohibit public or purchasable desirability/reputation scores derived from wealth, token holdings, payments, report/block counts, moderation history, or unrelated ecosystem data.
8. Require experiments/engagement optimization to preserve all hard exclusions and user controls.
9. Preserve one-sided likes as non-messaging consent and require independent reciprocal authorized intent for mutual match formation.
10. Prohibit payment, premium, token, staking, sponsorship, boost, administrator, moderator, algorithm, AI, or automation from manufacturing/restoring interpersonal consent.
11. Define an allowed-input decision rule covering source, purpose, privacy, freshness, user control, deletion, economic influence, and failure behavior.
12. Do not claim a matching engine, recommendation model/service, feature store, database, API, contract, address, service ID, deployment, or live ranking implementation in PB-0.13.

**Affected repository components:**

- `docs/puffbuddies/PB-0.13-MATCHING-PRINCIPLES.md`
- `docs/puffbuddies/PUFFBUDDIES-ROADMAP.md`
- `scripts/verify-puffbuddies-pb0.py`
- `docs/puffbuddies/PB-0.13-QUALIFICATION.md`

**Qualification level:** Level 1.

**Milestone relationship:** PB-0.13 is not a Level 2 integration milestone; it defines matching/ranking policy only and introduces no executable matching engine or shared runtime integration.

**Dependencies:** PB-0.1 through PB-0.12 must remain COMPLETE.

**Exit criteria:**

- one canonical PB-0.13 matching-principles document exists;
- PB-MATCH-001 through PB-MATCH-040 exist exactly once and in sequence;
- allowed inputs, hard exclusions, ranking constraints, and prohibited economic influence are explicit;
- reciprocal user intent remains the only ordinary match-formation authority;
- stale ranking and economic/admin/algorithmic paths cannot bypass block, consent, safety, lifecycle, eligibility, or visibility;
- private ranking signals cannot become public desirability/social-credit state;
- no matching-engine/recommendation-model/service/feature-store/database/API/contract/address/service-ID/deployment/live-ranking implementation is falsely claimed;
- cumulative app-scoped verifier passes;
- exact-head PuffBuddies PB-0 workflow passes;
- durable PB-0.13 evidence records exact run/job evidence and current-main/base state.

### PB-0.14 — Cannabis taxonomy — COMPLETE

**Purpose:** define canonical cannabis-compatibility vocabulary and semantic boundaries without turning cannabis-related fields into public, tokenized, medical, legal, marketplace, or reputation identity.

**Canonical requirements:**

1. Record PB-CANNABIS-001 through PB-CANNABIS-040.
2. Define optional private vocabulary for use status/frequency, methods, social context, environment boundaries, partner compatibility, cannabis interests, and optional knowledge/enthusiasm.
3. Treat NON_USER and PREFER_NOT_TO_SAY as valid first-class states and prohibit coercive assumptions about consumption.
4. Keep cannabis fields private by default and subordinate to PB-0.4 privacy, PB-0.11 deletion, PB-0.12 lifecycle, and PB-0.13 matching rules.
5. Prevent Wallet, 420Identity, 420Names, Registry, AppStore, Search, Explorer, Analytics, public chain, deterministic hashes, tokens, NFTs, payments, staking, or transaction history from becoming cannabis identity authority.
6. Prohibit cannabis similarity from creating consent and prohibit cannabis fields from bypassing block, safety, lifecycle, eligibility, visibility, or deletion.
7. Prohibit public/purchasable cannabis desirability or reputation scoring.
8. Prohibit medical, legal, impairment, or professional-expertise conclusions from ordinary cannabis taxonomy fields.
9. Prohibit cannabis-related coercion and unauthorized marketplace/brokering semantics.
10. Define a taxonomy-extension decision rule covering purpose, type, privacy, visibility, matching use, prohibited inference, retention/deletion, safety/legal/health ambiguity, economic influence, and public representation.
11. Do not claim profile implementation, matching implementation, token/NFT credential, public registry, API, database, contract, address, service ID, deployment, or live taxonomy in PB-0.14.

**Affected repository components:**

- `docs/puffbuddies/PB-0.14-CANNABIS-TAXONOMY.md`
- `docs/puffbuddies/PUFFBUDDIES-ROADMAP.md`
- `scripts/verify-puffbuddies-pb0.py`
- `docs/puffbuddies/PB-0.14-QUALIFICATION.md`

**Qualification level:** Level 1.

**Milestone relationship:** PB-0.14 is not a Level 2 integration milestone; it defines vocabulary/data semantics only and introduces no executable matching/profile/shared runtime integration.

**Dependencies:** PB-0.1 through PB-0.13 must remain COMPLETE.

**Exit criteria:**

- one canonical PB-0.14 cannabis-taxonomy document exists;
- PB-CANNABIS-001 through PB-CANNABIS-040 exist exactly once and in sequence;
- required vocabulary and first-class non-use/non-disclosure states are explicit;
- privacy/public/token/economic/identity boundaries are explicit;
- matching/consent/safety/lifecycle/deletion boundaries are preserved;
- medical/legal/impairment/coercion/unauthorized-marketplace misuse is prohibited;
- the extension decision rule is explicit;
- no profile/matching/token-NFT/public-registry/API/database/contract/address/service-ID/deployment/live-taxonomy implementation is falsely claimed;
- cumulative app-scoped verifier passes;
- exact-head PuffBuddies PB-0 workflow passes;
- durable PB-0.14 evidence records exact run/job evidence and current-main/base state.

### PB-0.15 — Visibility model — COMPLETE

**Purpose:** define canonical field audiences and disclosure boundaries for private, discoverable, matched, participant-only, moderator-only, service-minimum, aggregate-only, explicitly public, and never-public PuffBuddies data.

**Canonical requirements:**

1. Record PB-VIS-001 through PB-VIS-040.
2. Define PRIVATE_SELF, DISCOVERABLE, MATCHED, PARTICIPANT_ONLY, MODERATOR_ONLY, SERVICE_MINIMUM, AGGREGATE_ONLY, PUBLIC_EXPLICIT, and NEVER_PUBLIC audiences.
3. Explicitly distinguish in-app DISCOVERABLE visibility from unauthenticated/public internet/public-protocol visibility.
4. Define canonical audience treatment for membership, ordinary profile presentation, discovery preferences, cannabis fields, precise/coarse location, likes/passes, matches, blocks, reports/moderation, messages, identity evidence, eligibility conclusions, wallet/profile linkage, payment/accounting data, lifecycle/safety state, internal ranking, sessions/security data, and audit evidence.
5. Require field-level visibility to remain subordinate to block, consent, safety, lifecycle, eligibility, visibility, and deletion authority.
6. Require block, unmatch, deactivation/restriction/suspension/ban, and deletion to revoke stale broader audiences.
7. Require caches, clients, queues, notifications, indexes, analytics, search/explorer, and derived services to preserve source visibility classifications.
8. Require server/service authorization; client-side hiding alone is not a privacy boundary.
9. Prohibit payments, premium, token holdings, staking, sponsorship, boosts, or promotions from purchasing another user's protected field visibility.
10. Define a field-classification decision rule covering ownership, default audience, allowed audience changes, override authorities, service-minimum needs, public-enumeration/inference risk, retention/deletion, stale-copy invalidation, and audit.
11. Do not claim a profile schema, ACL engine, API, database, client implementation, contract, address, service ID, deployment, or live visibility enforcement in PB-0.15.

**Affected repository components:**

- `docs/puffbuddies/PB-0.15-VISIBILITY-MODEL.md`
- `docs/puffbuddies/PUFFBUDDIES-ROADMAP.md`
- `scripts/verify-puffbuddies-pb0.py`
- `docs/puffbuddies/PB-0.15-QUALIFICATION.md`

**Qualification level:** Level 1.

**Milestone relationship:** PB-0.15 is not a Level 2 integration milestone; it defines field audience policy only and introduces no executable ACL/profile/shared runtime integration.

**Dependencies:** PB-0.1 through PB-0.14 must remain COMPLETE.

**Exit criteria:**

- one canonical PB-0.15 visibility-model document exists;
- PB-VIS-001 through PB-VIS-040 exist exactly once and in sequence;
- all canonical audiences are explicit;
- in-app discoverability is explicitly not equivalent to public visibility;
- field-specific audience classifications cover all major sensitive PuffBuddies data classes;
- stale/derived/client copies cannot preserve visibility after canonical revocation;
- Search/Explorer/public services cannot promote private in-app fields to public;
- client-side hiding alone cannot satisfy protected visibility;
- economic state cannot purchase another user's protected visibility;
- no profile-schema/ACL/API/database/client/contract/address/service-ID/deployment/live-visibility implementation is falsely claimed;
- cumulative app-scoped verifier passes;
- exact-head PuffBuddies PB-0 workflow passes;
- durable PB-0.15 evidence records exact run/job evidence and current-main/base state.

### PB-0.16 — Non-goals reconciliation — COMPLETE

**Purpose:** reconcile the complete PB-0 non-goal set against accumulated architecture through PB-0.15 and distinguish canonical prohibited behavior from features that are merely deferred.

**Canonical requirements:**

1. Record PB-NONGOAL-001 through PB-NONGOAL-040.
2. Reconcile PB-0.1 through PB-0.15 into one canonical negative-requirement set.
3. Preserve prohibitions on public relationship/cannabis/preference registries, wallet-to-profile enumeration, everything-on-chain sensitive dating state, tokenized dating/cannabis identity, purchased/admin/algorithmic consent, pay-to-message, block bypass, date escrow/marketplace behavior, wagering, wealth/desirability scoring, public precise location, public safety/lifecycle state, and public member enumeration.
4. Preserve ecosystem authority boundaries so Wallet, Identity, Names, Messenger, Pay, Registry, AppStore, Indexer, Explorer, Search, Analytics, clients, caches, and notifications cannot silently inherit PuffBuddies relationship/lifecycle/safety authority.
5. Preserve deletion honesty, stale-state revocation, and server-side authorization boundaries.
6. Distinguish PB-0.2 post-MVP deferrals from canonical prohibitions.
7. Require any future revision to a non-goal to use explicit canonical change control rather than silent implementation drift.
8. Prohibit economic, premium, experimental, AI-assisted, tokenized, administrative, or cross-app relabeling from bypassing an existing non-goal.
9. Do not claim runtime features, contracts, services, APIs, databases, addresses, service IDs, deployments, or live implementation in PB-0.16.

**Affected repository components:**

- `docs/puffbuddies/PB-0.16-NON-GOALS-RECONCILIATION.md`
- `docs/puffbuddies/PUFFBUDDIES-ROADMAP.md`
- `scripts/verify-puffbuddies-pb0.py`
- `docs/puffbuddies/PB-0.16-QUALIFICATION.md`

**Qualification level:** Level 1.

**Milestone relationship:** PB-0.16 is not a Level 2 integration milestone; it reconciles documentation/policy boundaries only and introduces no executable shared integration.

**Dependencies:** PB-0.1 through PB-0.15 must remain COMPLETE.

**Exit criteria:**

- one canonical PB-0.16 non-goals-reconciliation document exists;
- PB-NONGOAL-001 through PB-NONGOAL-040 exist exactly once and in sequence;
- prohibited non-goals are clearly separated from merely deferred features;
- accumulated privacy, consent, eligibility, safety, lifecycle, deletion, matching, cannabis, visibility, and dependency-authority boundaries remain preserved;
- economic/admin/algorithmic/dependency relabeling cannot bypass canonical non-goals;
- explicit non-goal change control is documented;
- no runtime-feature/contract/service/API/database/address/service-ID/deployment/live-implementation claim is falsely introduced;
- cumulative app-scoped verifier passes;
- exact-head PuffBuddies PB-0 workflow passes;
- durable PB-0.16 evidence records exact run/job evidence and current-main/base state.

### PB-0.17 — Repository structure — COMPLETE

**Purpose:** freeze the intended PuffBuddies repository layout and ownership boundaries before implementation expands, without falsely creating or claiming runtime implementation during PB-0.

**Canonical requirements:**

1. Record PB-STRUCT-001 through PB-STRUCT-020.
2. Reserve `docs/puffbuddies/` for canonical product, architecture, roadmap, audit, qualification, and operational documentation.
3. Reserve `puffbuddies/web/` for the web client and client-owned presentation/state only.
4. Reserve `puffbuddies/api/` for the authenticated application API/edge boundary and transport adapters, not canonical relationship authority.
5. Reserve `puffbuddies/domain/` for application-owned lifecycle, consent, matching, visibility, safety, and relationship policy/domain logic.
6. Reserve `puffbuddies/storage/` for private persistence adapters, migrations, retention/deletion machinery, and cache invalidation.
7. Reserve `puffbuddies/integrations/` for capability-limited adapters to bounded 420Integrated dependencies.
8. Reserve `puffbuddies/workers/` for asynchronous jobs whose outputs remain subordinate to canonical PuffBuddies state.
9. Reserve `puffbuddies/tests/` for app integration/adversarial qualification while allowing colocated unit tests under repository conventions.
10. Reserve `contracts/src/puffbuddies/` only for a later explicitly justified minimum-disclosure on-chain component; PB-0.17 does not require or authorize one.
11. Keep app scripts/workflows/configuration under existing repository conventions rather than creating parallel build/deployment authorities.
12. Define inward dependency direction: clients/transports/adapters depend on canonical domain interfaces and cannot become PuffBuddies authority owners.
13. Keep secrets, raw private user data, moderation evidence, production databases, generated credentials, and environment-specific sensitive state out of source control.
14. Keep generated/cache/build artifacts non-canonical unless a later repository rule explicitly requires a committed artifact.
15. Prohibit duplicate canonical state stores or shadow authorities across web, API, workers, integrations, derived services, or contracts.
16. Require future new top-level PuffBuddies implementation areas to be justified against this structure and PB-0 ownership/privacy boundaries.
17. Preserve PB-0.1 through PB-0.16 invariants and non-goals.
18. Explicitly distinguish reserved future paths from implemented/live paths.
19. Do not assign contracts, fixed/Genesis addresses, service IDs, deployment topology, databases, live endpoints, or production infrastructure in PB-0.17.
20. Keep PB-0 qualification/evidence machinery app-scoped and cumulative.

**Affected repository components:**

- `docs/puffbuddies/PB-0.17-REPOSITORY-STRUCTURE.md`
- `docs/puffbuddies/PUFFBUDDIES-ROADMAP.md`
- `scripts/verify-puffbuddies-pb0.py`
- `docs/puffbuddies/PB-0.17-QUALIFICATION.md`

**Qualification level:** Level 1.

**Milestone relationship:** PB-0.17 is not a Level 2 integration milestone; it freezes repository ownership/layout authority without introducing executable shared integration.

**Dependencies:** PB-0.1 through PB-0.16 must remain COMPLETE.

**Exit criteria:**

- one canonical PB-0.17 repository-structure document exists;
- PB-STRUCT-001 through PB-STRUCT-020 exist exactly once and in sequence;
- documentation, client, API, domain, storage, integration, worker, test, and optional-contract boundaries are explicit;
- dependency direction and canonical ownership rules prohibit shadow authority;
- reserved future paths are explicitly distinguished from implemented/live paths;
- source-control exclusions for secrets/private data/generated state are explicit;
- no runtime directory, contract, fixed address, service ID, deployment, database, endpoint, or live integration is falsely introduced or claimed;
- cumulative app-scoped verifier passes;
- exact-head PuffBuddies PB-0 workflow passes for the implementation SHA;
- durable PB-0.17 evidence records exact run/job evidence and current-main/base state.

### PB-0.18 — Documentation/invariant tests — COMPLETE

**Purpose:** extend machine-verifiable PB-0 documentation and invariant qualification so the accumulated PB-0 foundation is checked as one coherent authority set rather than only as isolated documents.

**Canonical requirements:**

1. Record PB-DOCINV-001 through PB-DOCINV-020.
2. Define and verify the complete PB-0.1 through PB-0.17 canonical/evidence inventory.
3. Prevent silent omission of any completed PB-0 step from machine qualification.
4. Verify invariant identifiers are globally unique across canonical PB-0 source documents.
5. Verify every invariant family retains its exact expected count and sequence.
6. Verify roadmap completion continuity through PB-0.17.
7. Verify PB-0.1 through PB-0.17 evidence identifies its step and COMPLETE state.
8. Cross-check adult-only identity, Dating/Buddy/Both, optional cannabis compatibility, and wallet/profile unlinkability.
9. Cross-check mutual messaging consent, revocability, block supremacy, and no purchased/admin/algorithmic consent.
10. Cross-check private/off-chain sensitive state, discoverable-not-public, and client-hiding-not-authorization rules.
11. Cross-check PuffBuddies canonical relationship/lifecycle/safety ownership and bounded dependencies.
12. Cross-check stale-authorization failure, deactivation/deletion distinction, and deletion-aware derived-state invalidation.
13. Cross-check hard exclusions before ranking, one-sided-like limits, and cannabis authority limits.
14. Cross-check reconciled non-goals including public registries, paid bypasses, public scoring, stale resurrection, and client-only privacy.
15. Cross-check PB-0.17 reserved paths remain non-runtime architecture locations.
16. Reject fixed PuffBuddies on-chain addresses and invented PuffBuddies service IDs in canonical PB-0 documents.
17. Add adversarial mutation tests proving representative canonical drift fails verification.
18. Keep qualification exact-head, app-scoped, and cumulative.
19. Preserve PB-0.1 through PB-0.17 semantics without weakening earlier checks.
20. Record durable exact-SHA Level 1 evidence.

**Affected repository components:**

- `docs/puffbuddies/PB-0.18-DOCUMENTATION-INVARIANT-TESTS.md`
- `docs/puffbuddies/PUFFBUDDIES-ROADMAP.md`
- `scripts/verify-puffbuddies-pb0.py`
- `scripts/test-puffbuddies-pb0-invariants.py`
- `.github/workflows/puffbuddies-pb0.yml`
- `docs/puffbuddies/PB-0.18-QUALIFICATION.md`

**Qualification level:** Level 1.

**Milestone relationship:** PB-0.18 is not a Level 2 integration milestone; it hardens accumulated PB-0 documentation/invariant qualification without introducing runtime or shared integration behavior.

**Dependencies:** PB-0.1 through PB-0.17 must remain COMPLETE and machine-verifiable.

**Exit criteria:**

- PB-DOCINV-001 through PB-DOCINV-020 exist exactly once and in sequence;
- complete PB-0.1 through PB-0.17 canonical/evidence inventory is machine-checked;
- global invariant-ID uniqueness and exact family sequences are machine-checked;
- roadmap/evidence continuity through PB-0.17 is machine-checked;
- cross-step identity/privacy/consent/authority/lifecycle/matching/cannabis/visibility/non-goal/structure invariants are machine-checked;
- representative adversarial mutations are proven to fail qualification;
- no fixed address/service ID/runtime implementation is introduced or claimed;
- exact-head app-scoped workflow passes;
- durable PB-0.18 evidence records exact run/job evidence and current-main/base state.

### PB-0.19 — Master implementation roadmap — COMPLETE

**Purpose:** reconcile PB-1 through launch against the complete PB-0 architecture and establish the canonical implementation order without claiming that future runtime phases are already implemented.

**Canonical requirements:**

1. Record PB-ROADMAP-001 through PB-ROADMAP-024.
2. Define ordered implementation phases from PB-1 through launch.
3. Map every future phase back to the PB-0 authority/invariant families it must preserve.
4. Keep adult eligibility, privacy, consent, lifecycle, safety, matching, cannabis, visibility, deletion, dependency, and non-goal constraints release-gating.
5. Preserve PuffBuddies ownership of relationship/lifecycle/safety authority and bounded dependency authority.
6. Keep public-chain use minimal and prevent public membership/relationship/cannabis/safety leakage.
7. Require mutual authorized intent before ordinary private messaging and preserve block/unmatch/revocation supremacy.
8. Require deletion-aware caches, indexes, analytics, notifications, workers, and derived services.
9. Keep Search/Explorer/Indexer/Analytics and other derived surfaces non-canonical.
10. Keep PB-0.17 repository paths reserved until their implementation phases actually create them.
11. Separate baseline safety/account-exit capabilities from premium/convenience features.
12. Keep post-MVP deferrals distinct from categorical PB-0.16 prohibitions.
13. Define phase-specific implementation, testing, security, integration, documentation, and evidence gates.
14. Define app-specific Level 2 milestones at meaningful convergence points without renumbering canonical phases.
15. Reserve Level 3 comprehensive current-main reconciliation for complete phase closeout/release boundaries.
16. Require exact-SHA evidence for implementation-bearing phases.
17. Require dependency adapters to fail closed on stale/revoked authority.
18. Require private-state migration/backfill/restore paths to preserve deletion, visibility, consent, and lifecycle revocation.
19. Require launch readiness to include operational privacy/safety/deletion/incident/rollback controls, not merely feature completion.
20. Prevent roadmap items from silently manufacturing fixed addresses, service IDs, deployments, or integrations before their canonical authority exists.
21. Define testnet/external prerequisites explicitly where future qualification cannot be completed repository-only.
22. Define change control for future roadmap edits against PB-0 invariants.
23. Make PB-0.20 the PB-0 phase closeout gate before PB-1 implementation begins.
24. Record durable exact-SHA Level 1 qualification evidence for PB-0.19.

**Affected repository components:**

- `docs/puffbuddies/PB-0.19-MASTER-IMPLEMENTATION-ROADMAP.md`
- `docs/puffbuddies/PUFFBUDDIES-ROADMAP.md`
- `scripts/verify-puffbuddies-pb0.py`
- `docs/puffbuddies/PB-0.19-QUALIFICATION.md`

**Qualification level:** Level 1.

**Milestone relationship:** PB-0.19 defines future Level 2 milestone boundaries but is not itself a Level 2 integration milestone because it introduces no runtime/shared integration behavior.

**Dependencies:** PB-0.1 through PB-0.18 must remain COMPLETE and machine-verifiable.

**Exit criteria:**

- PB-ROADMAP-001 through PB-ROADMAP-024 exist exactly once and in sequence;
- ordered PB-1-through-launch phases are defined with PB-0 authority mappings;
- implementation/test/security/integration/docs/evidence gates are defined for future phases;
- Level 2 milestone boundaries and Level 3 closeout ownership are explicit;
- PB-0 prohibitions and release-gating invariants cannot be silently weakened by future roadmap work;
- no future runtime/deployment/address/service-ID state is falsely claimed;
- exact-head app-scoped PB-0.19 qualification passes;
- durable evidence records exact run/job evidence and current-main/base state.

### PB-0.20 — PB-0 qualification and formal closeout

Run the accumulated PB-0 milestone qualification, reconcile durable evidence, and formally close the canonical-foundation phase.

## Post-PB-0 phase names

The currently reserved phase sequence is:

- PB-1 — Architecture and privacy implementation model
- PB-2 — Identity / adult eligibility
- PB-3 — Profiles
- PB-4 — Discovery
- PB-5 — Likes and matching
- PB-6 — 420Messenger integration
- PB-7 — 420Notifications integration
- PB-8 — Safety and moderation
- PB-9 — Verification and reputation
- PB-10 — Payments and premium entitlements
- PB-11 — Web application
- PB-12 — Mobile applications
- PB-13 — 420Integrated cross-app integration
- PB-14 — Backend/API hardening
- PB-15 — Qualification
- PB-16 — Security/privacy audit
- PB-17 — Closed testnet
- PB-18 — Public testnet
- PB-19 — Mainnet
- PB-20 — Public launch

These phase names reserve roadmap order only; they do not assert implementation or readiness.
