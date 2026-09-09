# 420GP-10 — Gaming Query Layer

420GP-10 provides a privacy-conscious, non-canonical query surface over 420 Gaming Protocol state.

## Allowed queries

- game lookup by known `gameId`
- profile lookup by explicit `(gameId, account)`
- entitlement lookup by known `entitlementId` plus exact game/profile scope
- migration claim lookup by known `claimId` plus exact game/target-account scope
- cross-game attestation lookup by known `attestationId` plus exact source game, profile, subject type and subject ID

## Prohibited query surfaces

The shared query layer must not expose:

- wallet-wide game history
- cross-game player activity feeds
- enumerate-all-entitlements-for-wallet
- enumerate-all-attestations-for-wallet
- enumerate-all-claims-for-wallet

This preserves the protocol rule that games verify specific scoped rights/attestations rather than building a canonical dossier of player activity across the ecosystem.

## Authority boundary

The query layer is an accelerator only. It does not create canonical state and must not override chain state. Production adapters should revalidate indexed results against canonical contracts where freshness or revocation matters.

## Next increments

- event-index adapters for GameRegistry420, GameIdentity420, GameEntitlements420, GameClaims420 and CrossGameRegistry420
- canonical RPC revalidation
- SDK query adapter wiring
- cache freshness/finality metadata
- retention and privacy controls
