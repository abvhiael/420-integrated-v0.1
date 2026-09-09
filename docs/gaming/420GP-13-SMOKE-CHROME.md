# 420GP-13 — Smoke & Chrome integration

Smoke & Chrome is the fourth reference game integrated with the shared 420 Gaming Protocol and the first reference that places heavier emphasis on transferable ownership and collectible provenance.

## Access model

- Guest players can play core matches and build decks without a wallet.
- Registered players may use cloud-save/account recovery without a wallet.
- Wallet-linked players may opt into blockchain-backed editions, collectibles, marketplace actions, tournament prizes and scoped cross-game prestige.

## Off-chain game boundary

The following remain off-chain by default:

- match simulation and turn state;
- matchmaking;
- deck simulation and ordinary deck construction;
- opponent AI;
- routine ranking/ladder state;
- ordinary progression.

The wallet is never required merely to play a match or construct a competitive deck.

## Shared protocol boundary

Smoke & Chrome reuses `@420/gaming-sdk` and the shared Gaming Protocol for:

- wallet/game identity;
- optional entitlements;
- guest migration commitments;
- session-bound wallet actions;
- scoped cross-game attestations.

Canonical wallet and session authority remains in SmartAccount420 / CapabilityRegistry420.

## Ownership / anti-pay-to-win

Wallet-linked ownership may represent provenance, limited/special editions, cosmetics, collectibles, tradeable assets, prizes and prestige. Wallet linkage alone must not increase card combat statistics, draw odds, match speed, ranking weight, progression rate, matchmaking priority, deck size, resource generation or any other core competitive statistic.

## Privacy

The client must not provide wallet-wide or cross-game activity enumeration. Cross-game consumers verify explicit known entitlements or attestations only.
