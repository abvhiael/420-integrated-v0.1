# 420GP-17 — Developer Portal / Game Onboarding

## Status

GP-17 is ACTIVE.

The Developer Hub prerequisite is satisfied: DEVHUB-0 through DEVHUB-19 are complete. GP-17 therefore extends the permanent Developer Hub rather than creating a separate gaming portal.

## Objective

Provide a safe, deterministic path for external game developers to onboard a game into the 420 Gaming Protocol while preserving the architecture proven through GP-16:

- core gameplay remains wallet-free;
- access progresses deliberately from guest -> registered -> wallet-linked;
- wallet-linked capabilities remain optional;
- every game uses a canonical `420/GAMING/GAME/<NAME>/V1` namespace;
- game/application publication reuses Developer Hub registration and AppStore workflows;
- Developer Hub remains noncanonical and cannot self-authorize Registry, Wallet, governance, finality or gaming authority;
- cross-game reads remain explicitly scoped and never become wallet-wide activity enumeration.

## Roadmap

### GP-17.1 — Game onboarding manifest & preflight

Status: COMPLETE — merged through PR #253.

### GP-17.2 — Game registration profile & protocol capability declaration

Status: COMPLETE — merged through PR #254.

### GP-17.3 — SDK integration generator

Status: COMPLETE — merged through PR #255.

### GP-17.4 — Progressive-access policy qualification

Status: COMPLETE — merged through PR #257.

Provides a reusable Developer Hub qualification gate for feature-level access policy. It proves guest-accessible core gameplay, registered wallet-free continuity, optional wallet-linked capabilities, no wallet-required core progression and no wallet-linked pay-to-win advantage.

### GP-17.5 — Entitlement, claim & attestation onboarding

Status: IN QUALIFICATION.

Guides and qualifies high-risk Gaming Protocol integrations for entitlements, claims and cross-game attestations. High-risk reads must use finalized canonical state, reorg and RPC failure must fail closed, all authority remains game-scoped, and cross-game attestation scope must be explicit rather than wallet-wide.

### GP-17.6 — Migration & wallet-link onboarding

Qualify guest-to-account and account-to-wallet migration plans, replay/idempotency behavior and deliberate wallet-link consent boundaries.

### GP-17.7 — SmartAccount / CapabilityRegistry onboarding

Generate and validate the game-scoped authority plan. SmartAccount420 and CapabilityRegistry420 remain the sole product authority/session boundary; Developer Hub does not mint authority itself.

### GP-17.8 — Local/devnet onboarding rehearsal

Run the generated integration against Developer Hub local/devnet tooling with deterministic fixtures before any testnet handoff.

### GP-17.9 — Testnet onboarding qualification

Produce an evidence package for real testnet onboarding. This phase may prepare and validate evidence but must not claim live qualification without actual deployed-network results.

### GP-17.10 — Developer UX, documentation & closeout

Complete portal/dashboard surfaces, task-oriented game onboarding documentation, troubleshooting, examples, exact-head qualification and GP-17 closeout.

## Implemented surfaces

### GP-17.1

`developer-hub/src/gaming-onboarding.mjs` validates canonical game identity, deliberate progressive access, wallet-free core play, optional wallet-linked features, declared protocol surfaces, application identity binding and shared publication preflight.

### GP-17.2

`developer-hub/src/gaming-registration-profile.mjs` validates exact game/application binding, one declaration per protocol, `game` scope, fixed action catalogues, fail-closed wildcard/global/wallet-wide rejection and GP-16 compatibility while creating no canonical grant.

### GP-17.3

`developer-hub/src/gaming-sdk-generator.mjs` generates deterministic configuration and starter SDK material pinned to the canonical game ID and the declared protocol/action subset.

### GP-17.4

`developer-hub/src/gaming-progressive-access-qualification.mjs` qualifies feature-level progression policy. It requires at least one guest-accessible core progression feature, preserves wallet-free core progression for registered players, keeps wallet-linked features optional, rejects wallet-required core progression and rejects wallet-linked competitive advantage/pay-to-win behavior.

Qualification lives in `developer-hub/test/gaming-progressive-access-qualification.test.mjs`. The qualification result is noncanonical and changes no Registry, Wallet, CapabilityRegistry or chain authority.

### GP-17.5

`developer-hub/src/gaming-high-risk-onboarding.mjs` qualifies entitlement, claim and attestation integration plans before any canonical handoff.

It requires:

- exact binding to the onboarding game ID;
- high-risk integration scope exactly `game`;
- finalized canonical state under the GP-16 finality model;
- reorg handling to fail closed;
- RPC failure handling to fail closed;
- canonical RPC revalidation for high-risk state;
- no wallet-wide enumeration;
- explicit cross-game scope for attestations;
- declared GP-17.1 protocols for every requested high-risk integration.

Qualification lives in `developer-hub/test/gaming-high-risk-onboarding.test.mjs`. Developer Hub only produces a noncanonical preflight result; it cannot establish ownership, entitlement, claim validity, attestation validity or finality by itself.

## GP-17 exit criteria

GP-17 is complete only when GP-17.1 through GP-17.10 are implemented and exact-head qualification proves the onboarding flow preserves GP-16 security/privacy guarantees across generated configuration, local/devnet rehearsal and available testnet evidence. Live-network claims require live-network evidence and are not implied by repository tests.
