# PuffBuddies PB-0.13 matching principles

## Purpose

PB-0.13 defines the canonical principles governing PuffBuddies discovery ranking and match formation.

It establishes:

- allowed matching inputs;
- hard exclusions and deny conditions;
- ranking constraints;
- prohibited economic influence;
- consent boundaries between recommendations, likes, and matches;
- privacy/freshness requirements for derived matching state;
- fairness and anti-manipulation expectations.

PB-0.13 defines policy only. It does not implement a matching engine, recommendation model, ranking service, feature store, database, API, contract, address, service ID, deployment, or live algorithm.

## Matching principles

1. Discovery ranking may recommend people; it cannot create consent.
2. A mutual match requires independent reciprocal user intent under PB-0.5.
3. Hard safety, lifecycle, eligibility, block, and visibility exclusions outrank ranking.
4. Matching inputs must be purpose-limited, privacy-preserving, and current enough for their use.
5. Money, token holdings, payment status, staking, or premium purchase cannot buy another person's match or consent.
6. Derived scores are non-canonical and must never become public social-credit or desirability scores.
7. When protected authority is uncertain, discovery/match authorization fails closed.

## Allowed matching inputs

### PB-MATCH-001 — Explicit user mode is allowed

Dating, Buddy, or Both mode may be used as a first-class matching/discovery input when it is current and intentionally selected by the user.

### PB-MATCH-002 — Explicit discovery preferences are allowed

Current user-selected discovery preferences may be used when they are within the canonical product scope and handled as private PuffBuddies state.

### PB-MATCH-003 — Age-range compatibility may be used after eligibility

A user's allowed discovery age range may be used only for users who already satisfy current adult-eligibility requirements.

Raw date of birth or identity evidence must not be exposed to the matching engine when a less-disclosing age/eligibility representation is sufficient.

### PB-MATCH-004 — Gender/orientation compatibility may use explicit private preferences

Explicitly provided gender/orientation/profile compatibility fields may be used where the product design requires them.

The system must not infer or publish sensitive traits merely to improve ranking.

### PB-MATCH-005 — Cannabis compatibility may be used

User-declared cannabis compatibility, preferences, boundaries, and related lifestyle choices may be used as private matching inputs.

Cannabis use is not mandatory for PuffBuddies participation and no matching rule may coerce consumption.

### PB-MATCH-006 — Lifestyle and relationship preferences may be used

Explicit user-selected relationship, lifestyle, and compatibility preferences may be used when purpose-limited to discovery/matching.

### PB-MATCH-007 — Coarse proximity may be used

Approximate distance or coarse location compatibility may be used for discovery when consistent with PB-0.4 location privacy.

Precise coordinates, movement history, or exact address are not ordinary ranking inputs.

### PB-MATCH-008 — Activity freshness may be used narrowly

Recent account activity or availability may be used to avoid stale/inactive recommendations where later product design permits.

Activity signals must not become a public status score or a proxy for coercive engagement ranking.

### PB-MATCH-009 — Profile completeness may be used only within lifecycle policy

Canonical profile completeness may gate or modestly influence discovery where later product rules permit.

A client-side completeness flag is not authoritative.

### PB-MATCH-010 — User-controlled verification indicators may be used narrowly

Approved verification conclusions may be used only for the specific product purpose defined by later policy.

Verification status must not silently become a universal trust, desirability, wealth, or social-worth score.

## Hard exclusions

### PB-MATCH-011 — Current block is a hard exclusion

A current PuffBuddies block between two users must exclude the pair from ordinary discovery and match formation.

No ranking score, payment, boost, or stale cache may override the block.

### PB-MATCH-012 — Ineligible lifecycle state is a hard exclusion

UNREGISTERED, ELIGIBILITY_PENDING, ELIGIBILITY_FAILED, DEACTIVATED, SUSPENDED, BANNED, DELETE_REQUESTED, DELETION_IN_PROGRESS, DELETION_COMPLETE, RETAINED_EVIDENCE_ONLY, and any RESTRICTED state that disables discovery/matching must not participate as ordinary matching candidates.

