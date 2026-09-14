---
title: Generated SDK and CLI reference
audience:
  - developer
category: reference
status: generated
version: current
---

# Generated SDK and CLI reference

> GENERATED FILE - DO NOT EDIT. Regenerate from the checked-in `@420/sdk` and `@420/cli` implementation sources.

SDK package: `@420/sdk` `0.1.0`  
CLI package: `@420/cli` `0.1.0`  
Node engine: SDK `>=22`, CLI `>=22`

The SDK and CLI are convenience/integration layers. They do not become consensus, execution, Registry, Wallet, governance, settlement or finality authority.

## SDK exports

| Kind | Symbol | Source |
| --- | --- | --- |
| `interface` | `NativeCurrency420` | `packages/420-sdk/src/index.ts` |
| `interface` | `NetworkDiscovery420` | `packages/420-sdk/src/index.ts` |
| `interface` | `ContractCatalogueEntry420` | `packages/420-sdk/src/index.ts` |
| `interface` | `ContractCatalogue420` | `packages/420-sdk/src/index.ts` |
| `interface` | `RpcRequest420` | `packages/420-sdk/src/index.ts` |
| `interface` | `JsonRpcTransport420` | `packages/420-sdk/src/index.ts` |
| `class` | `SdkConfigurationError420` | `packages/420-sdk/src/index.ts` |
| `interface` | `Sdk420` | `packages/420-sdk/src/index.ts` |
| `function` | `createSdk420` | `packages/420-sdk/src/index.ts` |
| `interface` | `WalletProvider420` | `packages/420-sdk/src/wallet.ts` |
| `interface` | `ConnectedWallet420` | `packages/420-sdk/src/wallet.ts` |
| `interface` | `SmartAccountState420` | `packages/420-sdk/src/wallet.ts` |
| `interface` | `SessionRequest420` | `packages/420-sdk/src/wallet.ts` |
| `interface` | `WalletRuntimeAdapter420` | `packages/420-sdk/src/wallet.ts` |
| `class` | `WalletSdkConfigurationError420` | `packages/420-sdk/src/wallet.ts` |
| `interface` | `WalletSdk420` | `packages/420-sdk/src/wallet.ts` |
| `function` | `createWalletSdk420` | `packages/420-sdk/src/wallet.ts` |

## SDK configuration and authority boundaries

- `createSdk420` requires discovered network metadata, a verified contract catalogue and a JSON-RPC transport.
- Network and contract-catalogue chain identity must match; a mismatched chain fails closed with `SdkConfigurationError420`.
- The selected SDK RPC endpoint must be declared by the selected network discovery record.
- `createWalletSdk420` requires canonical `SmartAccountFactory420` and `CapabilityRegistry420` catalogue entries.
- Wallet connection checks the connected wallet chain against the SDK network.
- Smart Account discovery rejects a non-canonical factory or capability registry when those values are supplied by the runtime adapter.
- Session preparation, submission and confirmation are delegated to the Wallet provider/runtime adapter. The SDK surface accepts no raw private key, seed phrase or mnemonic.

## Primary `420` CLI commands

The following command forms are extracted from the primary CLI help contract:

- `420 version`
- `420 network [--manifest PATH]`
- `420 service NAME [--manifest PATH]`
- `420 contract NAME [--manifest PATH] [--catalogue PATH]`
- `420 rpc METHOD [PARAMS_JSON] [--manifest PATH] [--catalogue PATH] [--rpc URL]`
- `420 wallet-contracts [--manifest PATH] [--catalogue PATH]`
- `420 devnet plan|doctor|prepare|up|smoke [SECONDS]`
- `420 templates`
- `420 create TEMPLATE NAME [TARGET]`
- `420 test-account ADDRESS [LABEL]`
- `420 faucet request ADDRESS [--manifest PATH] [--catalogue PATH]`
- `420 deploy plan REQUEST_JSON [--manifest PATH] [--catalogue PATH]`
- `420 deploy view REQUEST_JSON [--manifest PATH] [--catalogue PATH]`
- `420 verify plan EVIDENCE_JSON [--manifest PATH] [--catalogue PATH]`
- `420 verify view EVIDENCE_JSON [--manifest PATH] [--catalogue PATH]`
- `420 indexer view [--manifest PATH] [--catalogue PATH]`
- `420 indexer diagnostics [--manifest PATH] [--catalogue PATH]`
- `420 indexer search TERM [LIMIT] [--manifest PATH] [--catalogue PATH]`
- `420 debug view [--manifest PATH] [--catalogue PATH] [--rpc URL]`
- `420 debug diagnostics [--manifest PATH] [--catalogue PATH] [--rpc URL]`
- `420 debug tx HASH [--manifest PATH] [--catalogue PATH] [--rpc URL]`
- `420 debug logs [ADDRESS] [LIMIT] [--manifest PATH] [--catalogue PATH]`
- `420 debug events PROTOCOL [OBJECT_KEY] [LIMIT] [--manifest PATH] [--catalogue PATH]`
- `420 guides`
- `420 guide ID`
- `420 app plan RELEASE_JSON [--manifest PATH] [--catalogue PATH]`
- `420 app view RELEASE_JSON [--manifest PATH] [--catalogue PATH]`

## CLI runtime options and defaults

- `--manifest PATH` selects the network manifest where supported.
- `--catalogue PATH` selects the contract catalogue where supported.
- `--rpc URL` may override the RPC endpoint only where the command supports it; SDK validation still requires the endpoint to belong to the selected network discovery record.
- Without overrides, the primary CLI uses `developer-hub/manifests/local.example.json` and `developer-hub/catalogue/local.example.json`; these defaults are local-example scope, not testnet/mainnet identity.
- CLI output is structured JSON; failures use the `420_CLI_ERROR=` prefix and non-zero exit codes.

## Installed CLI binaries

| Binary | Entry point |
| --- | --- |
| `420` | `./bin/420.mjs` |
| `420-auth` | `./bin/420-auth.mjs` |
| `420-launch` | `./bin/420-launch.mjs` |
| `420-qualify` | `./bin/420-qualify.mjs` |
| `420-status` | `./bin/420-status.mjs` |

## Secret and signer boundary

The primary `420` CLI performs discovery, reads, planning, verification views, debugging and service requests. It does not expose a command-line option for a private key, seed phrase or mnemonic, and its SDK dependency does not create autonomous signer authority. State-changing user authorization remains outside this convenience layer and must stay with the qualified Wallet/external signer boundary.
