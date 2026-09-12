---
title: Developer quickstart
audience:
  - developer
category: developer
status: development
version: current
---

# Developer quickstart

Use this path to go from a clean checkout to a qualified local 420 Integrated development environment without inventing a second network configuration or moving signing authority into developer tooling.

## What this quickstart gives you

By the end you should be able to:

1. validate the repository/toolchain prerequisites;
2. inspect the deterministic local-devnet plan before starting anything;
3. start the qualified local 15-node development network;
4. confirm the selected chain identity through the 420 CLI;
5. make a first canonical JSON-RPC read;
6. scaffold a starter project that does not hard-code production addresses or chain identity;
7. hand a state-changing request to the qualified 420 Wallet runtime rather than handling private keys yourself.

This guide uses the existing Developer Hub, `@420/sdk`, 420 CLI and local-devnet machinery. These tools orchestrate development; they do not become chain, Registry, Wallet or protocol authority.

## 1. Start from the repository root

Clone or update the repository, then work from the checked-out source tree. Keep local development isolated from production/testnet credentials and configuration.

The Developer Hub requires Node.js 22 or newer. The local devnet also depends on the repository's Go/toolchain, pinned Geth path and canonical chain assets validated by `devnet:doctor`.

Do not copy production secrets, validator keys, private keys, mnemonic phrases, passkey private material or Engine JWTs into a starter project.

## 2. Inspect the local-devnet plan

From `developer-hub/` run:

```bash
npm run devnet:plan
```

The plan command is side-effect free. Review it before any mutating bootstrap step.

Then validate the environment:

```bash
npm run devnet:doctor
```

Doctor mode checks the canonical repository scripts, execution genesis, pinned Geth dependency and local-only profile. Treat a doctor failure as a stop condition; do not bypass missing or mismatched dependencies with guessed values.

## 3. Start the qualified local network

For a bounded first run:

```bash
npm run devnet:smoke
```

For normal local development:

```bash
npm run devnet:prepare
npm run devnet:up
```

The frozen local profile uses chain ID `420`, 15 execution nodes and 15 consensus validators. The first public execution RPC is normally `127.0.0.1:8545`; the local RPC range is `8545..8559`.

This profile is development-only. Chain ID `420` in this local manifest must not be treated as proof that a remote endpoint is a canonical testnet or mainnet endpoint.

## 4. Confirm network identity through the 420 CLI

The repository-native CLI is a thin surface over canonical Developer Hub discovery and the shared SDK.

From the repository environment, use:

```bash
420 network
```

Then inspect a known service or contract through discovered metadata rather than copying an address from an old note:

```bash
420 service indexer
420 contract <ContractName>
```

If a network manifest and contract catalogue disagree on chain identity, tooling must fail closed.

## 5. Make the first canonical read

Use the selected RPC endpoint through the CLI/SDK path:

```bash
420 rpc eth_chainId '[]'
```

Then query a canonical chain value such as the latest block number:

```bash
420 rpc eth_blockNumber '[]'
```

A successful read proves that your client can reach the selected endpoint. It does not by itself prove that a remote endpoint is the intended environment; environment identity must still match the selected manifest and expected chain context.

## 6. Scaffold a starter project

List the checked-in templates:

```bash
420 templates
```

Choose the smallest starter that matches the task:

- `sdk-basic` for read-only SDK work;
- `protocol-reader` for canonical contract/service discovery;
- `wallet-aware` when the application will request user-authorized writes.

Create a project with:

```bash
420 create sdk-basic my-420-app
```

or, for a signing-aware application:

```bash
420 create wallet-aware my-420-app
```

The scaffolder rejects arbitrary template sources, unsafe traversal and silent overwrite of an existing target.

## 7. Perform the first write safely

A developer application may prepare calldata, destination, value and human-readable intent. It must not fall back to a raw private key when a Wallet connection is unavailable.

For a first write:

1. select and validate the same network used for the read path;
2. resolve the canonical destination contract/service;
3. prepare the call and any expected value/fee bounds;
4. simulate or preflight when the integration supports it;
5. pass the request into the qualified 420 Wallet runtime;
6. let Wallet/Smart Account perform authorization, capability checks, nonce/signature handling and submission;
7. capture the transaction hash;
8. confirm receipt/status from canonical RPC;
9. apply the required confirmation/finality policy before treating the change as durable.

The `wallet-aware` starter deliberately requires a Wallet runtime with a signing interface and contains no private-key or mnemonic path.

## 8. Know what success means

A healthy local quickstart means:

- `devnet:doctor` passes;
- the local network starts from the repository's canonical bootstrap path;
- `420 network` shows the expected local manifest;
- canonical RPC reads succeed;
- starter projects use discovery rather than embedded production addresses;
- state-changing work crosses the Wallet boundary instead of a developer-owned signer;
- transaction completion is verified from canonical chain state.

If any of those assumptions fail, stop at that layer and diagnose it before building on top of a false environment assumption.

## Next

Continue with [Local development](local-development.md) for the local topology and lifecycle, [Project structure](project-structure.md) for starter organization, and [First read and Wallet-authorized write](first-read-write.md) for the integration boundary in more detail.
