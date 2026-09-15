---
title: Capabilities and sessions
audience:
  - developer
category: developer
status: development
version: current
---

# Capabilities and sessions

Reusable Wallet authority must be explicit, narrow and revocable. A connected dApp does not automatically receive a capability, and a capability does not become valid merely because the application remembers it locally.

## Session keys

`SmartAccount420.enableSessionKey()` binds a session key to the account's current `authorizationEpoch`. If the epoch later advances, the old session key is no longer valid until the owner deliberately enables fresh authority.

Session keys must not be the account owner, recovery authority or zero address.

A dApp should treat session-key setup as a separate permission event from ordinary connection.

## Session grants

A session key alone does not authorize arbitrary account execution. `createSessionGrant()` binds reusable execution authority to:

- the session key;
- the Smart Account component identity;
- the current authorization epoch;
- exact target contract;
- exact function selector;
- per-call limit;
- period limit;
- period duration;
- validity start;
- validity end.

The resulting scope is registered in `CapabilityRegistry420` and is consumed when authorized session execution occurs.

Applications should request the minimum target/selector/value/time scope that supports the user action. Do not replace a set of narrow calls with an `ANY_TARGET`/arbitrary-call style permission.

## Session execution

Session UserOperations use `executeSession()`. Validation requires the recovered signer to match the encoded signer and requires the session's nonce lane and grant set to satisfy the Smart Account's canonical authorization checks.

For each call, the account resolves the matching grant and checks aggregate period limits. Grant consumption occurs in the execution envelope and rolls back atomically when the target execution reverts.

This means a local "session active" badge is insufficient. The application should be ready for canonical authorization to fail because the grant expired, was revoked, reached a limit or belongs to an old authorization epoch.

## Revocation

The owner may:

- revoke one session key;
- revoke one capability grant;
- advance the global authorization epoch and invalidate reusable authority broadly.

Applications should expose a clean recovery path when a reusable grant disappears: refresh authority state, remove stale local metadata and request new authorization only if the user still needs the action.

## Gas sponsorship

`SmartAccount420.createGasSponsorGrant()` creates a separately scoped capability for a sponsor and operation. Sponsorship authority is not generic account execution authority and must not be promoted into one.

A sponsor integration must honor the account-scoped operation, amount limits, validity and Registry-backed capability checks.

## Safe dApp model

Store only public/rebuildable metadata needed for UX, such as:

- session public address;
- grant identifier;
- expected target/selector scope;
- expected validity window;
- account/network identifiers.

Do not store user private keys, passkey private material or unrelated Wallet secrets.

Before session execution, re-read canonical state needed to prove the session is still usable.

## Failure and fallback

When session authority is unavailable, prefer explicit Wallet/owner authorization over silently widening permissions.

Fail closed if:

- the account is bound to an unexpected capability registry;
- the session epoch differs from the current authorization epoch;
- no matching grant exists;
- target/selector differ from the grant;
- value/amount exceeds limits;
- validity has not begun or has expired;
- the aggregate period limit would be exceeded.

## Related documentation

- [Wallet and Smart Account integration](wallet-and-smart-accounts.md)
- [Transaction preparation and simulation](transaction-preparation-and-simulation.md)
- [Passkeys and recovery-aware integrations](passkeys-and-recovery.md)
- [Wallet permissions and sessions](../users/wallet/permissions-and-sessions.md)
