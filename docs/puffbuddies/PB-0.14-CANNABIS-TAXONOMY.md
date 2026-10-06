# PuffBuddies PB-0.14 cannabis taxonomy

## Purpose

PB-0.14 defines the canonical cannabis-compatibility vocabulary used by PuffBuddies.

The taxonomy exists to support private profile expression, discovery preferences, boundaries, and compatibility without turning cannabis-related fields into:

- public identity;
- public-chain profile state;
- tokenized identity or status;
- a legal-compliance credential;
- a medical diagnosis or health conclusion;
- a marketplace signal;
- a universal reputation score.

PB-0.14 defines vocabulary and semantics only. It does not implement profile fields, databases, matching code, smart contracts, tokens, credentials, APIs, service IDs, deployments, or live cannabis verification.

## Taxonomy principles

1. Cannabis use is optional; non-use is a valid first-class state.
2. Cannabis compatibility describes preferences and boundaries, not personal worth.
3. Cannabis fields are private PuffBuddies profile/preference state unless a user intentionally discloses a specific field within later visibility rules.
4. Cannabis data must not become public wallet, Identity, Names, Registry, Explorer, Search, Analytics, or chain-enumerable identity.
5. Cannabis vocabulary must not imply medical advice, diagnosis, impairment, legality, product safety, or fitness to drive/work.
6. Cannabis compatibility never creates consent to consume, purchase, sell, transport, share, or use cannabis.
7. Economic/token state must not create or certify cannabis identity.

## Canonical cannabis-compatibility vocabulary

### PB-CANNABIS-001 — Use-status vocabulary

Canonical user-declared use status may distinguish:

- NON_USER;
- OCCASIONAL_USER;
- REGULAR_USER;
- FREQUENT_USER;
- PREFER_NOT_TO_SAY.

These labels are self-description for compatibility, not clinical, legal, or dependency classifications.

### PB-CANNABIS-002 — NON_USER is first-class

A user who does not consume cannabis remains fully valid for PuffBuddies participation.

NON_USER must not be treated as lower-quality, less compatible in general, or ineligible merely for non-use.

### PB-CANNABIS-003 — Frequency is approximate self-description

OCCASIONAL_USER, REGULAR_USER, and FREQUENT_USER are intentionally broad self-described compatibility bands.

They must not be interpreted as exact consumption quantity, intoxication frequency, dependence severity, or medical evidence.

### PB-CANNABIS-004 — PREFER_NOT_TO_SAY is supported

Users may decline to disclose personal cannabis use frequency/status.

Declining disclosure must not become a public negative signal or automatic safety/reputation penalty.

### PB-CANNABIS-005 — Method vocabulary is multi-select and optional

Where later profile design supports it, method preferences may include:

- SMOKE;
- VAPE;
- EDIBLE;
- BEVERAGE;
- CONCENTRATE;
- TOPICAL;
- CAPSULE_OR_OIL;
- OTHER;
- NONE;
- PREFER_NOT_TO_SAY.

The taxonomy does not claim that every method is legal, available, medically appropriate, or safe in every jurisdiction.

### PB-CANNABIS-006 — No method implies consent

Declaring a preferred consumption method does not authorize another person to offer, provide, pressure, purchase, sell, or administer cannabis.

### PB-CANNABIS-007 — Social-context vocabulary

Private compatibility preferences may distinguish contexts such as:

- SOLO;
- SOCIAL;
- PARTNER_ONLY;
- EVENTS;
- HOME_ONLY;
- OUTDOORS;
- FLEXIBLE;
- PREFER_NOT_TO_SAY.

These describe preferred social context, not permission for another user to initiate consumption.

### PB-CANNABIS-008 — Environment-boundary vocabulary

Users may express boundaries such as:

- SMOKE_FREE_HOME;
- NO_INDOOR_SMOKING;
- OUTDOOR_ONLY;
- NO_USE_AROUND_CHILDREN;
- NO_USE_AROUND_PETS;
- NO_USE_BEFORE_DRIVING;
- SCENT_SENSITIVE;
- FLEXIBLE;
- CUSTOM_PRIVATE_BOUNDARY.

These are user boundaries, not legal or medical determinations.

### PB-CANNABIS-009 — Partner-compatibility vocabulary

Users may privately express compatibility preferences such as:

- OK_WITH_NON_USER;
- OK_WITH_OCCASIONAL_USE;
- OK_WITH_REGULAR_USE;
- OK_WITH_FREQUENT_USE;
- PREFER_SIMILAR_USE;
- PREFER_NO_USE;
- NO_PREFERENCE.

