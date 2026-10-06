# PuffBuddies PB-0.2 MVP scope

## Purpose

PB-0.2 freezes the minimum viable product boundary for the first PuffBuddies release track.

This document defines **what capabilities belong in the MVP** and **what capabilities are intentionally deferred**. It does not define the detailed architecture, privacy implementation, authority model, storage model, API design, matching algorithm, moderation implementation, payment mechanics, deployment configuration, or testnet/mainnet release evidence for those capabilities. Those details remain owned by later canonical roadmap steps.

## MVP product objective

The PuffBuddies MVP must support a complete, consent-based adult discovery journey from eligible account entry through profile creation, discovery, mutual matching, private communication, safety controls, and account exit.

The MVP is considered functionally whole only when an eligible adult can:

```text
enter PuffBuddies
  -> establish application eligibility
  -> create and manage a dating/social profile
  -> choose Dating / Buddy / Both
  -> discover compatible eligible profiles
  -> like or pass
  -> form a mutual match
  -> privately communicate with that match
  -> receive appropriate service notifications
  -> unmatch, block, or report
  -> pause/deactivate or delete the PuffBuddies profile
```

This flow defines product scope only. It does not claim any of these later features are implemented today.

## Canonical MVP capabilities

### PB-MVP-001 — Eligibility-gated entry

The MVP must prevent ordinary PuffBuddies participation until the user satisfies the canonical PuffBuddies eligibility policy defined by later roadmap work.

PB-0.2 does not define the exact age-proof, identity, attestation, or jurisdiction mechanism.

### PB-MVP-002 — Profile creation and editing

The MVP must allow an eligible user to create, review, edit, and save a PuffBuddies profile.

The MVP profile must be capable of representing, at minimum:

- display identity suitable for discovery;
- Dating / Buddy / Both intent;
- profile text/prompts;
- profile media/photos;
- discovery preferences needed for compatibility;
- cannabis compatibility information;
- approximate discovery/location preferences;
- account/profile visibility state.

The exact field taxonomy belongs to later profile, cannabis-taxonomy, and visibility roadmap steps.

### PB-MVP-003 — Profile media

The MVP must support profile photos or equivalent profile media sufficient for ordinary dating/social-discovery use.

Upload, moderation, storage, transformation, authorization, retention, and deletion mechanics are deferred to later implementation and safety/privacy steps.

### PB-MVP-004 — Discovery

The MVP must provide a way for eligible users to discover other eligible, mutually compatible, non-blocked, discoverable profiles.

The MVP must support practical discovery filtering sufficient for an adult dating/social-discovery product, including at least intent/mode, age-compatible policy, distance/area compatibility, and relationship/lifestyle compatibility where canonical policy permits.

The exact ranking algorithm and location-privacy mechanism are not defined by PB-0.2.

### PB-MVP-005 — Like and pass

The MVP must support explicit user actions to like or pass on a discoverable profile.

These actions must not themselves create messaging access.

### PB-MVP-006 — Mutual matching

The MVP must support creation of a match only when the later canonical matching/consent rules are satisfied.

At minimum, the product scope assumes independent reciprocal interest before ordinary private matched-user communication.

PB-0.2 does not define the persistence model or matching algorithm.

### PB-MVP-007 — Private matched-user messaging

The MVP must provide private one-to-one communication for users whose relationship is authorized by the canonical matching/consent model.

PuffBuddies should reuse the canonical 420Integrated messaging capability when later integration work establishes that boundary rather than silently creating an incompatible second messaging authority.

### PB-MVP-008 — Notifications

The MVP must provide practical notifications for events necessary to use the product, including at minimum relevant match, message, account, safety, and service-state events.

The exact delivery providers and privacy presentation rules are defined later.

### PB-MVP-009 — Unmatch

Either participant must be able to end an active PuffBuddies match.

The later consent, messaging, and safety steps define the exact resulting authorization and conversation behavior.

### PB-MVP-010 — Block

The MVP must provide blocking as a first-class safety capability.

A user must be able to prevent an unwanted account from continuing ordinary PuffBuddies interaction with them. Exact block supremacy semantics are defined by PB-0.5 and later implementation steps.

### PB-MVP-011 — Report

The MVP must allow users to report profiles, interactions, or conduct through a safety/moderation path.

Exact report categories, evidence handling, moderator authority, appeals, and retention rules are defined later.

### PB-MVP-012 — Account and profile controls

The MVP must provide settings sufficient to manage PuffBuddies participation, including profile visibility and account/session preferences appropriate to the eventual client.

### PB-MVP-013 — Pause/deactivate

The MVP must allow the user to stop normal discovery/participation without requiring deletion of unrelated 420Integrated identity or wallet state.

Detailed lifecycle semantics are defined later.

### PB-MVP-014 — Delete PuffBuddies profile

The MVP must provide a user-facing deletion path for PuffBuddies application data subject to later canonical retention, safety, legal, and immutable-chain limitations.

Deletion of a PuffBuddies profile must not be defined as deletion of 420Identity or the user's wallet.

### PB-MVP-015 — Core safety is not premium

The MVP scope treats blocking, reporting, unmatching, account deactivation/deletion, eligibility enforcement, and core matched-user messaging as baseline product capabilities rather than paid overrides.

