---
title: Recovery, lost devices, and account safety
audience:
  - user
category: user-guide
status: development
version: current
---

# Recovery, lost devices, and account safety

Account recovery is a security-critical SmartAccount420 operation. Configure it before you need it, understand the timelock, and never treat recovery authority as ordinary dApp permission.

## Canonical recovery model

The current wallet exposes a timelocked recovery flow with these roles:

- **current owner** — may set/update the recovery authority and may cancel a pending recovery before finalization;
- **recovery authority** — may propose a new owner and, after the safety delay expires, finalize that recovery;
- **proposed new owner** — the address that will become owner only after valid finalization.

The current web recovery UI presents a **two-day safety delay**. The wallet reads the canonical executable time/countdown from SmartAccount420 state rather than assuming a local timer controls recovery.

## Set or update a recovery authority

1. Open the qualified wallet's recovery-management surface.
2. Select or discover the SmartAccount420.
3. Verify the current owner and recovery state.
4. Enter the intended recovery-authority address.
5. Review the simulated change.
6. Approve the transaction.
7. Wait for confirmation and verify the canonical recovery authority after confirmation.

Choose a recovery authority you can still access if your normal signing device is lost, but protect it separately enough that one compromise does not defeat both normal signing and recovery.

## Recover after losing normal owner access

If the recovery authority is intact:

1. open the qualified recovery-management surface;
2. enter the affected SmartAccount420 address if it cannot be auto-discovered from the recovery authority;
3. enter the proposed new owner address;
4. submit **Propose recovery**;
5. verify the pending owner and canonical executable time;
6. wait through the full safety delay;
7. after the wallet reports **Ready to finalize**, submit **Finalize recovery**;
8. verify the new canonical owner and authorization state.

Do not trust a local clock or screenshot as proof that the timelock expired. The wallet must rely on canonical account state.

## Cancel a malicious or mistaken recovery

If you still control the current owner and a pending recovery is wrong:

1. open recovery management immediately;
2. verify the SmartAccount420 and pending owner;
3. choose **Cancel pending recovery**;
4. review/simulate the cancellation;
5. approve it;
6. verify canonical state after confirmation.

The timelock exists specifically to create this response window before ownership can change.

## Lost phone or computer

A lost device does not automatically mean the account is lost, but treat it as a security event.

From another trusted device:

1. determine whether the lost device held active signing authority, session keys, passkeys, or reusable capabilities;
2. revoke or replace affected sessions/capabilities where possible;
3. inspect recent transactions;
4. inspect owner and recovery state;
5. rotate/re-enroll device-bound authorization if the wallet reports stale or compromised state;
6. use recovery only if normal owner authority is unavailable or untrustworthy.

If your operating system or account ecosystem supports remote device lock/erase, use it as an additional device-security measure. Do not rely on remote erase as the only account-layer response.

## Passkeys and lost devices

Passkey private material is managed by the platform authenticator and is not exported by the wallet. However, a lost device can still affect availability or security depending on how the platform stores/synchronizes credentials.

Review account-side passkey state after loss. If the authorization epoch changes or the binding becomes stale, re-enroll explicitly through the qualified wallet flow.

A passkey is not the same thing as a recovery authority.

## Compromised account signs

If you see transactions you did not authorize:

- stop using suspicious dApps;
- revoke suspicious capabilities/sessions;
- inspect owner/operator/recovery configuration;
- move to a trusted device;
- if owner authority may be compromised and recovery remains trustworthy, use the canonical timelocked recovery path;
- preserve transaction hashes and public evidence for incident analysis.

Do not send funds to a “safe address” supplied by unsolicited support contacts.

## Recovery safety rules

- Recovery authority must never be granted through an ordinary dApp connection without deliberate account-management intent.
- The pending new owner must be verified carefully before proposal.
- The safety delay must never be bypassed by UI, RPC, Indexer, operator, or support service.
- A local client must not mark recovery finalized before canonical SmartAccount420 state does.
- Every supported recovery mutation should be simulated before approval and canonical state re-read after confirmation.
- Recovery secrets/signing material remain private; public account addresses and transaction hashes are safe diagnostic data.

## When recovery is unavailable

If recovery is disabled or no valid recovery authority was configured before owner access was lost, the wallet cannot invent authority to restore the account. That is a deliberate security property.

Use only documented canonical recovery mechanisms. A support agent, validator, RPC operator, Registry admin, Explorer operator, or dApp developer cannot override SmartAccount420 ownership for you.

## Related documentation

- [Set up, import, and protect an account](setup-import-and-protection.md)
- [Permissions and sessions](permissions-and-sessions.md)
- [Troubleshooting](troubleshooting.md)
