---
title: 420 Wallet getting started
audience:
  - user
category: application
status: development
version: current
---

# 420 Wallet getting started

DOC-6 already contains the canonical step-by-step onboarding flow for 420 Wallet. This page is the application-manual entry point and intentionally links to that flow rather than maintaining a second copy.

## First session

Follow these guides in order when setting up or discovering an account for the first time:

1. [Wallet onboarding](../../users/wallet/index.md)
2. [Setup, import and protection](../../users/wallet/setup-import-and-protection.md)
3. [Send, receive and activity](../../users/wallet/send-receive-and-activity.md)
4. [Connect applications](../../users/wallet/dapp-connections.md)
5. [Signing and transaction review](../../users/wallet/signing-and-transaction-review.md)
6. [Permissions and sessions](../../users/wallet/permissions-and-sessions.md)
7. [Recovery and device safety](../../users/wallet/recovery-and-device-safety.md)

## Before authorizing value or permissions

Confirm the selected 420 Integrated network, account address, target application/contract, value, requested capability scope, expiry and transaction simulation where supported. A Wallet connection is not itself authorization to spend funds or act on the account.

## Canonical source of truth

The Wallet is a client. Account ownership, capability grants, sessions, revocation and recovery are canonical only when reflected in the relevant on-chain account/protocol state. If the UI disagrees with canonical chain state, treat the UI as stale or faulty and verify through another qualified source before authorizing a new action.
