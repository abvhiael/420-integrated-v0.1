---
title: Review and sign safely
audience:
  - user
category: user-guide
status: development
version: current
---

# Review and sign safely

A wallet signature can authorize a transfer, contract call, capability grant, session, account-management action, or other state change. Treat the review screen as the final checkpoint before your authority is used.

## Before approving

Confirm all of the following where the wallet can display them:

- selected account;
- network;
- application/origin;
- target address or contract;
- native `$420` value;
- requested method/action;
- token or spending amount;
- capability/session scope;
- expiry or deadline;
- fee estimate;
- simulation result;
- any owner, operator, recovery, or authorization-epoch effect.

If a field is unclear, reject the request and identify it before continuing.

## Simulation is a safety check, not a guarantee

Supported 420 Wallet mutation paths simulate before asking for approval. Recovery-management operations, for example, are simulated before wallet approval and canonical state is re-read after confirmation.

Simulation can detect many failures and unexpected effects, but it cannot guarantee the future state of the chain. State can change between simulation and inclusion, so a transaction may still fail or behave differently if its assumptions become stale.

## Message signatures versus transactions

A message signature does not directly execute an EVM transaction, but it can still be valuable authorization. A signed message may be used for login, permits, typed-data approvals, off-chain orders, or protocol-specific authorization.

Do not sign opaque data simply because no gas fee is shown.

## Contract transactions

For contract calls, pay attention to both **value** and **calldata/action**. A zero-value transaction can still:

- approve token spending;
- transfer an NFT or other asset;
- grant a capability;
- create a session;
- change account configuration;
- vote;
- bridge or lock assets;
- execute a batch.

## Batch execution

A batch can contain multiple calls under one approval. Review every item, not only the first or the total value.

Reject a batch if it includes an unfamiliar target, unexplained approval, unexpected permission change, or an action unrelated to the task you initiated.

## Passkey signing

Where passkey execution is enabled, the current web path uses WebAuthn ES256/P-256 authorization and PK42/EntryPoint420 transport. The wallet prepares the requested call, requires a current valid binding to the SmartAccount420 authorization epoch, and uses the device/browser authenticator rather than exporting a passkey private key.

A biometric or passkey prompt should still correspond to a transaction you reviewed. Device authentication is not a substitute for understanding the transaction.

## Confirm after execution

After a submitted mutation confirms, qualified wallet flows should re-read canonical state where appropriate. You should verify the resulting state too, especially after:

- permission changes;
- session creation/revocation;
- recovery changes;
- owner/operator changes;
- swaps/bridges;
- high-value transfers.

## Red flags

Reject the request if:

- it appeared without an action you initiated;
- the destination differs from the one you entered;
- the requested value changed;
- the application origin is unfamiliar;
- the wallet reports a network mismatch;
- simulation fails;
- a supposedly simple login asks for an unlimited spend approval;
- a site asks you to reveal a seed phrase/private key to “verify” the wallet;
- support staff ask you to sign a transaction to repair or unlock your account.

## If you signed something suspicious

1. stop interacting with the application;
2. inspect recent transactions;
3. inspect active capabilities and sessions;
4. revoke suspicious reusable authorization;
5. inspect owner/recovery state;
6. if account authority may be compromised, follow the recovery/security incident guidance immediately.

## Related documentation

- [Connect applications safely](dapp-connections.md)
- [Permissions and sessions](permissions-and-sessions.md)
- [Recovery and device safety](recovery-and-device-safety.md)
- [Transactions](../../architecture/chain/transactions.md)
