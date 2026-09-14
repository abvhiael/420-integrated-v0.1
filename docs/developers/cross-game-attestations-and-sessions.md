---
title: Cross-game attestations and gaming sessions
audience:
  - developer
category: developer
status: development
version: current
---

# Cross-game attestations and gaming sessions

Cross-game interoperability in 420 Gaming Protocol is explicit, scoped and privacy-preserving. It does not create a global public activity graph for every wallet.

## Cross-game attestations

`CrossGameRegistry420` records narrowly defined statements issued by the registered operator of a source game.

A consumer should treat an attestation as one exact claim under one exact namespace and subject scope. It is not a blanket declaration about the player's identity, behavior, inventory or history.

Examples of suitable attestation subjects include:

- completion of a named achievement class;
- eligibility for a documented interoperability feature;
- provenance for a known game-issued object or status;
- another narrow statement whose meaning is fixed by the source game and consuming integration.

## Issuance authority

Only the registered operator for the source game may issue or revoke its cross-game attestations. A consuming game may verify a source attestation but cannot manufacture source-game authority.

Revoked, expired, mismatched or insufficiently finalized attestations fail closed.

## Exact-scope verification

Cross-game consumers should query an attestation only when they already know the expected:

- attestation ID;
- source `gameId`;
- source profile/account scope;
- subject type;
- subject ID;
- consuming purpose or policy.

Do not enumerate all activity or attestations for a wallet to discover possible features. The Genesis privacy model deliberately omits a canonical wallet-wide player-activity enumeration surface.

## Namespace and poisoning defense

A consuming game must pin the expected source game and reject responses that substitute another namespace, profile or subject.

An Indexer/query response is insufficient when the feature changes ownership, rewards or another high-risk state. Revalidate the exact object against canonical protocol state and the required finality level.

## Wallet sessions remain Wallet authority

Gaming Protocol does not create independent session-signing semantics.

If a game needs reusable wallet authority, use `CapabilityRegistry420` and the Wallet/Smart Account model documented in DOC-9.6. Scopes should be narrow enough to express the intended action, target, selector, limits and validity period.

Do not grant a broad gaming session simply because the player linked a wallet.

A safe pattern is:

1. connect the Wallet;
2. identify the exact optional wallet-backed feature;
3. construct the smallest capability/session scope needed;
4. let the Wallet display and authorize the request;
5. bind the session to the current authorization epoch and validity limits;
6. revalidate entitlement/attestation state independently from session authority;
7. revoke or allow the session to expire when the feature no longer needs it.

## Separation of proofs

Keep these concepts distinct:

- **wallet/session authority** — whether this account may execute an action now;
- **entitlement** — whether the game operator granted a scoped right;
- **cross-game attestation** — whether a source game asserted a scoped fact;
- **canonical finality** — whether the relevant protocol state is stable enough to consume.

Possessing one does not manufacture the others.

For example, a valid Wallet session cannot create an entitlement, and a valid cross-game attestation cannot authorize spending.

## Disconnect, revocation and recovery

When Wallet/session authority disappears:

- stop only the affected wallet-backed operations;
- preserve ordinary gameplay where possible;
- recheck reusable authority after authorization-epoch changes or recovery;
- never rely on a cached session after recovery invalidates it.

When an entitlement or attestation is revoked:

- stop consuming it even if Wallet authority remains valid;
- do not reinterpret the Wallet connection as replacement proof;
- preserve historical evidence where appropriate without granting current access.

## Privacy and telemetry

Do not log or publish more cross-game context than is required to verify the requested feature. Avoid joining wallet addresses, raw save data and full gameplay histories into a universal tracking profile.

Support/debugging output should preserve object IDs, game namespace, canonical transaction/finality state and safe correlation identifiers while excluding secrets and unnecessary private gameplay data.

## Related documentation

- [420 Gaming Protocol integration](gaming-protocol-integration.md)
- [Gaming entitlements and migration](gaming-entitlements-and-migration.md)
- [Capabilities and sessions](capabilities-and-sessions.md)
- [Passkeys and recovery-aware integrations](passkeys-and-recovery.md)
- [Diagnostics and correlation](diagnostics-and-correlation.md)
