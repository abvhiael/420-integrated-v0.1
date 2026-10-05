# PuffBuddies PB-0.3 blockchain/off-chain boundary

## Purpose

PB-0.3 defines the canonical data and authority boundary between public blockchain state, private/off-chain PuffBuddies state, encrypted messaging state, and narrowly-scoped attestations or commitments.

This step does **not** create contracts, assign addresses, invent service identifiers, define deployment topology, implement storage, or claim live integrations. It defines what later implementations are allowed to place on public chain state and what they must keep private.

The governing rule is:

> Public-chain persistence is used only when PuffBuddies needs durable public authority, verification, settlement, or registry semantics. Sensitive dating, relationship, preference, location, safety, and communication state remains private/off-chain or encrypted unless a later canonical roadmap change explicitly proves a privacy-preserving reason otherwise.

## Trust zones

PuffBuddies uses four conceptual trust zones.

### Zone A — Public-chain authority

Public blockchain state may contain only information whose public persistence is both intentional and necessary for protocol-level authority, verification, settlement, or canonical registration.

Permitted categories may include:

- canonical PuffBuddies application registration or service metadata once later registry work defines it;
- cryptographic account/session authorization references where no sensitive dating metadata is exposed;
- eligibility or verification attestations that reveal only the minimum conclusion needed by PuffBuddies;
- entitlement or subscription state where later payment design requires public settlement;
- payment settlement records that do not encode dating preferences, matches, blocks, or private profile state;
- governance/configuration parameters appropriate for public protocol operation;
- approved verification credential identifiers or commitments that do not reveal underlying private evidence;
- hash commitments or integrity anchors only when later architecture demonstrates a concrete verification need and the commitment itself does not create a practical privacy leak.

PB-0.3 does not assert that every permitted category will ultimately be on-chain. "May use public-chain authority" means permitted in principle, subject to later minimum-disclosure and architecture review.

### Zone B — Private PuffBuddies application state

The following state must remain off public chain and under private application/storage controls:

- profile biography and prompts;
- profile photos/media;
- relationship intentions;
- gender and pronoun fields;
- sexual or romantic orientation;
- discovery preferences;
- age range preferences;
- cannabis-use and compatibility preferences;
- alcohol, tobacco, pet, family, lifestyle, and other compatibility preferences;
- likes;
- passes;
- mutual match graph;
- unmatches;
- blocks;
- reports and moderation case content;
- moderation evidence;
- moderation notes;
- exact or precise location;
- device identifiers;
- session metadata;
- abuse-prevention signals;
- recommendation/ranking state;
- profile visibility settings;
- hidden/private profile fields;
- account recovery information;
- deleted or deactivated profile tombstone data required only for safety/retention policy.

These categories may be stored in encrypted databases or similarly protected application services as defined by later roadmap work.

### Zone C — Encrypted communication state

Private user-to-user communication belongs in an encrypted communication system rather than public blockchain state.

This includes:

- message bodies;
- attachments;
- message reactions;
- typing/presence signals;
- delivery/read state where privacy requires it;
- conversation membership metadata where public exposure would reveal a match or relationship graph;
- cryptographic session material and keys;
- message abuse reports or evidence copies.

The later 420Messenger integration step owns the exact implementation and authorization semantics.

### Zone D — Minimal-disclosure attestations and commitments

Some later features may require a verifiable fact without revealing the underlying private data.

Examples include:

- "eligible for PuffBuddies" rather than date of birth;
- "photo verified" rather than the source verification image;
- "account in good standing" rather than moderation history;
- entitlement-active proof rather than a private billing profile;
- jurisdiction/policy eligibility conclusion rather than a full address;
- cryptographic commitment to a private record where later protocol design requires proof of integrity.

Attestations must disclose the minimum useful conclusion. The underlying sensitive evidence must not be placed on public chain solely because an attestation is needed.

## Canonical state classification

### PB-BOUNDARY-001 — Public application identity is allowed

Canonical app identity, registry metadata, and public protocol configuration may use public-chain authority when later integration work establishes a concrete canonical need.

