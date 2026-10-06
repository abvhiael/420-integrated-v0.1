# PuffBuddies PB-0.16 non-goals reconciliation

## Purpose

PB-0.16 reconciles the complete PB-0 non-goal set against the accumulated PuffBuddies architecture through PB-0.15.

This document distinguishes:

- canonical product non-goals that remain prohibited unless an explicit later canonical change revises governing invariants;
- post-MVP deferrals that are not inherently prohibited;
- implementation details intentionally left to later roadmap phases;
- behaviors that would contradict privacy, consent, safety, lifecycle, matching, cannabis, or visibility authority.

PB-0.16 is documentation/policy reconciliation only. It does not implement runtime features, contracts, services, clients, APIs, databases, addresses, service IDs, deployments, or live integrations.

## Reconciliation principles

1. A deferred feature is not automatically a prohibited non-goal.
2. A prohibited non-goal cannot be reintroduced merely by renaming it as premium, experimental, AI-assisted, tokenized, administrative, or cross-app functionality.
3. Later implementation may refine mechanics but must preserve PB-0.1 through PB-0.15 unless a canonical roadmap change explicitly revises them.
4. Economic, blockchain, moderation, identity, or ranking systems cannot manufacture interpersonal authority that PuffBuddies does not canonically own.
5. Public-chain or public-service convenience cannot override deletion-aware privacy boundaries.

## Canonical reconciled non-goals

### PB-NONGOAL-001 — No public relationship graph
PuffBuddies is not a public graph of likes, passes, matches, unmatches, blocks, conversations, or relationship history.

### PB-NONGOAL-002 — No public cannabis-use registry
PuffBuddies is not a public list or registry of cannabis consumers, use frequency, methods, preferences, or compatibility.

### PB-NONGOAL-003 — No public sexual/romantic preference registry
Private sexual, romantic, gender, age-range, relationship, and discovery preferences must not become public identity or public-search attributes.

### PB-NONGOAL-004 — No wallet-to-dating-profile public directory
Wallet addresses, 420Names, transaction history, token balances, or other ecosystem identifiers must not provide a canonical public lookup to PuffBuddies membership/profile identity.

### PB-NONGOAL-005 — No everything-on-chain dating system
Sensitive profile, relationship, preference, location, safety, message, moderation, and lifecycle state is not intended for public-chain persistence.

### PB-NONGOAL-006 — No NFT/tokenized dating identity
PuffBuddies does not require transferable tokens/NFTs as canonical proof of dating identity, cannabis identity, desirability, relationship status, or consent.

### PB-NONGOAL-007 — No purchased consent
Payment, premium status, tokens, staking, NFTs, boosts, sponsorship, or any economic consideration cannot create, restore, compel, or substitute interpersonal consent.

### PB-NONGOAL-008 — No pay-to-message unmatched strangers
Ordinary unsolicited private messaging to unmatched users cannot be unlocked by payment or token state.

### PB-NONGOAL-009 — No paid block bypass
No economic, administrative, algorithmic, or dependency path may bypass a current block.

### PB-NONGOAL-010 — No administrator-manufactured mutual consent
Administrators, moderators, support staff, governance actors, or operators cannot create a like, match, unblock, rematch, or reciprocal consent on behalf of users.

### PB-NONGOAL-011 — No algorithm/AI-manufactured consent
Recommendation systems, ranking models, experiments, AI agents, or automation cannot create positive interpersonal consent.

### PB-NONGOAL-012 — No escrow marketplace for dates
PuffBuddies is not an escrow, auction, bidding, brokerage, or marketplace system for purchasing dates or interpersonal access.

### PB-NONGOAL-013 — No cannabis marketplace entitlement
Cannabis compatibility, matching, profiles, tokens, payments, or interest fields do not authorize cannabis sale, purchase, delivery, exchange, or brokering through PuffBuddies.

### PB-NONGOAL-014 — No gambling/wagering/prediction dating product
PuffBuddies is not a wagering, betting, prediction-market, or gambling product around matches, relationships, user behavior, or dating outcomes.

