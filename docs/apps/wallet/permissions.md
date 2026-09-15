---
title: 420 Wallet permissions
audience:
  - user
  - developer
category: application
status: development
version: current
---

# 420 Wallet permissions

420 Wallet exposes account authority; it does not invent a separate Wallet permission system. Permission state is canonical only when represented by the relevant account/capability contracts.

## Authority classes

The Wallet may present several distinct forms of authority:

- **owner/controller authority** — high-trust account administration and execution authority;
- **operator authority** — delegated account authority where supported by account policy;
- **capability authority** — explicit reusable permission scoped to defined actions/targets;
- **session authority** — temporary reusable permission bounded by session policy;
- **recovery authority** — authority to initiate/complete the canonical recovery process under its timelock and cancellation rules;
- **passkey authority** — supported authenticator-backed signing authority enrolled under canonical account rules.

These classes must not be collapsed into one generic “connected” state.

## Connection is not permission

Connecting a dApp may disclose the selected account and establish a communication context. It does not by itself authorize transfers, contract calls, reusable spending, session creation or administrative changes.

Any additional authority must be requested and reviewed explicitly.

## Minimum-scope rule

Reusable authority should be bounded by all applicable dimensions:

- target contract/application;
- allowed operation/function/scope;
- maximum value or spend budget;
- token/asset constraints;
- duration/expiry;
- session identity;
- network/chain identity;
- account authorization epoch.

A request that cannot explain its scope should not be granted as reusable authority.

## Grant flow

Before a capability/session grant, the Wallet should show enough information for the user to understand:

1. who is requesting authority;
2. which account is affected;
3. which target(s) can be called;
4. which operations are permitted;
5. any value/spend limit;
6. expiry/duration;
7. whether the grant is revocable;
8. whether a later authorization-epoch change invalidates it.

## Revocation

Revocation must reach canonical account/capability state. Removing an application from a recent-connections UI is not sufficient if reusable authority remains active.

After suspected compromise, users should revoke the affected authority and, where appropriate, rotate/invalidate broader account authorization state according to the canonical account model.

## Developer rule

Integrations must treat authorization as fail-closed. Cached UI state, a previously successful session, a stale capability read or a remembered connection must never substitute for current canonical authorization.

## User task guide

For step-by-step permission/session management, use [Permissions and sessions](../../users/wallet/permissions-and-sessions.md).
