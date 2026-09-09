# 420GP-11 — The Green Road integration

The Green Road is the second reference game for the shared 420 Gaming Protocol after High Country.

The game-specific architecture is frozen in [`TGR-0-ARCHITECTURE.md`](./TGR-0-ARCHITECTURE.md). GP-11 defines the shared Gaming Protocol integration boundary; TGR-0 defines the Green Road domain, persistence, offline/sync, content and authority model layered on top of it.

## Access model

- Guest: core road-trip / hidden-object gameplay, local progress, no wallet.
- Registered: cloud save, recovery and cross-device continuity, still no wallet.
- Wallet-linked: optional secret routes, bonus levels, collectibles, seasonal events, rewards and cross-game artifacts.

Wallet linking must never increase ordinary hidden-object stats, clue strength, movement speed or baseline progression.

## Canonical namespace

Game ID: `420/GAMING/GAME/THE_GREEN_ROAD/V1`

Entitlement domains:
- `420/TGR/ENTITLEMENT/SECRET_ROUTE/V1`
- `420/TGR/ENTITLEMENT/BONUS_LEVEL/V1`
- `420/TGR/ENTITLEMENT/COLLECTIBLE/V1`
- `420/TGR/ENTITLEMENT/SEASONAL_EVENT/V1`
- `420/TGR/ENTITLEMENT/CROSS_GAME/V1`

## Shared infrastructure reuse

The client consumes `@420/gaming-sdk` directly and therefore inherits the same progressive access semantics proven in High Country. It uses the shared Player/Profile Service for registered accounts and migration orchestration, the shared Query Layer for scoped reads, GameIdentity420 for canonical wallet-linked game identity, GameEntitlements420 for optional access, GameClaims420 for guest/registered migration, CrossGameRegistry420 for narrow attestations, and SmartAccount420 / CapabilityRegistry420 for wallet execution/session authority.

## Privacy boundary

The Green Road client must not enumerate a wallet's game history or cross-game activity. Cross-game features verify only explicit known attestations or entitlements.

## Qualification target

420GP-11 is qualified when:
1. core guest play remains wallet-free;
2. cloud-save benefits require registration only;
3. wallet prompts occur only at optional feature boundaries;
4. all shared SDK adapter calls are scoped to the Green Road game ID;
5. unsupported feature classes fail closed;
6. wallet linkage does not grant pay-to-win statistical advantage.

TGR-0 adds game-specific qualification for immutable content IDs, versioned save envelopes, offline reconciliation, authority separation and portable-state revalidation without weakening any GP-11 invariant.
