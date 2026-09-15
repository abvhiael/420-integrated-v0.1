---
title: Wallet and Smart Account integration
audience:
  - developer
category: developer
status: development
version: current
---

# Wallet and Smart Account integration

420 Wallet is the user-authorization boundary for dApps. A connected application may learn the selected account, network and supported capabilities, but connection alone never grants authority to spend, sign or execute protocol actions.

The canonical user account is `SmartAccount420`. A wallet client is replaceable presentation/runtime software over that account and its supporting protocol contracts.

## Integration sequence

A safe dApp integration is:

1. discover and verify the intended network;
2. connect through a qualified Wallet surface;
3. resolve the selected Smart Account and confirm deployed code;
4. read the live account authority state needed for the intended action;
5. prepare a bounded transaction or capability request;
6. present that request to Wallet for simulation/review;
7. obtain explicit authorization through the Wallet/Smart Account boundary;
8. submit through the qualified account path;
9. confirm the transaction and resulting state from canonical chain sources.

Do not ask the application to collect private keys, mnemonics, passkey private material or Wallet signing secrets.

## Connection is not authorization

A connection may expose public context such as account address, chain identity and feature support. It must not be treated as:

- permission to transfer native `$420` or tokens;
- permission to call arbitrary contracts;
- permission to create a session key;
- permission to create or use a reusable capability;
- permission to register a passkey;
- permission to alter recovery settings;
- proof that a previously granted capability is still live.

Applications should request authorization only when needed and should bind requests to the narrowest target, selector, amount and time window supported by the intended action.

## Canonical account state

Before a security-sensitive write, applications or Wallet tooling should be prepared to re-read relevant Smart Account state, including where applicable:

- `owner`;
- `entryPoint`;
- canonical `capabilityRegistry` binding;
- `authorizationEpoch`;
- `authorizationPolicyVersion`;
- recovery state;
- passkey verifier state;
- session-key epoch state.

Cached account metadata is presentation state. Live canonical contract state controls authorization.

## Owner execution and account abstraction

`SmartAccount420.execute()` and `executeBatch()` are restricted to the account owner or the configured EntryPoint. A dApp therefore prepares call intent; it does not directly gain account execution rights.

UserOperation-based flows are validated by `SmartAccount420.validateUserOp()` through the account's configured EntryPoint. Owner ECDSA, owner-level passkey and session-key paths have different validation rules and nonce lanes.

Applications should let the qualified Wallet runtime choose the correct account execution transport.

## Authorization epochs

`authorizationEpoch` is a global invalidation boundary for reusable account authorization.

An epoch change can invalidate session keys and make enrolled passkeys stale. It occurs for security-sensitive account changes including global revocation, qualifying policy-version changes, passkey-verifier replacement after initial setup, and completed account recovery.

Applications must not assume that a capability or session that was valid at connection time remains valid indefinitely. Reusable authority should be revalidated at use time.

## Failure behavior

Fail closed when:

- network identity is ambiguous;
- the expected Smart Account is not deployed;
- the account is bound to an unexpected EntryPoint or capability registry;
- the account owner or authorization epoch changed after preparation;
- requested permissions exceed the intended operation;
- Wallet simulation reports a revert or material state change;
- a capability/session has expired, been revoked or no longer matches the current epoch.

## Related documentation

- [First read and Wallet-authorized write](first-read-write.md)
- [Transaction preparation and simulation](transaction-preparation-and-simulation.md)
- [Capabilities and sessions](capabilities-and-sessions.md)
- [Passkeys and recovery-aware integrations](passkeys-and-recovery.md)
- [420 Wallet application manual](../apps/wallet/index.md)
- [Wallet user onboarding](../users/wallet/index.md)
