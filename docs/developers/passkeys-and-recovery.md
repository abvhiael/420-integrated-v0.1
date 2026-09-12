---
title: Passkeys and recovery-aware integrations
audience:
  - developer
category: developer
status: development
version: current
---

# Passkeys and recovery-aware integrations

Passkeys and recovery affect Smart Account authority, so dApps must treat them as account-security state rather than ordinary UI preferences.

## Passkeys are owner-level authority

`SmartAccount420` supports owner-level passkey validation for UserOperations through a configured passkey verifier. A passkey credential is bound to:

- a credential ID hash;
- RP ID hash;
- origin hash;
- public key coordinates;
- the current `authorizationEpoch` at enrollment.

The private authenticator material remains with the platform/authenticator and must never be requested by a dApp.

Passkeys use the owner nonce lane. Applications should not attempt to manufacture or validate passkey assertions independently of the qualified Wallet runtime and canonical verifier path.

## Epoch binding and stale credentials

A passkey is active only when its stored epoch matches the current `authorizationEpoch` and a passkey verifier is configured.

After an authorization-epoch change, an existing credential may become stale rather than disappearing. Re-enrollment can reactivate an already-known credential only under owner authority and without changing its stored identity/RP/origin/public-key binding.

A new credential identity or new public material must be enrolled as a new credential.

Applications should therefore distinguish:

- active credential;
- stale credential;
- revoked credential;
- absent/unknown credential.

Do not present stale passkeys as usable merely because local browser/device metadata still exists.

## Recovery state

`SmartAccount420` recovery is controlled by a separate recovery authority and a timelocked flow.

The canonical delay is **2 days** between a valid recovery proposal and when recovery can be finalized.

The owner may cancel a pending recovery before finalization. Completing recovery changes the account owner and advances the global authorization epoch.

That epoch advancement invalidates prior reusable authority such as old session-key epochs and makes old passkeys stale until deliberately re-established under the recovered account state.

## Recovery-aware dApp behavior

Applications should not attempt to execute recovery themselves unless they are the explicitly authorized recovery component for the account.

For ordinary dApps:

1. read recovery/account state only when relevant to the action;
2. avoid creating new long-lived permissions while recovery is in progress unless the qualified Wallet allows it;
3. revalidate account owner and authorization epoch before sensitive writes;
4. after recovery finalizes, clear stale local session/capability assumptions;
5. require fresh Wallet authorization when prior reusable authority no longer validates.

## Passkey verifier changes

Replacing an already-configured passkey verifier changes the account trust boundary and advances the authorization epoch. Applications must therefore treat verifier changes as security-sensitive account changes and refresh cached authority state.

## Signature boundaries

Passkey UserOperations are distinct from ordinary ERC-1271 message-signature behavior. The current Smart Account keeps ERC-1271 deliberately ECDSA-owner-only while passkey authority is qualified through the UserOperation path.

A dApp must not assume that successful passkey UserOperation support implies passkey support for every generic message-signing surface.

## Failure behavior

Fail closed when:

- the Wallet reports a stale/revoked credential;
- RP/origin binding does not match the qualified Wallet environment;
- the passkey verifier is absent or unexpected;
- the authorization epoch changed after preparation;
- recovery completed and prior reusable authority is now stale;
- an application is asked to collect private authenticator material.

## Related documentation

- [Wallet and Smart Account integration](wallet-and-smart-accounts.md)
- [Capabilities and sessions](capabilities-and-sessions.md)
- [Transaction preparation and simulation](transaction-preparation-and-simulation.md)
- [Wallet recovery and device safety](../users/wallet/recovery-and-device-safety.md)
- [Wallet setup, import and protection](../users/wallet/setup-import-and-protection.md)
