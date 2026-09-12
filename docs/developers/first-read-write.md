---
title: First read and Wallet-authorized write
audience:
  - developer
category: developer
status: development
version: current
---

# First read and Wallet-authorized write

This guide demonstrates the most important developer boundary in 420 Integrated: reads may use canonical RPC or clearly labeled derived services, while user-authorized state changes must cross the qualified 420 Wallet/Smart Account boundary.

## Part 1 — establish the environment

Start from a healthy local devnet and confirm the selected network:

```bash
420 network
```

Then confirm the RPC path:

```bash
420 rpc eth_chainId '[]'
420 rpc eth_blockNumber '[]'
```

Do not continue if the observed chain identity conflicts with the selected manifest/catalogue.

## Part 2 — resolve before you call

When interacting with an ecosystem contract or service, resolve it from the canonical catalogue/Registry-backed discovery path:

```bash
420 contract <ContractName>
420 service <ServiceName>
```

Do not promote a copied address, cached browser value, search result or old documentation snippet into contract authority.

For a security-sensitive read, prefer canonical RPC against the resolved contract. 420Indexer is appropriate for rebuildable history/search/projections when its provenance and finality metadata are preserved.

## Part 3 — prepare the write intent

An application may construct an unsigned intent containing fields such as:

```text
network / chain identity
resolved destination contract
function or calldata
native value or token amount
expected min/max bounds
deadline or expiry when relevant
human-readable explanation
```

The application should validate those fields before requesting authorization. Value-changing integrations should surface fees, limits, slippage/deadlines or other protocol-specific risk controls when applicable.

Preparing an intent does not grant authority to execute it.

## Part 4 — hand off to Wallet

The `wallet-aware` starter intentionally requires an injected/connected Wallet runtime and checks for its signing interface. It does not accept a private-key argument or mnemonic fallback.

The application should:

1. request/connect the qualified 420 Wallet runtime;
2. verify the Wallet is on the expected network;
3. present the destination, value and intent clearly;
4. request simulation/preflight where supported;
5. request Wallet authorization/signature/submission;
6. allow Smart Account capability/session policy to approve or reject the operation.

If the required Wallet/capability/session authority is unavailable, fail closed. Do not ask the user to paste a private key into the dApp.

## Part 5 — confirm from canonical state

After submission, capture the transaction hash. Treat a wallet/provider acknowledgement as submission evidence, not settlement evidence.

Confirm the transaction using canonical RPC:

1. wait for a receipt;
2. verify receipt status;
3. verify the expected destination/effect when material;
4. apply the operation's required confirmation/finality policy;
5. refresh any derived/indexed UI only after reconciling it with canonical state.

A transaction may be included before it is safe or finalized. User-facing language must not collapse those states if a reorg would materially affect the operation.

## Read/write authority table

| Action | Correct authority/source |
| --- | --- |
| Resolve network identity | selected canonical manifest + observed chain ID |
| Resolve ecosystem contract | canonical catalogue / Registry-backed source |
| Current security-sensitive state | canonical RPC / owning protocol contract |
| Search/history/projected view | 420Indexer or other explicitly derived provider |
| Build calldata/intent | application code |
| Authorize/sign | 420 Wallet / Smart Account |
| Submit | qualified Wallet/signing path |
| Confirm execution | canonical receipt/state |
| Decide durable completion | workflow-specific confirmation/finality policy |

## Common mistakes

### Treating connect as authorization

A connected Wallet exposes an account/session relationship; it does not automatically grant arbitrary contract calls, spend authority or reusable capabilities.

### Falling back to a raw private key

Do not add this path. It defeats the Wallet/Smart Account authority boundary and creates a secret-handling burden for every application.

### Trusting an Indexer result as final settlement

Indexer data is useful for UX and history but is rebuildable projection state. Confirm value/security-sensitive completion from canonical chain state.

### Hard-coding a local deployment address

Local deployments may change after a reset. Rediscover through the selected environment/catalogue instead.

### Declaring success on submission

Submission, inclusion, safe status and finality are different stages. Use the level appropriate to the operation.

## Where later DOC-9 sections extend this

- DOC-9.3 covers network/testnet/RPC selection in depth.
- DOC-9.4 covers contract discovery/deployment/verification/Registry handoffs.
- DOC-9.5 covers canonical reads versus 420Indexer APIs.
- DOC-9.6 covers Wallet/Smart Account capabilities and signing in depth.
- DOC-9.7 standardizes errors, retries, idempotency and event handling.

For now, preserve the central rule: application code prepares intent; the owning authority performs the state-changing action.
