# 420GP-17 — Developer Portal / Game Onboarding

## Status

GP-17 is **COMPLETE**.

GP-17.1 through GP-17.10 are implemented and merged. The final GP-17.10 closeout shipped through PR #264 after exact-head qualification passed on `50cff9e5fede37b17c9e5e7ac3a877077bdc5073`:

- 420 Developer Hub #139 — PASS;
- 420Docs Qualification #1045 — PASS;
- 420 Integrated Qualification #3151 — PASS.

PR #264 merged to `main` as `055a0eceedb268318d441a1d2ff263454a1237d9`.

The Developer Hub prerequisite remains satisfied: DEVHUB-0 through DEVHUB-19 are complete. GP-17 extends the permanent Developer Hub rather than creating a separate gaming portal.

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
Status: COMPLETE — merged through PR #264.

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

## Completed protocol guarantees

GP-17 now locks the following onboarding guarantees across the Developer Hub flow:

- core gameplay remains wallet-free;
- registered play can remain wallet-free;
- wallet linkage is explicit and optional;
- wallet linkage alone cannot confer pay-to-win statistical advantage;
- game identity is canonical and pinned end to end;
- capabilities are declared per exact game and action;
- wildcard, global and wallet-wide gaming authority fails closed;
- entitlement, claim and attestation decisions require GP-16 finalized canonical state for high-risk use;
- migration is target-bound, commitment-only, expiry-aware, single-consumption and idempotent;
- SmartAccount420 remains the reusable session-execution boundary;
- CapabilityRegistry420 remains the canonical capability-grant authority;
- Developer Hub cannot create canonical grants, registrations, wallet authority or security certification;
- local/devnet rehearsal cannot be presented as live testnet qualification;
- testnet qualification requires actual live-network evidence bound to the exact game, application, chain and commit.

## GP-17 closeout contract

The final repository closeout requires and now satisfies:

- GP-17.1 through GP-17.10 complete in order;
- canonical game/application identity preserved end to end;
- task-oriented onboarding documentation complete;
- troubleshooting coverage complete;
- examples complete;
- exact-head qualification green on the final GP-17.10 head;
- Developer Hub authority remains `false`;
- no canonical Registry registration or CapabilityRegistry grant created by closeout;
- no security-certification claim;
- live-network qualification claims require actual live-network evidence.

## Post-GP-17 operational work

GP-17 completion means the Developer Hub game-onboarding protocol and repository qualification path are complete. It does **not** mean a public testnet deployment has been proven.

Future operational work is evidence-driven rather than another GP-17 implementation phase:

1. publish or select the canonical testnet manifest when the official testnet is available;
2. run the GP-17.9 evidence flow against the actual deployed testnet;
3. verify canonical game registration, finalized reads, faucet/developer-account access and exact authority scope from live network state;
4. retain the resulting evidence package against the exact deployed commit and chain identity;
5. re-run qualification whenever deployment-affecting code or configuration changes;
6. treat any future protocol expansion as a new GP phase rather than silently extending the closed GP-17 contract.

## Exit result

**PASS — GP-17 COMPLETE.**

The repository now contains the complete game onboarding path from manifest creation and capability declaration through generated SDK integration, progressive access, high-risk state handling, migration, SmartAccount/CapabilityRegistry authority handoff, local/devnet rehearsal, testnet evidence qualification, developer UX/documentation and formal closeout.

Repository closeout proves implementation coverage and preserved invariants. It does not by itself prove deployment, Registry legitimacy, canonical grants or live-network success without the corresponding live evidence.
