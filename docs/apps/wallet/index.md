---
title: 420 Wallet
audience:
  - user
  - developer
category: application
status: development
version: current
---

# 420 Wallet

420 Wallet is the primary account, authorization and ecosystem-navigation application for 420 Integrated. It presents canonical Smart Account state and lets users safely construct, review and authorize account actions without creating a second custody, identity or permission system.

The Genesis release is a web client. Future browser-extension, mobile and desktop clients may present different interfaces, but all qualified clients must reuse the same `SmartAccount420`, recovery, capability, session and revocation semantics.

## Authority

**420 Wallet is a replaceable user client over canonical account/protocol state.**

It may read chain/indexer data, build transactions, simulate supported actions, request signatures, explain capability requests and navigate to registered ecosystem services. It is not consensus-critical and must not become canonical authority for balances, ownership, permissions, identity, application legitimacy or finality.

Canonical account authority remains with the relevant on-chain account and authorization contracts, including `SmartAccount420` and `CapabilityRegistry420`.

## Start here

The complete task-oriented Wallet journey was built in DOC-6 and remains canonical. Use those guides rather than duplicating them here:

- [Wallet onboarding](../../users/wallet/index.md)
- [Setup, import and protection](../../users/wallet/setup-import-and-protection.md)
- [Send, receive and activity](../../users/wallet/send-receive-and-activity.md)
- [Connect applications](../../users/wallet/dapp-connections.md)
- [Signing and transaction review](../../users/wallet/signing-and-transaction-review.md)
- [Permissions and sessions](../../users/wallet/permissions-and-sessions.md)
- [Recovery and device safety](../../users/wallet/recovery-and-device-safety.md)
- [Troubleshooting](../../users/wallet/troubleshooting.md)

## Application package

Use the DOC-8 application pages for the broader Wallet model:

- [Getting started](getting-started.md)
- [User guide](user-guide.md)
- [Concepts](concepts.md)
- [Architecture](architecture.md)
- [Permissions](permissions.md)
- [Fees](fees.md)
- [Security](security.md)
- [Troubleshooting](troubleshooting.md)
- [FAQ](faq.md)
- [Developer integration](developer/index.md)

## What the Wallet can do

A qualified Wallet client can:

- discover and display the user's canonical Smart Account;
- show native `$420`, assets and relevant account activity;
- construct supported account transactions and batches;
- simulate supported mutations before authorization;
- request owner, passkey, operator, capability or session authorization as appropriate;
- display and revoke reusable permissions;
- guide users through supported recovery flows;
- resolve core ecosystem destinations through Registry-backed or signed/versioned discovery;
- expose 420Docs and Developer Hub as first-class help/integration destinations.

## What the Wallet must never do

A qualified client must not:

- store user private signing keys on a 420-operated server;
- silently sign, auto-sign or silently grant reusable capabilities;
- bypass Smart Account authorization policy;
- claim that UI state overrides canonical chain state;
- treat a URL alone as proof that an application is canonical or safe;
- expose private signing, passkey or recovery material to support services;
- convert a connection into spending authority without an explicit canonical grant.

## Related documentation

- [420 Wallet architecture source](../../420WALLET.md)
- [Chain accounts](../../architecture/chain/accounts.md)
- [Transactions](../../architecture/chain/transactions.md)
- [Gas, fees and native `$420`](../../architecture/chain/gas-fees-native-420.md)
- [Registry, Names, Identity and 420-IS](../../architecture/protocols/registry-names-identity-420is.md)
