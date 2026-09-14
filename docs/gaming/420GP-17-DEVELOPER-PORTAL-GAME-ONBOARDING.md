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
Status: IN QUALIFICATION.

Generate and validate the exact game-scoped authority plan without creating authority inside Developer Hub. SmartAccount420 remains the session-execution boundary and CapabilityRegistry420 remains the canonical grant authority. Session calls are target/selector/action/game scoped, default deny, authorization-epoch aware and cannot authorize native-value transfer or undeclared/global/wallet-wide authority.

### GP-17.8 — Local/devnet onboarding rehearsal
Run the generated integration against Developer Hub local/devnet tooling with deterministic fixtures before any testnet handoff.

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

It enforces:

- SmartAccount420 is never required for core gameplay;
- wallet linkage stays optional;
- reusable gaming authority executes only through SmartAccount420 session execution;
- CapabilityRegistry420 remains canonical grant authority;
- Developer Hub cannot mint grants;
- every grant remains exact-game and exact-action bound;
- session policy is default deny and authorization-epoch aware;
- every reusable call is target + selector + action + game scoped;
- session calls authorize zero native value;
- wildcard, global, wallet-wide and undeclared actions fail closed;
- no canonical grant is created during onboarding.

Qualification lives in `developer-hub/test/gaming-authority-onboarding.test.mjs`.

## GP-17 exit criteria

GP-17 is complete only when GP-17.1 through GP-17.10 are implemented and exact-head qualification proves the onboarding flow preserves GP-16 security/privacy guarantees across generated configuration, local/devnet rehearsal and available testnet evidence. Live-network claims require live-network evidence and are not implied by repository tests.
