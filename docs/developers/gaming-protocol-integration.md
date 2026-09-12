---
title: 420 Gaming Protocol integration
audience:
  - developer
category: developer
status: development
version: current
---

# 420 Gaming Protocol integration

420 Gaming Protocol is the shared interoperability layer for games that want optional 420 Wallet-linked identity, portable entitlements, migration commitments and narrowly scoped cross-game attestations without putting ordinary gameplay on-chain.

The integration rule is strict: **core gameplay remains available without a 420 Wallet unless a game explicitly documents some separate non-420 requirement.** Wallet linkage expands ownership, interoperability, prestige, ecosystem participation or optional content. It is not a default admission gate and does not itself grant pay-to-win statistical advantages.

## What belongs on-chain

Canonical Gaming Protocol state is limited to provenance-sensitive interoperability state:

- registered game identity and operator authority;
- canonical wallet-linked profile identity per game namespace;
- game-scoped entitlements;
- target-bound migration commitments/claims;
- explicit cross-game attestations;
- revocation and lifecycle state for those objects.

The following remain off-chain by default:

- guest profiles;
- ordinary saves;
- level/quest/progression state;
- anti-cheat telemetry;
- raw match/session history;
- cloud-save payloads;
- session signing material;
- wallet secrets.

Routine game mechanics remain the responsibility of the game itself. The shared protocol must not become a universal gameplay-state database.

## Canonical components

The Genesis suite contains:

- `GamingAuthorization420` — scoped protocol/game administration authorization;
- `GameRegistry420` — game namespace/registration lifecycle;
- `GameIdentity420` — canonical wallet-linked game profile;
- `GameEntitlements420` — game-scoped optional entitlements;
- `GameClaims420` — replay-safe guest/registered-to-wallet migration claims;
- `CrossGameRegistry420` — narrowly scoped explicit attestations.

`SmartAccount420` and `CapabilityRegistry420` remain the canonical wallet/session execution boundary. Gaming Protocol does not create a parallel wallet authority system.

## Progressive access model

A safe application model has three independent tiers:

1. **Guest** — core gameplay, local/off-chain profile, no wallet.
2. **Registered** — conventional account/cloud save/cross-device continuity, still no wallet required.
3. **Wallet-linked** — optional canonical profile, portable entitlements, migration commitments, ownership/interoperability features and explicit cross-game attestations.

A player must be able to stop at the guest or registered tier when the game supports those modes. The application should make the added value of wallet linkage explicit before asking for a connection or signature.

## Game namespace

Every protocol-aware game operates in an explicit registered namespace. A client must pin itself to the expected `gameId` rather than accepting a game identifier from an untrusted response.

For an active registered game:

- a wallet account may join without administrator approval;
- v1 permits at most one canonical profile for one wallet account in one game namespace;
- inactive games cannot create new canonical player profiles;
- game-specific authority is scoped to the exact registered game.

Never infer that a profile, entitlement or claim in one namespace applies to another game merely because the wallet address is the same.

## Authority boundaries

| Action/state | Authority |
| --- | --- |
| guest save/progression | game/profile service |
| conventional account/cloud save | game/profile service |
| game registration/operator | GameRegistry420 + scoped authorization |
| wallet-linked game profile | GameIdentity420 |
| entitlement issuance/revocation | registered game operator + GameEntitlements420 |
| migration claim issuance/consumption | registered game operator/target account + GameClaims420 |
| cross-game attestation | registered source-game operator + CrossGameRegistry420 |
| wallet ownership/session/signing | SmartAccount420 / CapabilityRegistry420 |
| canonical transaction/finality | chain/owning protocol |
| indexed/query presentation | 420 Gaming Query / Indexer, non-canonical |

A wallet connection proves only that the client established a connection context. It does not prove entitlement, authorize spending or grant game-operator authority.

## Standard integration sequence

1. resolve the selected 420 network and canonical Gaming Protocol contracts;
2. resolve the expected registered `gameId` and confirm it is active;
3. start the player in guest/registered mode without requiring a wallet;
4. expose wallet-linked features separately from core play;
5. when the player opts in, connect through the qualified Wallet boundary;
6. resolve/create the canonical game profile for that wallet and namespace;
7. query exact entitlements/claims/attestations by known identifiers and exact scope;
8. use Wallet/Capability Registry for any execution or reusable session authority;
9. require canonical/finalized state for high-risk ownership, reward, entitlement, migration or cross-game decisions;
10. downgrade safely to non-wallet functionality when wallet authority becomes unavailable.

## Query/privacy model

Consumers should query explicit known objects, such as:

- game by known `gameId`;
- profile by `(gameId, account)`;
- entitlement by known entitlement ID and exact game/profile scope;
- migration claim by known claim ID and exact game/target-account scope;
- cross-game attestation by known attestation ID and exact source-game/profile/subject scope.

Do not build wallet-wide gameplay-history, entitlement, claim or activity enumeration as a canonical Gaming Protocol feature. Cross-game interoperability must remain explicit and purpose-bound.

## Finality and failure behavior

High-risk Gaming Protocol state fails closed when it is:

- missing;
- expired;
- revoked;
- wrong-game or wrong-profile scoped;
- unauthorized;
- reorged;
- insufficiently finalized;
- unavailable because canonical RPC/finality verification failed.

Indexer/query results may improve UX but cannot turn optimistic state into canonical ownership, reward, claim, entitlement or cross-game state.

## No-pay-to-win rule

Wallet linkage may unlock optional content, portability, collectible ownership, prestige, ecosystem features or other documented benefits. It must not automatically change a player's core statistical power simply because a wallet is connected.

Games may still define balanced game mechanics involving owned items or optional content, but the wallet connection itself is not a protocol-level stat boost or automatic competitive advantage.

## Related documentation

- [Guest, registered and Wallet-linked play](guest-and-wallet-play.md)
- [Gaming entitlements and migration](gaming-entitlements-and-migration.md)
- [Cross-game attestations and sessions](cross-game-attestations-and-sessions.md)
- [Wallet and Smart Account integration](wallet-and-smart-accounts.md)
- [Capabilities and sessions](capabilities-and-sessions.md)
- [Events, logs and finality](events-and-finality.md)