### PB-MATCH-013 — Adult-eligibility failure is a hard exclusion

INELIGIBLE or UNKNOWN where PB-0.6 requires fail-closed behavior excludes the subject from ordinary discovery and match formation.

### PB-MATCH-014 — Visibility denial is a hard exclusion

A user who is not currently visible under canonical PuffBuddies visibility/lifecycle rules must not be surfaced merely because a ranking cache still contains the profile.

### PB-MATCH-015 — Safety restriction is a hard exclusion within its scope

Safety/moderation restrictions under PB-0.10 override recommendation and ranking where the restriction covers discovery, matching, profile visibility, or contact.

### PB-MATCH-016 — Deletion state is a hard exclusion

Deletion-requested, deletion-in-progress, or deletion-complete accounts must not remain discoverable or matchable through caches, queues, indexes, analytics, or recommendation artifacts.

### PB-MATCH-017 — Existing deny state cannot be bypassed by alternate economic path

A paid feature, premium tier, token balance, stake, subscription, promotion, or sponsorship must not reintroduce a candidate excluded by block, lifecycle, eligibility, safety, or visibility policy.

### PB-MATCH-018 — Self-matching is excluded

A subject must not be recommended to or matched with the same canonical PuffBuddies account.

### PB-MATCH-019 — Canonical pair state must prevent stale rematch

Where an unmatch, block, deletion, or other canonical deny state prohibits rematch, stale likes or cached reciprocal state must not recreate the relationship.

### PB-MATCH-020 — Unknown protected authority fails closed

If the system cannot establish current block, lifecycle, eligibility, safety, or visibility state required for protected discovery/match authorization, the pair must not be treated as allowed.

## Ranking constraints

### PB-MATCH-021 — Ranking is non-canonical

Ranking output is a derived recommendation view, not canonical relationship, consent, safety, identity, eligibility, or lifecycle state.

### PB-MATCH-022 — Ranking cannot manufacture a match

The recommendation engine, backend, administrator, moderator, model, optimizer, or experiment framework cannot create reciprocal interpersonal consent.

A mutual match must come from independent authorized user intent.

### PB-MATCH-023 — Ranking must respect action-scoped consent

Being ranked or shown in discovery does not imply consent to messaging, exact-location disclosure, public indexing, wallet disclosure, or other private access.

### PB-MATCH-024 — Ranking inputs require current authoritative source state

Security-relevant inputs such as block, eligibility, lifecycle, and visibility must be resolved from their canonical authority rather than stale analytics or client caches.

### PB-MATCH-025 — Stale ranking output cannot preserve authorization

A cached recommendation must be invalidated or rejected if a later block, unmatch policy, deactivation, suspension, ban, deletion, eligibility loss, or visibility change makes the pair ineligible.

### PB-MATCH-026 — Ranking should minimize sensitive inference

The system should prefer explicit user-provided compatibility inputs over inferred sensitive characteristics when the explicit input is sufficient.

Matching must not create hidden inferred profiles merely because prediction could improve engagement.

### PB-MATCH-027 — Ranking must be purpose-limited

Signals collected for security, moderation, fraud prevention, payments, identity proofing, or unrelated 420Integrated services must not be repurposed into dating desirability ranking without an explicit later canonical authorization consistent with privacy policy.

### PB-MATCH-028 — Ranking must not expose private scores

Internal recommendation scores, compatibility scores, model features, risk signals, block counts, report counts, or moderation indicators must not become publicly enumerable user reputation or desirability metrics.

### PB-MATCH-029 — Ranking experiments cannot weaken invariants

A/B tests, model experiments, feature flags, or optimization frameworks must not bypass block, consent, eligibility, safety, lifecycle, visibility, or privacy rules.

### PB-MATCH-030 — Engagement optimization is subordinate to user control

Ranking may not intentionally favor harassment, repeated unwanted exposure, addictive interaction patterns, or reappearance of previously denied users merely to increase engagement.