### PB-BOUNDARY-002 — Eligibility uses minimum disclosure

PuffBuddies may consume a public or verifiable eligibility conclusion, but date of birth, government identity evidence, precise residence, or equivalent underlying personal records must not become public PuffBuddies chain state.

### PB-BOUNDARY-003 — Profiles are not public-chain records

Dating/social profiles, profile media, biographies, prompts, preferences, and profile visibility state must remain private/off-chain.

### PB-BOUNDARY-004 — Likes and passes are private

Likes and passes must not be written to public chain state.

### PB-BOUNDARY-005 — Match graph is private

Mutual matches, unmatches, and relationship history must not be publicly reconstructable from PuffBuddies chain state.

### PB-BOUNDARY-006 — Blocks are private

Block relationships must not be public blockchain records or publicly queryable social-graph edges.

### PB-BOUNDARY-007 — Reports and moderation are private

Reports, report reasons, evidence, moderation notes, sanctions rationale, and appeal content must not be written to public chain state.

A later architecture may expose a minimal account-state conclusion such as "suspended" if required for authorization, but must not expose the private case history.

### PB-BOUNDARY-008 — Precise location is private

Precise coordinates, exact address, raw GPS history, and equivalent location telemetry must never be public PuffBuddies chain state.

### PB-BOUNDARY-009 — Messaging content is never public chain data

Private message content, attachments, encryption keys, and conversation-level metadata that would reveal private social relationships must not be written to public chain state.

### PB-BOUNDARY-010 — Preferences remain private

Sexual, romantic, gender, cannabis, lifestyle, family, age-range, and similar discovery preferences must remain private/off-chain.

### PB-BOUNDARY-011 — Wallet identity must not reveal dating membership

A public 420 wallet address or 420Name must not, by itself, provide a canonical public mechanism to enumerate or discover the holder's PuffBuddies profile.

### PB-BOUNDARY-012 — Payments cannot encode private dating state

Public payment/entitlement records, if later used, must not encode who a user liked, matched, blocked, reported, messaged, or privately filtered for.

### PB-BOUNDARY-013 — Verification evidence stays private

Underlying identity, liveness, photo-verification, safety-review, or eligibility evidence remains private even where a minimal verification attestation is public or verifiable.

### PB-BOUNDARY-014 — Hashing does not automatically make sensitive state safe

Sensitive dating state must not be placed on-chain merely as a raw or deterministic hash if that hash can be dictionary-attacked, correlated, or used to confirm private facts.

Commitments are allowed only when later architecture establishes adequate entropy, privacy properties, purpose, and necessity.

### PB-BOUNDARY-015 — Public events must not leak private graph edges

Contract events, logs, registry records, payment memos, token metadata, or indexable public fields must not reveal likes, matches, blocks, reports, precise location, private preferences, or message relationships.

### PB-BOUNDARY-016 — Private deletion must remain possible

Data that PuffBuddies promises can be deleted or deactivated must not be unnecessarily placed on immutable public chain state.

Where public protocol records are unavoidable, later deletion/lifecycle documentation must state the immutable limitation explicitly.

### PB-BOUNDARY-017 — Public-chain use requires a concrete authority purpose

No field may be placed on public chain solely for "blockchain completeness," marketing, convenience, analytics, or because a chain exists.

### PB-BOUNDARY-018 — Off-chain does not mean unauthenticated

Private/off-chain state may still require signatures, capability checks, authorization, encryption, audit logging, or integrity proofs. PB-0.3 classifies visibility/persistence, not security strength.

## State matrix

