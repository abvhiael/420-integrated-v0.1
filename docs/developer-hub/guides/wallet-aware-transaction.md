# Wallet-aware transaction

This guide covers the correct state-changing integration path: application code prepares intent, while 420 Wallet or a qualified smart-account runtime owns authorization, signing and submission.

## Goal

Build a dApp interaction that:

- binds to the selected network and canonical contract catalogue;
- prepares protocol calldata with the shared SDK;
- checks the wallet/account capability boundary;
- never asks Developer Hub to store or expose raw signing secrets;
- confirms the submitted transaction from canonical chain RPC;
- uses 420Indexer only for post-submission UX and history.

## 1. Bind the application to the selected network

```text
420 network
420 contract <ContractName>
420 wallet-contracts
```

Reject chain mismatch before constructing a state-changing flow. Do not silently retarget a prepared interaction to another chain.

**Authority:** selected network manifest, canonical contract catalogue, Wallet/Smart Account contracts.

## 2. Prepare the call

Use the shared SDK and verified interface metadata to encode the intended contract call. Application code may construct intent, parameters and human-readable previews.

Prepared calldata is **not authorization** and is not proof that an account may execute the operation.

**Authority:** application for intent construction only.

## 3. Enter the wallet capability boundary

Hand the prepared operation to the qualified Wallet/smart-account runtime. The wallet layer owns:

- active account identity;
- selected chain validation;
- user approval;
- capability checks;
- smart-account/session authorization rules;
- signing and transaction submission.

Developer Hub must not accept, import, derive, persist or print raw private keys, mnemonics, seed phrases or authorization secrets.

**Authority:** 420 Wallet / Smart Account runtime and canonical authorization contracts.

## 4. Submit with explicit authorization

The user or account policy authorizes the transaction through the wallet path. A dApp must not interpret a prior Indexer row, local UI state or cached capability as sufficient permission.

If capability state matters, re-read it through the owning canonical contract/runtime before submission.

## 5. Confirm canonical receipt

After submission, use canonical RPC to confirm:

- transaction hash;
- inclusion;
- receipt status;
- emitted logs when required;
- resulting contract state for security-sensitive outcomes.

A wallet-returned transaction hash is evidence of submission, not final canonical state by itself.

## 6. Use Indexer for history and UX

After canonical confirmation, 420Indexer can efficiently provide transaction history, logs, protocol projections and search views.

```text
420 indexer diagnostics
420 indexer search <address-or-object>
```

Indexer state remains projection-only and must not become the wallet authorization source.

## Failure rules

Fail closed when:

- the selected wallet chain differs from the DEVHUB network;
- required canonical wallet contracts are absent;
- the requested capability is unavailable or expired;
- the user/account runtime does not authorize submission;
- receipt chain ID does not match the prepared operation;
- an application attempts to bypass the wallet with raw secret material.

## Boundary summary

| Step | Owner | Canonical for security? |
| --- | --- | --- |
| Call construction | application / SDK | No |
| Account + capability decision | 420 Wallet / Smart Account | Yes |
| Signature | wallet/account runtime | Yes |
| Submission + receipt | chain RPC | Yes |
| History/search | 420Indexer | No |

The Developer Hub coordinates the path; it never inherits wallet authority.
