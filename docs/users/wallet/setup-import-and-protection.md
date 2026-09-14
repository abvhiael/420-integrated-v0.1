---
title: Set up, import, and protect an account
audience:
  - user
category: user-guide
status: development
version: current
---

# Set up, import, and protect an account

Use this guide when opening 420 Wallet for the first time, connecting an existing signing identity, discovering a SmartAccount420, or enabling stronger device protection.

## 1. Open a qualified wallet client

Start from a canonical 420 Integrated release or Registry-backed ecosystem link. Do not install a wallet from an unsolicited message or enter secrets into a page because it uses 420 Integrated branding.

Confirm the client identifies the intended network before doing anything that signs or submits a transaction.

## 2. Connect or import the signing identity

The exact setup path depends on the qualified client.

A web-wallet session may use an injected EIP-1193 signing provider. Native clients may use their platform-secure signing store and device authorization flow. The important boundary is the same: **raw signing secrets stay under the wallet/device signing boundary and are not uploaded to RPC, Indexer, Explorer, Registry, dApps, or a 420-operated web server.**

If a client offers an import path for an existing account, follow the client-local import flow only. Never paste a private key or seed phrase into a dApp connection request or support form.

## 3. Discover or select SmartAccount420

420 Wallet may distinguish your currently connected controller address from the portable SmartAccount420 account it controls.

For owner/controller flows, the wallet can discover a deployed SmartAccount420 from canonical account state. For administrative flows where you are acting as another authority, such as a recovery authority, you may need to enter the deployed SmartAccount420 address directly.

Verify the selected account before receiving funds or changing permissions.

## 4. Understand the authorization epoch

SmartAccount420 tracks an authorization epoch. Security-sensitive authorizations can be tied to that epoch so that stale permissions, passkey bindings, or other authorization state cannot silently survive changes that should invalidate them.

If the wallet reports that an authorization is stale, do not work around the warning. Re-authorize or re-enroll through the canonical wallet flow.

## 5. Enable passkeys where supported

Qualified wallet builds may expose WebAuthn passkey support when the runtime configuration enables it and your browser/device supports the required APIs.

The current web path registers a P-256 WebAuthn credential and binds its **public** credential material to the selected SmartAccount420. The private passkey material remains protected by the authenticator/device and is not exported by 420 Wallet.

In the current web client:

1. connect the controlling wallet;
2. select/discover the SmartAccount420;
3. choose **Register + enroll passkey**;
4. complete the operating-system/browser WebAuthn prompt;
5. wait for the enrollment transaction to confirm;
6. verify that the wallet reports the passkey as enrolled for the current authorization epoch.

For passkey execution, the wallet prepares the call, performs the supported simulation path, requests WebAuthn authorization, and submits through the PK42/EntryPoint420 flow.

### Important passkey limitation

The current web client keeps its public passkey binding metadata in browser-session memory. A passkey may therefore need explicit re-enrollment or rebinding in a later session or after an authorization-epoch change, depending on the qualified client and runtime policy.

Do not interpret a device passkey as a replacement for account recovery planning.

## 6. Configure account recovery before you need it

A recovery authority is separate from normal day-to-day signing. Set recovery only to an address or authority arrangement you deliberately control or trust.

The current canonical recovery flow is timelocked rather than instant. A recovery authority may propose a new owner, but finalization waits through the configured safety delay. The current owner can cancel a pending recovery before finalization.

See [Recovery, lost devices, and account safety](recovery-and-device-safety.md) before assigning a recovery authority.

## 7. Review sessions and permissions

After setup, inspect active sessions and capabilities. Remove anything you do not recognize or no longer need.

Good permission hygiene means:

- narrow scope;
- short duration;
- explicit application/target;
- bounded spend where applicable;
- revocation when the task is finished.

## 8. Make a small verification transfer

Before moving a large balance, receive or send a small amount and verify:

- the account address;
- network;
- transaction target;
- value;
- fee estimate;
- resulting activity state.

A successful small transfer confirms basic network and signing configuration, but it does not prove that every future destination is safe.

## Protect your wallet

Use these baseline practices:

- protect the device with a strong local unlock method;
- use biometrics/passkeys only on devices you control;
- keep operating systems and browsers updated;
- do not approve prompts you did not initiate;
- do not store plaintext private keys or seed phrases in cloud notes, chat, email, screenshots, or source code;
- do not leave long-lived dApp sessions active unnecessarily;
- verify recovery authority and pending-recovery state periodically;
- treat clipboard-replaced addresses as a real threat and compare the destination before signing.

## If you are unsure which account is active

Stop before sending. Compare the public address shown by the wallet with the address expected by the recipient or dApp. If SmartAccount420 and controller addresses are both displayed, identify which one the current task expects.

## Related documentation

- [Wallet onboarding](index.md)
- [Permissions and sessions](permissions-and-sessions.md)
- [Recovery and device safety](recovery-and-device-safety.md)
- [Accounts](../../architecture/chain/accounts.md)
