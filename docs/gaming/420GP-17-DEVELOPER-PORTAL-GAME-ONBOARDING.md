# 420GP-17 — Developer Portal / Game Onboarding

## Status

GP-17 is ACTIVE — GP-17.10 is in qualification.

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

### GP-17.7 — SmartAccount / CapabilityRegistry onboarding
Status: COMPLETE — merged through PR #260.

### GP-17.8 — Local/devnet onboarding rehearsal
Status: COMPLETE — merged through PR #262.

### GP-17.9 — Testnet onboarding qualification
Status: COMPLETE — merged through PR #263.

GP-17.9 provides an evidence-driven testnet onboarding report bound to the exact game, application, discovered testnet chain, observation time and commit SHA. Missing live evidence blocks; explicit failures fail; repository CI and local rehearsal cannot manufacture a live-network PASS.

### GP-17.10 — Developer UX, documentation & closeout
Status: IN QUALIFICATION.

GP-17.10 adds the task-oriented game-onboarding guide, troubleshooting and examples, plus a closeout gate that requires all ten GP-17 phases in canonical order and exact-head qualification. Developer Hub remains non-authoritative and live-network claims continue to require live-network evidence.

## Implemented surfaces

- `developer-hub/src/gaming-onboarding.mjs` — canonical game manifest and publication preflight.
- `developer-hub/src/gaming-registration-profile.mjs` — exact game-scoped capability declaration.
- `developer-hub/src/gaming-sdk-generator.mjs` — deterministic game-scoped SDK integration.
- `developer-hub/src/gaming-progressive-access-qualification.mjs` — guest/registered/wallet-linked policy qualification.
- `developer-hub/src/gaming-high-risk-onboarding.mjs` — finalized entitlement/claim/attestation onboarding.
- `developer-hub/src/gaming-migration-wallet-link.mjs` — explicit-consent, replay-safe migration/wallet-link handoff.
- `developer-hub/src/gaming-authority-onboarding.mjs` — SmartAccount420 / CapabilityRegistry420 authority-plan validation.
- `developer-hub/src/gaming-local-devnet-rehearsal.mjs` — deterministic DEVHUB-5 real15 rehearsal.
- `developer-hub/src/gaming-testnet-qualification.mjs` — evidence-driven live-testnet onboarding qualification.
- `developer-hub/src/gaming-onboarding-closeout.mjs` — GP-17.10 repository closeout gate.
- `docs/developers/gaming-onboarding.md` — end-to-end developer onboarding guide and troubleshooting path.

## GP-17.10 closeout contract

The final repository closeout requires:

- GP-17.1 through GP-17.10 complete in order;
- canonical game/application identity preserved end to end;
- task-oriented onboarding documentation complete;
- troubleshooting coverage complete;
- examples complete;
- exact-head qualification green;
- Developer Hub authority remains `false`;
- no canonical Registry registration or CapabilityRegistry grant created by closeout;
- no security-certification claim;
- live-network qualification claims require actual live-network evidence.

## GP-17 exit criteria

GP-17 is complete only after GP-17.10 is merged on an exact head that passes Developer Hub, 420Docs and full 420 Integrated qualification. Repository closeout proves onboarding coverage and invariants; it does not prove deployment, Registry legitimacy, canonical grants or live-network success without the corresponding live evidence.