### PB-NONGOAL-015 — No wallet-wealth dating ranking
Wallet balance, token holdings, NFT value, stake, transaction volume, payment history, or portfolio value are not dating desirability signals.

### PB-NONGOAL-016 — No public social-credit/desirability score
PuffBuddies must not publish a universal desirability, trust, popularity, social-credit, or dating-worth score.

### PB-NONGOAL-017 — No moderation-derived public reputation
Report counts, block counts, safety flags, case outcomes, moderation history, or abuse signals must not become public/purchasable dating reputation.

### PB-NONGOAL-018 — No public precise-location discovery
Exact coordinates, exact address, raw GPS history, or equivalent high-resolution location are not public discovery primitives.

### PB-NONGOAL-019 — No public-member search engine
PuffBuddies discovery is an authorized in-app function, not an unauthenticated people-search or public member-enumeration service.

### PB-NONGOAL-020 — No public match-history/profile archive
Deleted, deactivated, unmatched, or historical PuffBuddies relationship/profile state must not be preserved as a public archival product.

### PB-NONGOAL-021 — No sale of protected visibility
Payment/premium status cannot buy access to another user's private preferences, location, messages, matches, blocks, reports, safety state, or restricted profile fields.

### PB-NONGOAL-022 — No premium safety/consent bypass
Block, report, unmatch, eligibility enforcement, deactivation/deletion, and consent protections are not premium override features.

### PB-NONGOAL-023 — No hidden inferred sensitive profile as a product goal
PuffBuddies is not intended to infer and maintain undisclosed sexual, romantic, cannabis, health, legal, or other sensitive traits merely to optimize engagement.

### PB-NONGOAL-024 — No public lifecycle/suspension/ban registry
Private PuffBuddies lifecycle, suspension, ban, deletion, and appeal states must not become publicly enumerable identity attributes.

### PB-NONGOAL-025 — No public safety/report registry
Reporter identity, report evidence, moderation notes, risk signals, block history, or case history must not become public profile data.

### PB-NONGOAL-026 — No replacement for emergency/law-enforcement/crisis services
PuffBuddies moderation is not itself emergency response, law enforcement, medical care, crisis intervention, or legal counsel.

### PB-NONGOAL-027 — No medical cannabis authority
Cannabis taxonomy/profile data is not a diagnosis, prescription, dosage recommendation, treatment plan, medical credential, or health-status authority.

### PB-NONGOAL-028 — No legal cannabis authority
PuffBuddies does not certify legality of possession, cultivation, purchase, transport, gifting, consumption, or sale in a jurisdiction.

### PB-NONGOAL-029 — No impairment determination from cannabis profile
Self-described cannabis use/frequency is not proof of present impairment, fitness to drive/work, or capacity to consent.

### PB-NONGOAL-030 — No minor participation
PuffBuddies is an adult-only application; PB-0 architecture does not permit ordinary participation by minors.

### PB-NONGOAL-031 — No identity-provider takeover of PuffBuddies consent
420Identity or another identity system may provide bounded evidence but cannot own likes, matches, blocks, messaging consent, or PuffBuddies lifecycle.

### PB-NONGOAL-032 — No Messenger takeover of dating authority
420Messenger owns its messaging domain but cannot manufacture PuffBuddies match/consent or weaken PuffBuddies block/safety authority.

### PB-NONGOAL-033 — No payment-system takeover of relationship authority
420Pay owns settlement/accounting evidence but cannot own interpersonal eligibility, consent, block, match, or private access.

### PB-NONGOAL-034 — No Registry/AppStore authority expansion
Registry publication or AppStore catalogue presence does not grant PuffBuddies membership, identity, consent, lifecycle, custody, signing, or user-state authority.

### PB-NONGOAL-035 — No derived-service authority promotion
Indexer, Explorer, Search, Analytics, notifications, caches, clients, and projections are not canonical owners of underlying PuffBuddies private/security state.

### PB-NONGOAL-036 — No privacy downgrade through hashing/commitments
Deterministic hashes, predictable commitments, or public identifiers are not an acceptable shortcut for publishing sensitive dating/cannabis/relationship data.

