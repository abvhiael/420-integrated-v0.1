# HC-GP.8 — Client access UX

High Country uses a progressive access model:

1. `guest`
2. `registered`
3. `wallet-linked`

The client must never require a wallet to enter or continue ordinary High Country play.

## State rules

- Guest: instant play, local/platform save, no wallet prompt during ordinary play.
- Registered: optional conventional account, cloud save/recovery/cross-device support, still no wallet required.
- Wallet-linked: optional `$420` rewards, transferable ownership, marketplace, cross-game attestations, and other explicitly wallet-only content.

Wallet linkage is independent from current wallet connectivity. A previously linked player may be temporarily disconnected; reconnect prompts occur only when the player explicitly enters a wallet-only feature.

## Prompt rules

- Core gameplay: always allow; never prompt for registration or wallet.
- Cloud save: guest may be invited to register; `maybe later` remains valid.
- Optional wallet content, ownership, marketplace, rewards, and cross-game features: prompt to link a wallet only at that feature boundary.
- Linked-but-disconnected wallet: reconnect only at the wallet-only feature boundary.
- Routine sessions must not surface wallet prompts merely because a wallet-capable feature exists elsewhere in the game.

## Anti-pay-to-win rule

Wallet linkage alone must never grant cultivation yield, grow-capacity, genetics-quality, equipment-stat, BUDS-generation, land-stat, or ordinary progression advantages.

## SDK reference

`clients/highcountry-access-v1/src/access-state.js` is the framework-neutral reference implementation. Web, mobile, and embedded clients should consume equivalent semantics rather than implementing separate wallet-first flows.
