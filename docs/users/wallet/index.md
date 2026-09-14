---
title: 420 Wallet onboarding
audience:
  - user
category: user-guide
status: development
version: current
---

# 420 Wallet onboarding

420 Wallet is the primary user-facing account and authorization client for 420 Integrated. It lets you view and use your account, send and receive native `$420`, review and approve transactions, connect applications, manage permissions and sessions, use supported passkeys, and manage account recovery.

This guide is task-oriented. You do not need to understand validators, Engine API, consensus, or smart-contract internals to use the wallet safely.

## What the wallet is

420 Wallet is a client for the canonical 420 Integrated account system. The underlying account and authorization rules live in `SmartAccount420`, related account contracts, and `CapabilityRegistry420`. The wallet does not create a second custody or permission system.

That distinction matters because your account state remains portable across qualified 420 Wallet clients. The Genesis web client, browser-extension client, and native mobile clients may present different interfaces, but they must respect the same account, capability, session, recovery, and revocation rules.

## Which client should I use?

Use the qualified 420 Wallet client that fits your device and release channel.

- **Genesis web wallet** — full account-management surface and ecosystem gateway. It relies on a connected signing wallet or supported account-signing path and never stores your signing key on a 420-operated server.
- **Browser extension** — intended for frequent dApp connection and approval flows when the qualified extension release is available.
- **Mobile wallet** — intended for portable authorization, QR/deep-link handoff, passkeys/biometrics, device security, and mobile application use when the qualified release is distributed.

Never install a wallet from a link supplied only by a social-media post, direct message, search advertisement, or unsolicited support message. Use a destination published through the official 420 Integrated repository, Registry-backed ecosystem discovery, or another canonical release channel.

## Before you start

Have the following ready:

1. a supported browser or mobile platform;
2. access to the account or signing method you intend to use;
3. a private place to complete security or recovery setup;
4. enough native `$420` for any transaction that requires network fees;
5. the correct 420 Integrated network configuration.

For testnet use, make sure the wallet identifies the intended test network before signing. Chain ID alone is not enough to prove a site or RPC endpoint is trustworthy; use the wallet's qualified network configuration and canonical service links.

## Your first safe session

A good first session follows this order:

1. open the qualified wallet client;
2. confirm the displayed network;
3. connect or discover your account;
4. verify the account address before receiving funds;
5. review recovery and device-security options;
6. send a small test amount before making a large transfer;
7. inspect the permissions page before connecting unfamiliar applications.

The wallet should never require you to send your private key, seed phrase, raw signing secret, recovery secret, or passkey private material to a website, administrator, support agent, Registry entry, dApp, or RPC provider.

## Canonical account versus controller

Some 420 Integrated flows distinguish the **controller/signing identity** you currently use from the deployed **SmartAccount420 address** that holds portable account authority. The wallet may discover the SmartAccount420 associated with your controller or ask you to enter a deployed account address for administrative tasks such as recovery.

When copying an address, confirm which address the destination expects. Sending assets to the wrong valid address is still a valid blockchain transaction and may not be reversible.

## What the wallet can verify

A qualified wallet can help you verify:

- network identity and configured RPC transport;
- canonical SmartAccount420 state;
- balances and transaction state from the chain/indexing stack;
- requested transaction target, value, and calldata;
- simulation results before supported mutations;
- current permissions, sessions, recovery authority, and authorization epoch;
- Registry/signed-manifest destinations for core ecosystem services.

A wallet cannot prove that every third-party application is honest or that every transaction is economically wise. You are still authorizing the action shown to you.

## Core tasks

Continue with the task you need:

- [Set up, import, and protect an account](setup-import-and-protection.md)
- [Send and receive `$420`](send-receive-and-activity.md)
- [Connect applications](dapp-connections.md)
- [Review and sign safely](signing-and-transaction-review.md)
- [Manage permissions and sessions](permissions-and-sessions.md)
- [Recovery, lost devices, and account safety](recovery-and-device-safety.md)
- [Troubleshoot wallet problems](troubleshooting.md)

## Safety rules to remember

- Signing stays at the wallet/account boundary. RPC, Indexer, Explorer, apps, and support services are not signing authorities.
- A connected application does not automatically receive permission to spend funds or perform arbitrary actions.
- A capability or session should be no broader or longer-lived than necessary.
- Supported high-risk changes should be simulated and clearly reviewed before approval.
- Recovery changes are security-critical. The current canonical recovery flow uses a timelock and must not be treated as instant account transfer.
- A pending or recently submitted transaction is not the same as a finalized transaction.
- An official-looking URL alone is not proof of legitimacy.

## Getting help safely

When asking for support, share only information that is safe to publish, such as a transaction hash, public account address, error message, wallet version, operating-system/browser version, or the name of the network you selected.

Never share a seed phrase, private key, passkey private material, signing secret, backup secret, authentication recovery code, or an approval request that you do not understand.

## Related documentation

- [420 Wallet architecture](../../420WALLET.md)
- [Chain accounts](../../architecture/chain/accounts.md)
- [Transactions](../../architecture/chain/transactions.md)
- [Gas, fees, and native `$420`](../../architecture/chain/gas-fees-native-420.md)