### PB-NONGOAL-037 — No deletion theater
PuffBuddies must not claim complete erasure where immutable chain records, participant-held copies, backups, or explicit narrow retention exceptions remain.

### PB-NONGOAL-038 — No stale-state resurrection
Caches, sessions, queues, payments, recommendations, notifications, or derived services must not resurrect access after block, unmatch, restriction, suspension, ban, deactivation, or deletion.

### PB-NONGOAL-039 — No client-only privacy/security boundary
Visual hiding or optimistic client state is not a substitute for server/service authorization.

### PB-NONGOAL-040 — No implied implementation from PB-0 documentation
PB-0 policy, taxonomy, roadmaps, and qualification evidence must not be treated as proof that later runtime features, contracts, services, deployments, clients, or integrations exist.

## Deferred but not prohibited

The following PB-0.2 post-MVP categories remain deferred rather than categorically prohibited, provided later canonical work preserves PB-0 invariants:

- video profiles, voice introductions, voice/video calling, live streaming, ephemeral stories;
- group dating, group chat, events, speed dating, community rooms;
- richer recommendations and optional AI assistance that do not manufacture consent or create prohibited sensitive/reputation scoring;
- boosts, priority placement, travel mode, referral/reward, customization, undo/rewind, premium filters, liked-you views, incognito controls;
- subscriptions and token-gated cosmetic/convenience features;
- richer verification and optional bounded credentials;
- native iOS/Android clients.

A deferred feature becoming later in-scope requires an explicit canonical roadmap/architecture definition and must remain compatible with all applicable PB-0 invariants.

## Reconciliation matrix

| Accumulated architecture area | Reconciled non-goal boundary |
| --- | --- |
| Product identity | no public registry, marketplace, wagering, purchased interpersonal access |
| MVP scope | deferred features remain non-blocking; prohibited consent/safety/privacy bypass remains forbidden |
| Blockchain boundary | no everything-on-chain sensitive dating state |
| Privacy | no public correlation, preference/location/relationship enumeration, or privacy sale |
| Consent | no purchased/admin/algorithmic consent or block bypass |
| Eligibility | no minors and no economic/admin eligibility fabrication |
| Threat/trust | no dependency receives ambient authority |
| Dependencies | Wallet/Identity/Names/Messenger/Pay/Registry/AppStore/derived services remain bounded |
| State ownership | caches/projections do not become canonical |
| Safety | no public reputation or purchased safety exception |
| Data lifecycle | no deletion theater or stale resurrection |
| User lifecycle | no wallet/payment/client-driven lifecycle restoration |
| Matching | no wealth/desirability ranking or algorithmic consent |
| Cannabis taxonomy | no public/tokenized/medical/legal/marketplace cannabis identity |
| Visibility | discoverable is not public; protected audiences cannot be purchased |

## Non-goal change-control rule

A later proposal that appears to conflict with a PB-0 non-goal must explicitly document:

1. which PB-NONGOAL invariant is affected;
2. which earlier PB-0 invariant(s) are affected;
3. why the behavior is necessary;
4. privacy, consent, safety, lifecycle, deletion, and authority consequences;
5. whether the proposal changes product identity;
6. whether the change requires a canonical roadmap revision;
7. new adversarial/negative tests;
8. migration/compatibility implications;
9. whether public-chain or public-index exposure changes;
10. whether the proposal introduces economic influence over another user's rights.

Silent erosion of a non-goal through implementation is not canonical.

## PB-0.16 completion boundary

PB-0.16 is satisfied when the repository:

- records PB-NONGOAL-001 through PB-NONGOAL-040 exactly once and in sequence;
- reconciles PB-0.1 through PB-0.15 non-goals into one canonical negative-requirement set;
- distinguishes prohibited non-goals from PB-0.2 features that are merely deferred;
- explicitly preserves privacy, consent, block, eligibility, lifecycle, deletion, matching, cannabis, visibility, and dependency-authority boundaries;
- prohibits economic/admin/algorithmic rebranding from bypassing canonical non-goals;
- defines explicit change control for any future proposal that would revise a non-goal;
- introduces no runtime feature, contract, service, API, database, address, service ID, deployment, or false implementation claim.
