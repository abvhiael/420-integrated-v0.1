# 420GP-9 — Deployment / Genesis Runtime Wiring

## Purpose

Turn the implemented 420 Gaming Protocol into an environment-resolvable deployment/runtime package without hard-coding operator accounts or undeployed addresses.

## Deployment order

1. GamingAuthorization420
2. GameRegistry420
3. GameIdentity420
4. GameEntitlements420
5. GameClaims420
6. CrossGameRegistry420
7. grant protocol/game administration capabilities
8. register High Country under `420/GAMING/GAME/HIGH_COUNTRY/V1`
9. publish the resolved runtime manifest to clients/services

## Runtime manifest

`deployments/gaming/testnet.runtime.json` is intentionally checked in unresolved. Deployment tooling must fill chain ID, contract addresses, operator addresses, and metadata commitments in the environment-specific generated artifact.

The checked-in template contains no private keys, seed phrases, mnemonics, session signing material, credentials, or raw game/player data.

## High Country reference registration

The first registered game is High Country with the canonical entitlement namespaces already frozen by the reference integration:

- bonus region
- cosmetic
- competition
- genetics
- cross-game

The operator address is environment supplied. The runtime layer does not invent a second operator authority.

## Acceptance boundary

Repository qualification verifies schema, canonical game/entitlement domains, required contract slots, operator slots, and secret-field exclusion. A manifest marked deployment-ready must additionally resolve a positive chain ID and every required address to a non-zero EVM address.

Actual transaction deployment, capability grants, game registration receipts, and live RPC verification remain testnet operations and are not claimed by this repository-only slice.
