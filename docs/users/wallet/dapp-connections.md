---
title: Connect applications safely
audience:
  - user
category: user-guide
status: development
version: current
---

# Connect applications safely

Connecting a dApp lets an application learn limited wallet/account information and request actions from you. A connection is not the same thing as giving the application unlimited control.

## Start from a verified destination

Prefer applications opened from the 420 Wallet ecosystem gateway, 420 AppStore, 420 Registry-backed discovery, or another canonical 420 Integrated source.

A familiar logo, copied interface, HTTPS certificate, or plausible domain name is not enough to prove that a site is canonical.

## What a connection may expose

Depending on the client and permission request, a connection may expose:

- the selected public account address;
- current chain/network identity;
- supported wallet capabilities;
- permission/session information explicitly authorized for that application.

A normal dApp connection must not require your private key, seed phrase, passkey private material, or recovery secret.

## Connect step-by-step

1. Open the application from a trusted source.
2. Choose **Connect wallet**.
3. Confirm that the wallet prompt names the application/origin you intended to use.
4. Review which account and network will be exposed.
5. Review any requested capability or session scope separately.
6. Approve only what you understand.

If the application immediately asks for a signature or transaction after connecting, treat that as a new authorization decision. Do not assume it is harmless because you just connected successfully.

## Connection versus capability

A dApp can be connected without receiving a reusable capability to perform sensitive operations.

A **capability** is a bounded authorization recognized by the canonical account/capability system. It may constrain target, action, duration, spend, or other policy. Capabilities should be explicit, narrow, and revocable.

A **session** is a temporary authorization context intended to reduce repeated prompts for a bounded task. Sessions must not silently become permanent owner authority.

See [Permissions and sessions](permissions-and-sessions.md) before granting reusable authorization.

## Review every high-risk request

Pay special attention to requests involving:

- token approvals or spending limits;
- transfers;
- swaps or bridges;
- staking or governance actions;
- capability grants;
- session creation;
- owner/operator/recovery changes;
- arbitrary contract calls;
- batch execution.

A transaction can have zero native `$420` value while still changing valuable permissions.

## Network mismatch

If the dApp expects a different chain than the wallet currently uses, stop and switch only through a qualified network-selection flow. Do not approve an unknown RPC endpoint simply because the dApp suggests it.

The wallet should validate configured 420 Integrated network identity instead of treating arbitrary endpoint metadata as authoritative.

## Disconnecting

Disconnect when you are done with an unfamiliar or one-time application. Then inspect active sessions/capabilities and revoke reusable authorization you no longer need.

Disconnecting a website UI does not necessarily revoke an on-chain capability that was previously granted. Revocation must occur at the canonical account/capability layer when applicable.

## If a dApp looks compromised

Do not approve additional prompts. Close the site, inspect wallet permissions, revoke suspicious capabilities/sessions, and review recent account activity.

If you already approved an owner, recovery, or high-value permission change, treat the event as a security incident and move directly to [Recovery and device safety](recovery-and-device-safety.md).

## Related documentation

- [Permissions and sessions](permissions-and-sessions.md)
- [Signing and transaction review](signing-and-transaction-review.md)
- [Troubleshooting](troubleshooting.md)