| State class | Public chain | Private/off-chain | Encrypted communication | Attestation/commitment allowed |
| --- | --- | --- | --- | --- |
| canonical app registration | permitted later | optional cache | no | yes |
| wallet authorization reference | permitted if minimum disclosure | yes | no | yes |
| adult/application eligibility conclusion | permitted if minimum disclosure | yes | no | yes |
| date of birth / identity evidence | no | yes | no | derived conclusion only |
| profile text/prompts | no | yes | no | no by default |
| profile photos/media | no | yes | no | verification commitment only if justified |
| relationship intentions/preferences | no | yes | no | no by default |
| cannabis preferences | no | yes | no | no by default |
| likes/passes | no | yes | no | no |
| matches/unmatches | no | yes | possibly conversation authorization | no public graph commitment |
| blocks | no | yes | revocation signal where needed | no public relationship edge |
| reports/moderation evidence | no | yes | possible encrypted evidence transport | minimal account-state conclusion only if required |
| precise location | no | yes | no | coarse eligibility conclusion only if justified |
| private messages/attachments | no | no as plaintext durable authority | yes | no |
| subscription entitlement | permitted later if needed | yes | no | yes |
| payment settlement | permitted later | private billing details off-chain | no | yes |
| governance/public configuration | permitted later | caches allowed | no | yes |
| aggregate analytics | no user-level private facts | yes | no | only privacy-safe aggregates/commitments |

## Public-chain leakage prohibitions

Later PuffBuddies contracts, registries, events, calldata, metadata, or payment payloads must not create a public side-channel that reconstructs private state.

Examples of prohibited leakage include:

- emitting `Liked(userA,userB)`;
- emitting `Matched(userA,userB)`;
- putting a target account in a public "block" transaction event;
- encoding discovery filters in calldata;
- using deterministic public IDs derived from private preference combinations;
- publishing exact geohashes or location cells small enough to identify a user;
- storing message conversation IDs whose participants can be publicly resolved;
- using payment memo fields to identify a match, profile, report, or private feature target;
- publishing moderation-case identifiers that can be linked to a user and allegation.

## Wallet and identity separation

The canonical 420Integrated wallet/identity layer may authenticate a PuffBuddies user without making PuffBuddies membership public.

Later implementation should prefer private session/account mappings, unlinkable or minimally-linkable application identifiers, or other approved privacy-preserving techniques where practical.

PB-0.3 does not choose the exact mechanism. It establishes the requirement that wallet control and public dating membership are distinct concepts.

## Indexer, Explorer, Search, and analytics boundary

Public-chain Indexer, Explorer, Search, and analytics services must not be treated as stores for private PuffBuddies profile or relationship data.

If PuffBuddies later publishes public protocol records:

- Explorer may expose only legitimately public protocol/config/payment/attestation state;
- Search must not enumerate private PuffBuddies profiles from wallet addresses;
- Indexer projections must not infer or manufacture private match/like/block graphs;
- analytics must operate on privacy-safe aggregate or application-side data rather than publicizing user-level dating behavior.

Exact integration behavior remains PB-0.8/PB-13 and later implementation scope.

## Security consequences

This boundary means later implementations must explicitly defend against:

- on-chain correlation attacks;
- wallet/profile linkage;
- relationship-graph reconstruction;
- deterministic-hash confirmation attacks;
- location triangulation;
- event/log metadata leakage;
- calldata leakage;
- payment-metadata leakage;
- public moderation-state overexposure;
- analytics re-identification;
- backups or logs reintroducing data that the chain boundary intentionally kept private.

Detailed threat modeling remains PB-0.7 and later security phases.

## PB-0.3 completion boundary

PB-0.3 is satisfied when the repository:

- defines public-chain, private/off-chain, encrypted communication, and minimal-disclosure attestation zones;
- classifies canonical MVP data types;
- explicitly keeps likes, passes, matches, blocks, reports, precise location, preferences, profile content/media, and messages off public chain;
- permits only minimal eligibility/verification/entitlement conclusions where later architecture justifies them;
- prohibits public side-channel leakage through events, calldata, metadata, hashes, payments, Indexer, Search, Explorer, or analytics;
- preserves wallet-to-profile unlinkability as a canonical boundary;
- records PB-BOUNDARY-001 through PB-BOUNDARY-018 exactly once and in sequence;
- makes clear that off-chain state still requires authentication, authorization, encryption, and integrity protection;
- introduces no PuffBuddies contract, address, service ID, deployment, or false live-integration claim.
