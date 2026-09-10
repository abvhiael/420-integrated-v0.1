# 420GP-14 — Cross-Game Interoperability Qualification

This phase qualifies the shared 420 Gaming Protocol across the current reference-game set:

- High Country
- The Green Road
- Budtender
- Smoke & Chrome

## Qualification goals

1. Core gameplay remains wallet-free in every game.
2. Cloud-save benefits require only a registered account, not wallet linkage.
3. Cross-game and ownership features cross an explicit wallet boundary.
4. Game namespaces remain isolated and SDK calls remain game-scoped.
5. No convenience surface is introduced that enumerates a wallet's full activity across games.
6. Cross-game capability does not create pay-to-win statistical advantages.
7. Identity, entitlement, claim and attestation authority remains in the shared Gaming Protocol.
8. Wallet/session authority remains in SmartAccount420 / CapabilityRegistry420.

## Interoperability model

Cross-game interoperability is verification-driven, not global-profile aggregation. A consuming game must know the source game/profile/subject or entitlement it intends to verify. The shared protocol and query layer should answer that scoped question and fail closed on mismatches.

Examples include High Country achievements unlocking a cosmetic in The Green Road, a Green Road artifact qualifying a Budtender decor item, or Smoke & Chrome prestige being recognized by another game. These integrations must never expose a canonical wallet-wide game-history feed.

## Competitive integrity

Cross-game recognition may unlock cosmetics, optional content, prestige, collectibles, events or rewards. Wallet linkage or cross-game status must not silently alter core progression rates, combat statistics, management economics, matchmaking priority, resource yield or other gameplay balance.

## Status

Repository-level cross-game qualification is complete when the dedicated workflow and integrated qualification both pass on the exact PR head. Live-chain interoperability remains part of 420GP-15 testnet qualification.