These preferences remain subject to anti-harassment, visibility, privacy, and matching rules.

### PB-CANNABIS-010 — Cannabis interest vocabulary is distinct from use

Users may express interest in cannabis culture, education, cultivation topics, policy discussion, strain/product knowledge, or social activities without declaring current consumption.

Interest must not be treated as proof of use.

### PB-CANNABIS-011 — Cultivation interest is not production authority

A cultivation-interest field may describe a lawful hobby/topic preference where later product policy allows it.

It must not certify legal cultivation authority, licensing, product quality, or commercial availability.

### PB-CANNABIS-012 — Knowledge/enthusiasm is not expertise credential

Labels such as CURIOUS, CASUAL, ENTHUSIAST, or KNOWLEDGEABLE may be used only as self-described interest levels if later adopted.

They must not imply professional, medical, legal, laboratory, budtender, or safety expertise.

## Privacy and identity boundaries

### PB-CANNABIS-013 — Cannabis fields are private by default

Cannabis fields are private PuffBuddies state. Cannabis-use status, methods, frequency, contexts, preferences, and boundaries are private by default.

They must not be written to public chain state by default.

### PB-CANNABIS-014 — Wallet ownership must not reveal cannabis identity

A wallet address, signature, balance, token holding, transaction history, or connected-account state must not by itself reveal or infer a PuffBuddies cannabis profile.

### PB-CANNABIS-015 — 420Identity must not become a public cannabis registry

PuffBuddies must not require users to publish cannabis-use status or preferences as a public 420Identity credential merely to participate.

### PB-CANNABIS-016 — 420Names must not encode cannabis profile state

A .420 name or name record must not be used as a canonical public encoding of PuffBuddies cannabis-use status, methods, frequency, or compatibility preferences.

### PB-CANNABIS-017 — Registry/AppStore/Search/Explorer must not enumerate cannabis profiles

420Registry, 420AppStore, 420Search, and 420Explorer must not become public membership or cannabis-preference indexes for PuffBuddies users.

### PB-CANNABIS-018 — Analytics cannot become a shadow cannabis registry

Analytics may use approved privacy-safe aggregates, but user-level cannabis profile state must not be exported into a durable cross-service identity or ranking dataset.

### PB-CANNABIS-019 — Deterministic hashes do not make cannabis identity public-safe

Hashing a cannabis profile, preference, or combination of fields does not automatically make it appropriate for public chain, public indexing, or external analytics.

### PB-CANNABIS-020 — Cannabis fields follow deletion and lifecycle rules

Cannabis profile/preference data follows PB-0.11 deletion/retention semantics and PB-0.12 lifecycle visibility/participation rules.

## Matching and consent boundaries

### PB-CANNABIS-021 — Cannabis compatibility may influence ranking only as private user preference

Cannabis fields may be used as private matching inputs under PB-0.13 when current, purpose-limited, and user-declared.

### PB-CANNABIS-022 — Cannabis compatibility is not a hard universal desirability score

No cannabis-use state or interest level is universally "better" or "worse."

Compatibility is pair/context-specific and must not become a public ranking or social-credit score.

### PB-CANNABIS-023 — Non-use must remain matchable

Users who select NON_USER or PREFER_NOT_TO_SAY must remain eligible for discovery/matching subject to their own and others' explicit compatibility preferences.

### PB-CANNABIS-024 — Cannabis fields cannot override hard exclusions

Cannabis compatibility must never bypass block, safety, lifecycle, eligibility, visibility, deletion, or consent restrictions.

### PB-CANNABIS-025 — Cannabis similarity does not create consent

Shared use status, method, strain interest, lifestyle, or compatibility score does not create a like, match, messaging permission, or consent to consume together.

### PB-CANNABIS-026 — Cannabis mismatch does not justify harassment

A preference mismatch may affect discovery/ranking where allowed but must not expose private incompatibility details in a way that enables ridicule, coercion, discrimination, or retaliation.

### PB-CANNABIS-027 — Consumption boundaries outrank compatibility

A user's explicit boundary against consuming, smoking indoors, use around children/pets, impaired driving, or another stated boundary must not be overridden by recommendation, premium features, or another user's preferences.

### PB-CANNABIS-028 — Recommendation systems must not infer hidden substance-use traits by default

Later matching systems must prefer explicit user-declared cannabis compatibility fields over hidden inference from purchases, wallet activity, browsing, location, messages, or unrelated behavioral data.

## Economic and tokenization boundaries

