---
title: Wallet contextual help contract
audience:
  - user
  - developer
category: wallet
status: current
version: current
---

# DOC-14.3 — Wallet contextual help

DOC-14.3 defines the stable contextual-help surface for 420 Wallet. Wallet runtime code refers to stable contextual-link IDs; the registry resolves those IDs to canonical 420Docs targets under DOC-13 environment/version authority.

The Wallet must not hard-code alternate recovery instructions, redefine Smart Account authority, treat a passkey as equivalent to every owner/recovery authority, or infer that a documentation link proves transaction, account, deployment or network state.

## Wallet contextual map

| Runtime surface or state | Contextual ID | Canonical target | Purpose |
| --- | --- | --- | --- |
| New wallet, import, account protection, passkey enrollment | `CTX-WALLET-001` | `users/wallet/setup-import-and-protection.md` | Safe setup/import and baseline protection |
| Send, receive, pending activity, receipt/finality review | `CTX-WALLET-002` | `users/wallet/send-receive-and-activity.md` | Value movement and activity states |
| Generic wallet failure or unresolved wallet symptom | `CTX-WALLET-003` | `users/wallet/troubleshooting.md` | Wallet troubleshooting entry point |
| Connect/disconnect dApp, network mismatch, connection approval | `CTX-WALLET-004` | `users/wallet/dapp-connections.md` | dApp connection boundaries |
| Signature request, simulation, transaction review, message signing | `CTX-WALLET-005` | `users/wallet/signing-and-transaction-review.md` | Safe signing review |
| Capability, session, operator permission, revocation, spend scope | `CTX-WALLET-006` | `users/wallet/permissions-and-sessions.md` | Reusable authorization controls |
| Lost device, owner loss, recovery initiation/cancellation, re-enrollment | `CTX-WALLET-007` | `users/wallet/recovery-and-device-safety.md` | Recovery and device-safety workflow |
| Wallet home/help overview when no narrower state applies | `CTX-WALLET-008` | `users/wallet/index.md` | Neutral Wallet documentation entry |

These IDs are semantic contracts. Wallet UI text may change, but the meaning of an existing ID must not be reassigned to a different help topic.

## Required runtime behavior

Wallet should expose the narrowest applicable contextual ID for a visible state. For example, a signature-review screen uses `CTX-WALLET-005`; it should not send the user to generic troubleshooting merely because the request might later fail.

Contextual help is informational and must not change execution behavior. Opening or failing to open documentation must never:

- approve or reject a transaction automatically;
- alter fee or nonce selection;
- change chain/network identity;
- grant, extend or revoke capabilities;
- enroll or replace a passkey;
- start, cancel or finalize account recovery;
- mark a pending transaction as final;
- suppress a security warning.

## Smart Account authority boundary

A contextual link may explain Smart Account roles and permissions, but it does not establish them. Wallet must derive active owner/operator/session/recovery authority from canonical account state and supported Wallet logic.

If documentation and runtime state appear to disagree, runtime code must fail safely and the user should be directed to troubleshooting/support rather than having documentation text override canonical account state.

## Passkey boundary

Passkey help may explain enrollment, re-enrollment and signing UX, but the existence of a passkey-related documentation target does not prove that a device is enrolled, trusted, current or authorized for the requested operation.

Wallet must continue to enforce the configured authorization epoch, account policy and device/passkey checks independently of contextual help.

## Recovery boundary

`CTX-WALLET-007` points to the canonical Wallet recovery guidance. Wallet must not embed a competing recovery procedure that skips the documented timelock, owner-cancellation path, authority checks or post-recovery verification.

For suspected compromise, uncertain ownership or ambiguous recovery state, the Wallet should preserve the safest runtime state, expose the canonical recovery/help target and avoid irreversible automatic remediation.

## Value and signing safety

For value-changing and signature-producing states, help links must be supplementary to the Wallet's own review UI. The application must still show the relevant destination, value, fee, network, requested permissions and simulation/transaction details required by the Wallet flow.

A help page is never a substitute for transaction simulation, canonical receipt/finality checks, verified destination checks or permission review.

## Environment behavior

All Wallet contextual records currently permit only `development` and `genesis`, matching published DOC-13 tracks. Testnet and mainnet contextual Wallet help remain unavailable until those documentation tracks are published.

The resolver must not silently redirect an unpublished testnet/mainnet request to development or Genesis documentation. A generic unavailable-help state is safer than cross-environment substitution.

## Failure and fallback

If a Wallet contextual ID cannot resolve safely:

1. keep the runtime action/state unchanged;
2. show a neutral help-unavailable state;
3. optionally offer the generic Wallet/420Docs entry for the same published environment;
4. never fabricate a target URL;
5. never weaken signing, authorization, recovery or network checks to preserve help-link availability.

## DOC-14.3 invariants

DOC-14.3 is satisfied when:

- setup/import/protection, send/receive/activity, dApp connection, signing, permissions/sessions, recovery/device safety and troubleshooting all have stable contextual IDs;
- each ID maps to the canonical existing Wallet guide rather than duplicated application help text;
- a neutral Wallet overview target exists for states without a narrower match;
- Smart Account, passkey and recovery authority remain runtime/canonical-state responsibilities rather than documentation authority;
- all Wallet targets remain constrained to currently published development/Genesis documentation environments.
