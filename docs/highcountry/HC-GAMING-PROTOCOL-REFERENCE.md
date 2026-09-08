# High Country × 420 Gaming Protocol Reference Integration

## Status

High Country is the first reference consumer of the shared genesis-era 420 Gaming Protocol.

## Authority split

High Country remains authoritative for game-specific mechanics and progression, including cultivation, genetics, regions, equipment, BUDS, seasons, competitions, and other domain state.

The shared 420 Gaming Protocol is authoritative only for optional wallet-linked game identity, guest-state migration commitments, scoped entitlements, and cross-game attestations.

## Progressive access

Core play must not require a 420 Wallet. Guest and conventional-account saves remain off-chain. A player may later create/link a shared High Country game profile and bind it to the existing GrowerProfile.

Wallet linkage is an optional capability expansion. It may unlock portable ownership, cosmetics, bonus content, competition access, genetics-related entitlements, prestige, or cross-game functionality, but wallet linkage itself must not grant pay-to-win statistical advantages.

## Reference bridge

`HighCountryGamingBridge420` provides the additive boundary between High Country and the shared protocol.

It supports:

- one-to-one GrowerProfile ↔ shared High Country game-profile binding;
- consumed guest-migration claim binding with replay protection;
- active entitlement validation scoped to the bound shared profile;
- type + content scoped entitlement checks for High Country gameplay systems;
- fail-closed `requireScopedEntitlement(...)` enforcement for wallet-gated optional content.

Convenience checks currently cover bonus regions, cosmetics, competition access, and genetics access.

## Integration rule

High Country gameplay contracts should depend on the bridge or a narrow bridge-facing interface rather than importing shared gaming protocol storage contracts directly. This keeps the shared protocol generic and prevents High Country domain logic from leaking into genesis-wide gaming infrastructure.
