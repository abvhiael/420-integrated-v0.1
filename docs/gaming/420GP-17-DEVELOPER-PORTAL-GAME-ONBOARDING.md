# 420GP-17 — Developer Portal / Game Onboarding

## Status

GP-17 is ACTIVE.

The Developer Hub prerequisite is satisfied: DEVHUB-0 through DEVHUB-19 are complete. GP-17 extends the permanent Developer Hub rather than creating a separate gaming portal.

## Objective

Provide a safe, deterministic path for external game developers to onboard into the 420 Gaming Protocol while preserving GP-16 guarantees: wallet-free core gameplay, deliberate guest -> registered -> wallet-linked progression, optional wallet capabilities, canonical game IDs, noncanonical Developer Hub tooling and explicitly scoped cross-game behavior.

## Roadmap

### GP-17.1 — Game onboarding manifest & preflight
Status: COMPLETE — merged through PR #253.

### GP-17.2 — Game registration profile & protocol capability declaration
Status: COMPLETE — merged through PR #254.

### GP-17.3 — SDK integration generator
Status: COMPLETE — merged through PR #255.

### GP-17.4 — Progressive-access policy qualification
Status: COMPLETE — merged through PR #257.

### GP-17.5 — Entitlement, claim & attestation onboarding
Status: COMPLETE — merged through PR #258.

### GP-17.6 — Migration & wallet-link onboarding
Status: COMPLETE — merged through PR #259.

Qualifies target-bound, game-scoped, commitment-only migration with explicit wallet-link consent, expiry, single consumption, idempotency and GP-16 finalized completion.

### GP-17.7 — SmartAccount / CapabilityRegistry onboarding
Status: COMPLETE — merged through PR #260.

Generate and validate the exact game-scoped authority plan without creating authority inside Developer Hub. SmartAccount420 remains the session-execution boundary and CapabilityRegistry420 remains the canonical grant authority. Session calls are target/selector/action/game scoped, default deny, authorization-epoch aware and cannot authorize native-value transfer or undeclared/global/wallet-wide authority.

### GP-17.8 — Local/devnet onboarding rehearsal
Status: IN QUALIFICATION.

Run the generated integration against the existing DEVHUB-5 local real15/devnet profile with deterministic fixtures before any testnet handoff. Rehearsal is pinned to local chain ID 420, 15 execution nodes, 15 consensus nodes and the deterministic `devnet-tcp` transport; it exercises SDK generation, progressive-access guarantees, authority boundaries and GP-16 finality semantics without creating canonical registration, grants or live testnet claims.

### GP-17.9 — Testnet onboarding qualification
Produce an evidence package for real testnet onboarding. No live qualification claim is valid without deployed-network evidence.

### GP-17.10 — Developer UX, documentation & closeout
Complete portal/dashboard surfaces, task-oriented onboarding docs, troubleshooting, examples, exact-head qualification and GP-17 closeout.

## Implemented surfaces

### GP-17.1
`developer-hub/src/gaming-onboarding.mjs` validates canonical game identity, progressive access, wallet-free core play, optional wallet-linked features, declared protocol surfaces, application identity binding and shared publication preflight.

### GP-17.2
`developer-hub/src/gaming-registration-profile.mjs` validates exact game/application binding, one declaration per protocol, exact `game` scope, fixed action catalogues and no wildcard/global/wallet-wide authority.

### GP-17.3
`developer-hub/src/gaming-sdk-generator.mjs` emits deterministic configuration and starter SDK material pinned to canonical game ID and the declared protocol/action subset.

### GP-17.4
`developer-hub/src/gaming-progressive-access-qualification.mjs` proves guest-accessible core progression, registered wallet-free continuity, optional wallet-linked features and no wallet-linked pay-to-win behavior.

### GP-17.5
`developer-hub/src/gaming-high-risk-onboarding.mjs` qualifies entitlement, claim and attestation integrations with GP-16 finalized canonical state, reorg/RPC fail-closed handling and explicit cross-game scope.

### GP-17.6
`developer-hub/src/gaming-migration-wallet-link.mjs` qualifies explicit-consent wallet linking and replay-safe migration. Developer Hub cannot create the canonical claim, link the wallet or declare migration complete.

### GP-17.7
`developer-hub/src/gaming-authority-onboarding.mjs` validates the SmartAccount420 / CapabilityRegistry420 handoff.

It enforces SmartAccount420 independence for core gameplay, optional wallet linkage, CapabilityRegistry420 canonical grant authority, exact game/action scoping, default-deny session policy, authorization-epoch validation, target/selector/action/game call scoping, zero native-value session calls and fail-closed wildcard/global/wallet-wide/undeclared authority.

Qualification lives in `developer-hub/test/gaming-authority-onboarding.test.mjs`.

### GP-17.8
`developer-hub/src/gaming-local-devnet-rehearsal.mjs` creates the deterministic local rehearsal handoff using the established DEVHUB-5 real15 profile rather than a parallel gaming-specific chain harness.

It requires:

- DEVHUB-5 `real15` profile;
- `local` environment only;
- chain ID `420`;
- 15 execution and 15 consensus nodes;
- deterministic `devnet-tcp` transport;
- generated GP-17.3 SDK integration pinned to the canonical game ID;
- GP-16 finality semantics;
- wallet-free guest and registered core progression;
- optional wallet-linked capability;
- no Developer Hub grant, session or registration authority;
- no implication of live testnet qualification.

The rehearsal plan explicitly reuses `npm run devnet:doctor`, `npm run devnet:plan`, `npm run devnet:prepare` and `npm run devnet:smoke`. Qualification lives in `developer-hub/test/gaming-local-devnet-rehearsal.test.mjs`.

## GP-17 exit criteria

GP-17 is complete only when GP-17.1 through GP-17.10 are implemented and exact-head qualification proves the onboarding flow preserves GP-16 security/privacy guarantees across generated configuration, local/devnet rehearsal and available testnet evidence. Live-network claims require live-network evidence and are not implied by repository tests.
