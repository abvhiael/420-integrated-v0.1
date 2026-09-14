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

Defines the gaming-specific onboarding manifest and deterministic preflight inside Developer Hub. Validates canonical game identity, progressive-access policy, requested Gaming Protocol surfaces, application identity binding and network consistency. Reuses DEVHUB-13 application publication instead of duplicating Registry/AppStore logic.

### GP-17.2 — Game registration profile & protocol capability declaration

Status: COMPLETE — merged through PR #254.

Defines machine-readable game registration metadata, supported protocol surfaces, requested actions/capabilities and compatibility requirements. Capability declarations are game-scoped, action-catalogue constrained and noncanonical. Wildcard, global and wallet-wide authority requests fail closed. Developer Hub prepares the capability handoff but cannot mint grants; canonical authority remains with CapabilityRegistry420 and the established gaming authority boundary.

### GP-17.3 — SDK integration generator

Status: IN QUALIFICATION.

Generate deterministic game-scoped SDK configuration and starter integration material from accepted GP-17.1 and GP-17.2 artifacts. Generated clients remain pinned to the canonical game ID, preserve the declared protocol/action subset, carry GP-16 finality compatibility and never generate wallet-global enumeration or undeclared authority surfaces.

### GP-17.4 — Progressive-access policy qualification

Provide automated checks proving guest core play, registered continuity and optional wallet-linked capabilities without pay-to-win or wallet-required core progression.

### GP-17.5 — Entitlement, claim & attestation onboarding

Guide and qualify high-risk Gaming Protocol integrations, including scoped entitlements, claims and cross-game attestations using the GP-16 finality/reorg fail-closed model.

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

## GP-17.1 implementation

`developer-hub/src/gaming-onboarding.mjs` defines the first gaming-specific Developer Hub surface.

It validates schema version, canonical game ID format, game display identity, `guest -> registered -> wallet-linked` progression, wallet-free core gameplay, optional wallet-linked features, declared protocol surfaces only, application ID derived from the canonical game ID and network consistency through the existing Developer Hub application-publishing preflight.

The resulting plan is noncanonical. It is a developer preflight and handoff artifact, not registration, governance authorization, Wallet authority or chain state.

## GP-17.2 implementation

`developer-hub/src/gaming-registration-profile.mjs` defines the machine-readable game registration profile and capability preflight.

It enforces exact game/application identity binding back to GP-17.1, one declaration per protocol, declared-protocol-only capability requests, exact `game` scope, fixed action-catalogue constraints, fail-closed wildcard/global/wallet-wide rejection, compatibility with `420GP/V1`, `@420/gaming-sdk` and GP-16 finality, and no Developer Hub-created canonical grant.

Qualification lives in `developer-hub/test/gaming-registration-profile.test.mjs`.

## GP-17.3 implementation

`developer-hub/src/gaming-sdk-generator.mjs` produces deterministic integration artifacts from validated onboarding and registration profiles.

It generates:

- `420-gaming.config.json` pinned to the canonical game ID;
- a starter `src/420-gaming-client.mjs` that constructs the shared SDK with that exact game ID;
- protocol client declarations restricted to the GP-17.2 capability subset;
- progressive-access defaults from GP-17.1;
- SDK/protocol/finality compatibility metadata;
- explicit forbidden wallet-global query surfaces;
- noncanonical authority metadata that leaves canonical grants with CapabilityRegistry420.

Qualification lives in `developer-hub/test/gaming-sdk-generator.test.mjs` and checks deterministic generation, identity binding, protocol subset preservation, game scope, finality compatibility and fail-closed mismatches.

## GP-17 exit criteria

GP-17 is complete only when GP-17.1 through GP-17.10 are implemented and exact-head qualification proves the onboarding flow preserves GP-16 security/privacy guarantees across generated configuration, local/devnet rehearsal and available testnet evidence. Live-network claims require live-network evidence and are not implied by repository tests.