### PB-MATCH-031 — Ranking must preserve mode compatibility

Dating/Buddy/Both compatibility must remain consistent with each user's current selected mode and later canonical interaction rules.

### PB-MATCH-032 — Ranking must not rely on exact wealth or token value

Wallet balance, token holdings, NFT value, stake, transaction history, payment volume, or portfolio value must not be used as ordinary dating desirability inputs.

### PB-MATCH-033 — Ranking must not use payment to alter another user's consent surface

A purchaser's payment may affect only later-approved self-directed tooling or presentation features.

It must not force placement into a specific other user's feed, bypass that user's filters/blocks, or compel reciprocal visibility.

### PB-MATCH-034 — Ranking must not convert moderation history into desirability

Reports, block counts, case outcomes, safety flags, or abuse signals may support safety enforcement, but must not become a public or purchasable dating desirability score.

### PB-MATCH-035 — Ranking must be reproducibly policy-bounded

Later implementation must make it possible to determine which policy/version and eligibility/safety/visibility gates governed a recommendation decision, without exposing private model inputs publicly.

### PB-MATCH-036 — Ranking failure must degrade safely

If the ranking service or model is unavailable, PuffBuddies may degrade to a simpler allowed discovery method, but hard exclusions and privacy/consent gates must remain enforced.

## Match formation and economic influence

### PB-MATCH-037 — Like remains unilateral intent only

A one-sided like may contribute to match formation but does not itself authorize ordinary private messaging.

### PB-MATCH-038 — Mutual match requires reciprocal authorized intent

A mutual match may form only when both sides independently perform the canonical reciprocal action or another later explicitly approved equivalent consent mechanism.

### PB-MATCH-039 — Economic influence cannot create or restore consent

Payment, premium status, token balance, staking, NFT ownership, sponsorship, boosts, promotions, or other economic consideration must not create a match, force a reciprocal like, restore a revoked match, bypass a block, or unlock unmatched private messaging.

### PB-MATCH-040 — Administrative and algorithmic systems cannot fabricate consent

Administrators, moderators, support staff, governance actors, smart contracts, AI systems, recommendation models, ranking services, experiments, or automation must not create positive interpersonal consent on behalf of users.

## Allowed-input decision rule

Before later implementation adds a matching/ranking input, it must document:

1. the input's canonical source;
2. whether it is user-declared, derived, or authoritative;
3. the product purpose;
4. privacy classification;
5. freshness/revocation requirements;
6. whether it can expose or infer sensitive data;
7. whether it can affect hard exclusions;
8. whether the user can control or correct it where appropriate;
9. retention/deletion behavior;
10. whether economic influence can alter it;
11. how failure/staleness behaves;
12. how the input is tested against PB-0.3 through PB-0.12.

An input without a defined purpose, authority, privacy boundary, and failure behavior is not canonical.

## PB-0.13 completion boundary

PB-0.13 is satisfied when the repository:

- records PB-MATCH-001 through PB-MATCH-040 exactly once and in sequence;
- defines allowed inputs covering mode, explicit preferences, adult age-range compatibility, explicit gender/orientation compatibility, cannabis compatibility, lifestyle/relationship preferences, coarse proximity, limited activity freshness, profile completeness, and bounded verification indicators;
- defines hard exclusions for block, lifecycle, eligibility, visibility, safety, deletion, economic bypass, self-match, stale-rematch, and unknown protected authority;
- defines ranking as non-canonical, privacy-preserving, purpose-limited, current-authority-bounded, experiment-safe, and subordinate to user controls;
- prohibits public/private desirability scoring based on wealth, payments, moderation history, block/report counts, or unrelated ecosystem data;
- requires one-sided likes to remain non-messaging consent and mutual matches to require independent reciprocal intent;
- prohibits economic, administrative, or algorithmic fabrication/restoration of consent;
- preserves PB-0.1 through PB-0.12;
- introduces no matching engine, recommendation service/model, feature store, database, API, contract, address, service ID, deployment, or false live-ranking claim.
