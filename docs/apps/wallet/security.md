---
title: 420 Wallet security
audience:
  - user
  - developer
category: application
status: development
version: current
---

# 420 Wallet security

420 Wallet is a high-trust client because it presents signing and reusable account authority. Its security model depends on keeping signing material at the user/account boundary and preserving canonical account rules even when client infrastructure is compromised.

## Secrets the Wallet ecosystem must never request

Never disclose:

- private keys;
- seed/recovery phrases;
- passkey private material;
- raw signing secrets;
- authentication recovery codes;
- private recovery secrets;
- Engine/JWT infrastructure credentials.

A support agent, dApp, Registry entry, RPC provider, Indexer or Explorer does not need those secrets to diagnose ordinary Wallet problems.

## Signing boundary

A 420-operated web server must not possess user signing keys and must not be able to auto-sign. The client may construct and explain an action; authorization must cross the canonical account/signing boundary.

## Phishing and destination verification

Branding and URL appearance are not canonical identity. Core destinations should be reached through official repository links, Registry-backed discovery or signed/versioned ecosystem manifests. Treat links from unsolicited messages, ads and social-media replies as untrusted until independently verified.

## Permission review

Reusable capability/session requests are security-sensitive. Review target, scope, spend/value limits, expiry and revocability. Reject broad authority that is not required for the task.

## Transaction review

Before authorizing a transaction, inspect:

- account and network;
- target address/application;
- native value;
- token/assets affected;
- function/action where decoded;
- simulation result where supported;
- approvals or reusable authority created;
- network/protocol fees.

Simulation improves review but does not guarantee future state or economic outcome.

## Recovery security

Recovery is not instant support intervention. The canonical recovery flow is timelocked and should preserve the owner's opportunity to cancel a malicious or mistaken recovery where the protocol permits it.

Support must never claim it can bypass canonical recovery rules.

## Compromised device/client response

If a device or Wallet client may be compromised:

1. stop approving new actions on that device;
2. use a clean qualified client/device where possible;
3. verify current account state;
4. revoke suspicious sessions/capabilities;
5. rotate/invalidate authority as supported by the account model;
6. inspect pending/recent transactions and recovery state;
7. preserve public transaction hashes/error information for incident analysis without sharing secrets.

## Infrastructure compromise

A compromised RPC, Indexer or web frontend may misrepresent data or destinations, but it must not gain signing authority merely by being infrastructure. Qualified clients should cross-check critical identity/state and fail closed when required security information cannot be established.

## Finality and stale data

Do not treat a newly observed transaction as irreversible solely because the Wallet UI displays it. Use canonical/safe/finalized semantics appropriate to the action.

## Related user guides

- [Signing and transaction review](../../users/wallet/signing-and-transaction-review.md)
- [Permissions and sessions](../../users/wallet/permissions-and-sessions.md)
- [Recovery and device safety](../../users/wallet/recovery-and-device-safety.md)
