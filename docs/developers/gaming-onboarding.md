---
title: Onboard a game to 420 Gaming Protocol
audience:
  - developer
category: developer
status: development
version: current
---

# Onboard a game to 420 Gaming Protocol

Use this guide to move a game from a local integration manifest through deterministic local rehearsal and evidence-driven testnet onboarding without turning Developer Hub into protocol authority.

## 1. Define the canonical game identity

Use a canonical game ID in the form `420/GAMING/GAME/<GAME>/V1`. The application ID is derived from that game ID by lowercasing it and replacing `/` with `-`.

Your GP-17.1 onboarding manifest must keep core gameplay wallet-free, preserve `guest -> registered -> wallet-linked` progression and declare only the protocol surfaces the game actually uses.

## 2. Declare exact protocol capabilities

GP-17.2 requires `game` scope and exact actions. Wildcards, global authority and wallet-wide enumeration are rejected. Capability declarations must correspond to protocols declared in the onboarding manifest.

## 3. Generate the SDK integration

GP-17.3 produces deterministic `420-gaming.config.json` and `src/420-gaming-client.mjs` output. The generated configuration remains game-scoped and carries the GP-16 finality model.

## 4. Prove progressive access

GP-17.4 qualifies the playable path. At least one core progression feature must remain available to guests, registered play remains wallet-free and wallet-linked features cannot create pay-to-win advantage.

## 5. Add entitlements, claims and attestations safely

GP-17.5 requires finalized canonical state for high-risk checks, revalidates canonical RPC state, fails closed on reorg/RPC uncertainty and blocks wallet-wide entitlement, claim or attestation enumeration. Cross-game attestation scope must be explicit.

## 6. Add migration and wallet linking

GP-17.6 requires explicit wallet-link consent, a displayed target account, target-bound and game-scoped migration, commitment-only canonical state, expiry, single consumption, idempotent preparation and canonical-state checks before retry. Reconcile off-chain state only after finalized canonical consumption.

## 7. Define SmartAccount and capability authority

GP-17.7 keeps SmartAccount420 optional for core gameplay and CapabilityRegistry420 as canonical grant authority. Reusable session calls must be game/action/target/selector scoped, default deny, authorization-epoch aware and zero-value. Developer Hub creates plans only; it does not mint grants or sessions.

## 8. Rehearse locally

GP-17.8 reuses the existing Developer Hub real15 profile. From `developer-hub/` run:

```bash
npm run devnet:doctor
npm run devnet:plan
npm run devnet:prepare
npm run devnet:smoke
```

The rehearsal requires local chain ID 420, 15 execution nodes, 15 consensus nodes and `devnet-tcp`. A successful local rehearsal is not live-testnet qualification.

## 9. Build the testnet evidence package

GP-17.9 requires a real testnet environment discovered from the official network manifest and evidence bound to the exact canonical game ID, application ID, testnet chain ID, observation timestamp and repository commit.

Required evidence covers network discovery, testnet account/faucet access, SDK integration, canonical registration reads, finalized state reads, wallet-free core play/optional wallet linkage and exact game/action authority scope.

Missing evidence is `BLOCKED`. Explicit failed evidence is `FAIL`. Only a complete live-network evidence package may report `QUALIFIED_FOR_TESTNET_ONBOARDING`. Repository CI cannot manufacture that result.

## 10. Close out GP-17

GP-17.10 requires all ten phases in order, task-oriented docs, troubleshooting coverage, examples and exact-head qualification. The closeout remains non-authoritative: it creates no Registry registration, CapabilityRegistry grant, Wallet authority or security certification.

## Troubleshooting

- **game/application mismatch** — derive the application ID from the exact canonical game ID and use the same identity through every GP-17 phase.
- **wallet required for progression** — move the feature back into guest/registered core play or make the wallet-linked feature optional.
- **wildcard/global capability rejected** — replace it with exact `game` scope and explicit actions/selectors.
- **migration retry uncertainty** — query canonical state before preparing or consuming another claim.
- **local rehearsal passes but testnet is blocked** — collect the missing live testnet evidence; do not substitute local or CI evidence.
- **Indexer shows success but high-risk state is uncertain** — revalidate against canonical RPC/owning contracts and GP-16 finality.

## Related guides

- [420 Gaming Protocol integration](gaming-protocol-integration.md)
- [Guest, registered and Wallet-linked play](guest-and-wallet-play.md)
- [Gaming entitlements and migration](gaming-entitlements-and-migration.md)
- [Cross-game attestations and gaming sessions](cross-game-attestations-and-sessions.md)
- [Testnet and Faucet](testnet-and-faucet.md)
- [Source of truth and finality](source-of-truth.md)

## Authority boundary

Developer Hub validates, generates and packages onboarding handoffs. Canonical game registration, grant/session authority, Wallet authorization, protocol state and live-network truth remain with their owning contracts, Wallet/SmartAccount, governance and the selected network.
