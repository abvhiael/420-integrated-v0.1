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

### PB-0.2 — MVP scope

Define the canonical first-release feature boundary and explicit post-MVP deferrals.

### PB-0.3 — Blockchain/off-chain boundary

Define which PuffBuddies state may use public chain authority and which state must remain private/off-chain/encrypted.

### PB-0.4 — Privacy invariants

Define stable privacy invariants for eligibility, location, likes, matches, messages, preferences, wallet correlation, deletion, and minimal disclosure.

### PB-0.5 — Consent invariants

Define mutual-consent, block-supremacy, unmatch, and no-purchased-access invariants.

### PB-0.6 — Adult eligibility policy

Define the exact eligibility interface and its dependency on canonical identity/attestation authority.

### PB-0.7 — Threat/trust model

Define actors, trust boundaries, abuse cases, and authority owners.

### PB-0.8 — Ecosystem dependencies

Define the exact narrow roles of 420Wallet, 420Identity, 420Names, 420Messenger, 420Notifications, 420Pay, 420Registry, 420AppStore, analytics, and any other approved dependency.

### PB-0.9 — State ownership

Define the canonical owner for every PuffBuddies state class.

### PB-0.10 — Safety/moderation principles

Define report classes, moderation states, safety invariants, and escalation boundaries.

### PB-0.11 — Data lifecycle/deletion

Define deactivate/delete semantics, retention boundaries, backups, moderation evidence, and irreversible public-chain limitations.

### PB-0.12 — User lifecycle

Define canonical PuffBuddies account/application lifecycle states and transitions.

### PB-0.13 — Matching principles

Define allowed matching inputs, hard exclusions, ranking constraints, and prohibited economic influence.

### PB-0.14 — Cannabis taxonomy

Define canonical cannabis-compatibility vocabulary without turning those fields into public/tokenized identity.

### PB-0.15 — Visibility model

Define private, discoverable, matched, moderator-only, and other field audiences.

### PB-0.16 — Non-goals reconciliation

Reconcile the complete PB-0 non-goal set against accumulated architecture.

### PB-0.17 — Repository structure

Freeze the intended PuffBuddies repository layout before implementation expands.

### PB-0.18 — Documentation/invariant tests

Extend machine-verifiable PB-0 documentation and invariant qualification.

### PB-0.19 — Master implementation roadmap

Reconcile PB-1 through launch against the complete PB-0 architecture.

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