This does not prohibit later premium features; it prohibits defining safety or consent bypass as a premium feature.

## MVP release surfaces

The canonical MVP requires a usable **web application** as the first complete user-facing client.

Native iOS and Android applications are post-MVP release surfaces unless a later canonical roadmap decision explicitly promotes them before MVP closeout.

The web MVP must eventually provide the complete core flow required by PB-MVP-001 through PB-MVP-015. PB-0.2 does not claim the web client exists yet.

## Explicit post-MVP deferrals

The following capabilities are intentionally **outside the initial MVP boundary** unless a later canonical roadmap change explicitly promotes them:

### Rich media and synchronous communication

- video profiles;
- voice introductions;
- voice calling;
- live video calling;
- live streaming;
- ephemeral stories.

### Group and event experiences

- group dating;
- group chats outside canonical matched-user requirements;
- PuffBuddies-hosted events;
- event ticketing;
- speed dating;
- community rooms or public social feeds.

### Advanced matchmaking

- AI-generated match recommendations;
- personality or psychometric compatibility scoring;
- automated relationship coaching;
- opaque desirability scores;
- public dating reputation scores.

### Growth and visibility products

- boosts;
- priority placement;
- super-like or equivalent paid attention signals;
- travel mode;
- passport/location spoofing products;
- referral/reward campaigns;
- influencer/promoter systems.

These features are not categorically forbidden, but later work must preserve consent, privacy, block supremacy, and no-purchased-access invariants.

### Premium and monetization products

- subscriptions;
- paid advanced filters;
- liked-you views;
- incognito/premium visibility controls;
- profile customization purchases;
- paid undo/rewind;
- token-gated cosmetic features.

Payments and premium entitlements remain PB-10 scope.

### Advanced verification and reputation

- photo/liveness verification;
- advanced identity badges;
- optional reputation credentials;
- cross-app reputation aggregation;
- portable dating credentials.

Basic eligibility remains MVP; richer verification/reputation remains later scope.

### Native applications

- iOS application;
- Android application;
- platform-specific push/biometric/camera integrations beyond what is necessary for the web MVP.

Native applications remain PB-12 scope unless explicitly promoted.

### Social/community expansion

- public activity feeds;
- public follower graphs;
- public relationship status;
- public cannabis-use badges;
- public match histories;
- social graph export.

Several of these are also constrained or prohibited by PB-0.1 privacy/product-identity boundaries.

## MVP exclusions

The following are **not merely deferred**; they are incompatible with the canonical MVP/product identity unless a future explicit canonical change revises the governing invariants:

- buying or forcing a match;
- paying to bypass a block;
- paying to send unsolicited private messages to unmatched users;
- exposing precise user location as a public discovery primitive;
- public wallet-address-to-PuffBuddies-profile enumeration;
- public on-chain likes, passes, or match graph by default;
- dating desirability ranking based on wallet balance, token holdings, staking balance, or spending;
- public registries of sexual/romantic preference or cannabis consumption;
- administrator-manufactured mutual consent.

## Scope invariants

### PB-SCOPE-001 — Complete core journey

The MVP boundary must cover eligibility, profile, discovery, like/pass, mutual match, private communication, safety actions, and account exit.

### PB-SCOPE-002 — Safety is launch-critical

Block, report, unmatch, deactivation, and deletion are MVP requirements, not post-launch cleanup work.

### PB-SCOPE-003 — Messaging follows consent

The MVP scope does not include unsolicited ordinary private messaging to unmatched users.

### PB-SCOPE-004 — Premium cannot complete missing safety

A paid tier may extend convenience or discovery tools later, but the initial free/core product scope must remain capable of ordinary matching, matched-user communication, blocking, reporting, unmatching, deactivation, and deletion.

### PB-SCOPE-005 — Web-first MVP

The first complete user-facing MVP release surface is the web application. Native mobile clients are post-MVP unless explicitly promoted by canonical roadmap change.

### PB-SCOPE-006 — No implied implementation

Listing a capability in MVP scope does not mean it is implemented, deployed, integrated, tested, or release-ready.

### PB-SCOPE-007 — Deferral is explicit

Features listed under explicit post-MVP deferrals must not become release blockers for the MVP unless a later canonical roadmap change promotes them.

### PB-SCOPE-008 — Later steps own mechanics

PB-0.2 defines capability boundaries only. Detailed authority, privacy, lifecycle, matching, safety, integration, API, storage, deployment, and qualification semantics remain owned by their later roadmap steps.

## PB-0.2 completion boundary

PB-0.2 is satisfied when the repository contains one canonical MVP scope that:

- covers the complete core user journey;
- distinguishes MVP requirements from post-MVP features;
- distinguishes deferred features from prohibited/incompatible behavior;
- preserves PB-0.1 product identity and consent boundaries;
- defines a web-first MVP without falsely claiming a client already exists;
- records PB-MVP-001 through PB-MVP-015;
- records PB-SCOPE-001 through PB-SCOPE-008;
- can be mechanically verified without requiring runtime code;
- introduces no contracts, service IDs, addresses, deployments, or fake integration claims.