### PB-CANNABIS-029 — Token holdings do not prove cannabis use

Holding $420 or any token/NFT does not prove cannabis use, frequency, preference, knowledge, legality, or PuffBuddies cannabis identity.

### PB-CANNABIS-030 — Cannabis identity must not be tokenized

PuffBuddies must not require or issue transferable tokens/NFTs whose ownership is the canonical proof of a user's private cannabis-use status or dating compatibility.

### PB-CANNABIS-031 — Payment cannot alter another user's cannabis boundaries

Premium purchase, payment, staking, token balance, boosts, or sponsorship must not bypass another user's cannabis preferences, boundaries, visibility, block, or consent.

### PB-CANNABIS-032 — Cannabis compatibility must not become a marketplace entitlement

A match, profile field, compatibility score, or cannabis interest must not be treated as authorization to buy, sell, deliver, exchange, or broker cannabis through PuffBuddies.

## Safety, legality, and health boundaries

### PB-CANNABIS-033 — Cannabis compatibility is not legal advice

The taxonomy does not determine whether possession, cultivation, purchase, transport, gifting, consumption, or other conduct is legal in a user's jurisdiction.

### PB-CANNABIS-034 — Cannabis compatibility is not medical advice

Cannabis fields must not be interpreted as diagnosis, treatment, prescription, medical need, dosage guidance, contraindication, or evidence of a health condition.

### PB-CANNABIS-035 — Cannabis compatibility is not impairment evidence

Use status/frequency alone must not be treated as proof that a user is currently impaired, unsafe to drive, unsafe to work, or incapable of consent.

### PB-CANNABIS-036 — Coercion is prohibited

No taxonomy field may be used to pressure a user to consume more, consume differently, start consuming, stop consuming, or violate an expressed boundary.

### PB-CANNABIS-037 — Unauthorized commerce is out of scope

Cannabis compatibility vocabulary must not become coded marketplace metadata for illegal or unauthorized cannabis sales, delivery, brokering, or solicitation.

### PB-CANNABIS-038 — Minor-oriented cannabis matching is prohibited

PB-0.14 does not weaken PB-0.6 adult eligibility.

Cannabis-related matching/preferences are available only within the adult PuffBuddies product boundary.

### PB-CANNABIS-039 — Safety reporting may reference cannabis context without public identity

Reports may include cannabis-related coercion or unsafe conduct under PB-0.10, but moderation evidence remains private and must not become public cannabis reputation state.

### PB-CANNABIS-040 — Taxonomy extensions require bounded review

Before later implementation adds a cannabis taxonomy field, it must define the field's purpose, privacy classification, whether it describes use/interest/boundary/context, matching use, disclosure rules, retention/deletion behavior, legal/health ambiguity, and whether the field risks becoming public or tokenized identity.

## Taxonomy field decision rule

Any new cannabis-related field must document:

1. canonical field name;
2. user-facing meaning;
3. whether it is use, interest, method, context, preference, or boundary;
4. whether it is single-select, multi-select, optional, or free-form;
5. privacy classification;
6. visibility/disclosure rules;
7. matching/ranking purpose;
8. prohibited inferences;
9. retention/deletion behavior;
10. safety/legal/health caveats;
11. whether economic/token state can influence it;
12. whether it can be represented publicly.

If the public representation would reveal or strongly infer private PuffBuddies cannabis identity, the public representation is prohibited by default.

## PB-0.14 completion boundary

PB-0.14 is satisfied when the repository:

- records PB-CANNABIS-001 through PB-CANNABIS-040 exactly once and in sequence;
- defines canonical private vocabulary for use status, frequency, methods, social context, environment boundaries, partner compatibility, interests, and optional knowledge/enthusiasm;
- treats NON_USER and PREFER_NOT_TO_SAY as valid first-class states;
- preserves cannabis compatibility as private user-declared data rather than public/tokenized identity;
- explicitly prevents Wallet, Identity, Names, Registry, AppStore, Search, Explorer, Analytics, tokens, NFTs, payments, or staking from becoming cannabis identity authority;
- preserves PB-0.13 matching constraints, PB-0.5 consent, PB-0.10 safety, PB-0.11 deletion, and PB-0.12 lifecycle boundaries;
- prohibits medical/legal/impairment conclusions, coercion, and unauthorized marketplace use;
- defines a bounded taxonomy-extension decision rule;
- introduces no profile implementation, database, matching engine, token/NFT credential, public registry, API, contract, address, service ID, deployment, or false live-taxonomy claim.
