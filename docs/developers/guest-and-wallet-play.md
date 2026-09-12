---
title: Guest, registered and Wallet-linked play
audience:
  - developer
category: developer
status: development
version: current
---

# Guest, registered and Wallet-linked play

420 Gaming Protocol uses progressive access so a game can be useful before a player creates any blockchain identity.

## Guest-first requirement

Core gameplay should remain available to a guest unless the game documents a separate non-420 requirement. A guest can keep local or server-backed game state without creating canonical Gaming Protocol state.

Do not:

- block the title screen behind Wallet connection;
- create a wallet silently;
- treat a disconnected wallet as loss of the player's ordinary save;
- upload raw guest progression to chain;
- use wallet ownership as proof of conventional account ownership unless the game explicitly binds those identities.

## Registered account tier

A conventional registered account may add:

- cloud save;
- cross-device continuity;
- recovery through the game's account service;
- server-side profile features.

This tier can remain completely wallet-free. Registration in an application database is not the same as a canonical `GameIdentity420` profile.

## Wallet-linked tier

Wallet linkage is explicit and opt-in. It can enable features such as:

- canonical wallet-linked game profile identity;
- portable or verifiable entitlements;
- ownership/interoperability features;
- migration of eligible guest/registered commitments;
- scoped cross-game attestations;
- ecosystem participation or prestige features.

Before requesting Wallet connection, the UI should explain the exact feature that needs it.

## Connection is not authority

A connected Wallet does not automatically authorize:

- spending;
- capability/session creation;
- entitlement issuance;
- operator actions;
- cross-game attestation creation;
- arbitrary game-state mutation.

State-changing actions must use the qualified Wallet/Smart Account flow and, when reusable authority is needed, an explicit Capability Registry scope.

## Safe downgrade

If Wallet connection, session authority or canonical chain access disappears, the game should fail closed only for the affected wallet-backed feature while preserving ordinary gameplay where possible.

Examples:

- entitlement-gated optional cosmetic feature becomes unavailable until revalidated;
- guest/core loop remains playable;
- local/off-chain save remains intact;
- no cached entitlement is treated as permanently valid;
- the client does not fabricate a replacement canonical profile.

## Namespace pinning

Clients should compile/configure an expected game namespace and reject responses for another `gameId`. Do not trust an API response that tries to substitute another game's profile or entitlement scope.

## Privacy

Guest and ordinary registered activity should not become a wallet-wide public history merely because the user later links a wallet. Only the narrowly defined canonical objects required for interoperability should be published.

Avoid using wallet addresses as a universal analytics identity. Keep game telemetry, anti-cheat data and ordinary save data inside the game's normal privacy controls.

## User experience sequence

A recommended UX is:

1. start in guest mode;
2. optionally offer conventional registration/cloud save;
3. surface a wallet-linked feature only when relevant;
4. explain why Wallet connection is useful;
5. connect the Wallet without requesting unrelated authority;
6. resolve the canonical game profile in the pinned namespace;
7. request only the exact capability/signature needed for the requested feature;
8. revalidate high-risk state against canonical/finalized sources;
9. provide a clean disconnect/downgrade path.

## Competitive fairness

Wallet connection must not itself grant a statistical power advantage. A game may have ownership or item systems with documented balance rules, but the protocol-level fact that a wallet is linked cannot serve as an automatic damage, speed, yield, drop-rate or competitive-stat multiplier.

## Related documentation

- [420 Gaming Protocol integration](gaming-protocol-integration.md)
- [Gaming entitlements and migration](gaming-entitlements-and-migration.md)
- [Cross-game attestations and sessions](cross-game-attestations-and-sessions.md)
- [Wallet and Smart Account integration](wallet-and-smart-accounts.md)
