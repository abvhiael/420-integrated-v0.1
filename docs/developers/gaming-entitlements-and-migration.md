---
title: Gaming entitlements and migration
audience:
  - developer
category: developer
status: development
version: current
---

# Gaming entitlements and migration

420 Gaming Protocol uses explicit game-scoped entitlements and target-bound migration claims to move only the interoperability state that needs canonical provenance.

## Entitlements

`GameEntitlements420` records optional rights or access issued inside one registered game namespace.

An entitlement is not a substitute for arbitrary gameplay state. Use it for narrowly defined portable or verifiable rights such as:

- access to optional content;
- ownership-linked unlocks;
- prestige/status markers;
- cross-device/cross-client rights that need canonical provenance;
- other explicitly documented game-scoped rights.

Do not put ordinary save data, experience totals, quest state, anti-cheat telemetry or whole inventory snapshots into entitlement state merely because the protocol is available.

## Issuance and revocation authority

Only the registered operator for the exact game may issue or revoke that game's entitlement state. A wallet connection, another game's operator, an Indexer response or a Developer Hub tool does not grant entitlement authority.

Entitlement consumption must fail closed when the object is:

- unknown;
- revoked;
- expired where expiry applies;
- scoped to another game/profile;
- insufficiently finalized;
- contradicted by canonical state.

Clients should query exact known entitlement identifiers plus exact game/profile scope rather than enumerating a wallet-wide entitlement history.

## Migration purpose

Migration exists so eligible guest or conventional-account state can be committed to a specific wallet-linked target without placing raw guest progression on-chain.

The canonical claim should represent a commitment to what the game's migration service has prepared, not the entire underlying save payload.

A safe migration flow is:

1. authenticate the guest/registered source using the game's normal account rules;
2. select the exact target 420 account/profile;
3. prepare an off-chain migration package and commitment;
4. have the registered game operator issue the canonical target-bound claim;
5. show the target account and migration scope before Wallet authorization;
6. consume the claim once through the intended target account;
7. wait for canonical/finalized consumption state;
8. reconcile the game's off-chain save/profile state only after successful canonical completion.

## Required migration properties

Genesis invariants require migration claims to be:

- **target-account bound** — another account cannot consume them;
- **expiry-aware** — stale claims cannot remain evergreen authority;
- **single-consumption** — replay cannot duplicate migration effects;
- **game-scoped** — a claim from one namespace cannot migrate another game's state.

If migration fails or expires, issue a new valid claim from the game's authorized migration process rather than mutating historical consumed/expired state.

## Idempotency and recovery

Migration orchestration may be retried only in ways that do not create duplicate canonical claims or duplicate downstream application effects.

Store correlation data that lets the service distinguish:

- preparation request ID;
- canonical claim ID;
- target account/profile;
- submission transaction/UserOperation;
- final canonical consumption result.

If submission outcome is uncertain, query canonical claim/transaction state before issuing or consuming again.

## Off-chain payload boundary

Never include the following directly in canonical migration state unless a future protocol version explicitly requires it:

- raw save files;
- private profile data;
- plaintext account credentials;
- session cookies/tokens;
- private keys, seed phrases or passkeys;
- detailed telemetry/anti-cheat evidence.

Use commitments and application-controlled secure transfer for the underlying migration payload.

## Finality

A migration is not complete because an optimistic UI, provider response or Indexer projection says it is. High-risk migration/entitlement decisions should require canonical finalized state according to the selected environment's finality policy.

Short reorgs, RPC disagreement or finality uncertainty must fail closed for irreversible migration effects.

## Related documentation

- [420 Gaming Protocol integration](gaming-protocol-integration.md)
- [Guest, registered and Wallet-linked play](guest-and-wallet-play.md)
- [Cross-game attestations and sessions](cross-game-attestations-and-sessions.md)
- [Errors, retries and idempotency](errors-retries-and-idempotency.md)
- [Events, logs and finality](events-and-finality.md)
