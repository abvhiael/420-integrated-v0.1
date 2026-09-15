---
title: Manage permissions and sessions
audience:
  - user
category: user-guide
status: development
version: current
---

# Manage permissions and sessions

420 Wallet uses the canonical SmartAccount420 and CapabilityRegistry420 authorization model. Applications should receive only the authority they need, for only as long as they need it.

## Permission types

A qualified wallet may show several kinds of authority:

- **owner authority** — the strongest normal account-control authority;
- **operator authority** — delegated operational authority defined by account policy;
- **capabilities** — scoped reusable permissions for specific actions or resources;
- **sessions/session keys** — temporary authorization intended to reduce repeated prompts for bounded activity;
- **recovery authority** — separate authority used only for the timelocked recovery path;
- **passkey binding** — a supported device credential bound to the account's current authorization epoch.

These are not interchangeable. A dApp that needs a narrow capability should not receive owner or recovery authority.

## Review a permission request

Before granting a reusable permission, identify:

1. **who** receives it;
2. **what** actions it permits;
3. **which** targets/assets it covers;
4. **how much** value it can move, if any;
5. **when** it expires;
6. **whether** it can create further authority;
7. **how** you revoke it.

Reject requests that are broader than the task requires.

## Sessions

Sessions are useful when an application needs repeated bounded actions, such as gameplay or a multi-step workflow. They should reduce approval fatigue without turning convenience into permanent account control.

Good session policy is:

- application-specific;
- scope-limited;
- amount-limited where money is involved;
- time-limited;
- non-transferable unless explicitly designed otherwise;
- revocable;
- invalidated when relevant account authorization changes.

## Authorization epoch

SmartAccount420 maintains an authorization epoch. Qualified wallet/runtime logic can use the epoch to prevent stale authorizations from silently surviving security-sensitive account changes.

If a passkey, session, or other binding reports an old epoch, treat it as stale. Re-enroll or create a new authorization through the qualified flow instead of bypassing the check.

## Revoke permissions you no longer need

Review active permissions periodically and revoke:

- applications you no longer use;
- expired workflows that remain visible;
- sessions created for a one-time task;
- permissions with unexpectedly broad scope;
- authorization associated with a lost device;
- anything you do not recognize.

Disconnecting a website does not necessarily revoke on-chain authorization. Use the wallet's canonical permission/session management action when revocation is required.

## Spending permissions

When a capability/session can move value, look for explicit limits and target restrictions.

Prefer a permission that allows “up to X for this application until time Y” over one that grants indefinite or unlimited spending authority.

Do not assume a zero-value transaction is harmless. It may be the transaction that grants future spending authority.

## App upgrades and changed destinations

An application may change frontend URLs, contracts, or service endpoints over time. A verified destination change does not automatically justify keeping every old authorization active.

If an application is deprecated, compromised, or revoked in the ecosystem manifest/Registry, stop using it and inspect related permissions.

## Security incident checklist

If you suspect a permission has been abused:

1. stop using the affected application;
2. revoke the related session/capability if you still control the account;
3. review recent transactions;
4. review owner/operator/recovery state;
5. remove authorization associated with a lost or compromised device;
6. use the recovery flow if normal account authority is no longer trustworthy.

## What administrators cannot do

A wallet UI, Registry administrator, support service, RPC provider, Indexer, Explorer, or ordinary dApp administrator must not be able to silently manufacture account capabilities or override SmartAccount420 authorization.

If a service claims it needs your private signing material to “clear” a permission, do not provide it.

## Related documentation

- [Connect applications safely](dapp-connections.md)
- [Review and sign safely](signing-and-transaction-review.md)
- [Recovery and device safety](recovery-and-device-safety.md)
