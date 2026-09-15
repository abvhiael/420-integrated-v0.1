---
title: Developer prerequisites and tooling
audience:
  - developer
category: developer
status: development
version: current
---

# Developer prerequisites and tooling

DOC-9 assumes developers may arrive from browser dApp, backend/service, smart-contract, infrastructure or game development backgrounds. This page defines the common prerequisites and indicates which tooling is required for each path.

## Common prerequisites

Every integration should begin with:

- Git and a working repository checkout;
- an explicit target environment rather than an implicit default;
- access to the selected environment's canonical network/contract metadata;
- a supported RPC endpoint for canonical reads and transaction submission;
- familiarity with EVM addresses, transactions, receipts, events and gas;
- a 420 Wallet/Smart Account integration path for user-authorized writes;
- no raw private keys embedded in application source, frontend bundles or committed configuration.

DOC-9.2 will provide the concrete local setup/bootstrap commands.

## Tooling matrix

| Developer path | Minimum tools/services | Common optional tools |
| --- | --- | --- |
| Read-only web/backend app | SDK or EVM client, canonical RPC | 420Indexer API, Developer Hub CLI |
| Transaction-capable dApp | SDK/EVM client, canonical RPC, 420 Wallet integration | simulation, Indexer, Developer Hub |
| Smart-contract development | repository contract toolchain, local/devnet, deploy signer path | Developer Hub deployment/verification workflows |
| Indexer/data consumer | 420Indexer API + canonical RPC for verification | analytics/search services |
| Protocol-integrating service | canonical contract catalogue/Registry, RPC, interface bindings | Indexer, provider adapters, Developer Hub |
| Storage/AI/provider integration | owning protocol interfaces + provider client | provider discovery/status tooling |
| Cross-chain/Bridge integration | canonical Bridge route/asset/chain config, verifier-aware flow, source/destination RPC | relayer/provider clients, Indexer |
| Game integration | Gaming Protocol SDK/interfaces, guest/Wallet identity model | game-specific backend and Indexer projections |

## Developer Hub and CLI

The completed Developer Hub is the preferred orchestration layer for:

- network/environment discovery;
- canonical contract catalogue lookup;
- shared SDK/CLI access;
- local/devnet bootstrap;
- project templates;
- testnet Faucet/test-account workflows;
- deployment and verification planning;
- Indexer diagnostics;
- application registration and publishing;
- logs, events, diagnostics and service health.

Using Developer Hub is not a requirement for protocol validity. Equivalent integrations remain valid when they preserve the same canonical discovery, authorization, verification and finality rules.

## Environment discipline

Keep development, testnet and future production configuration separate.

At minimum, bind each runtime configuration to:

- environment name;
- expected chain ID;
- RPC/WSS endpoints;
- canonical contract/Registry source;
- Indexer/API endpoints where used;
- Faucet availability only for testnet;
- feature/provider availability;
- confirmation/finality policy appropriate to that environment.

Never infer mainnet safety from a testnet deployment, and never let testnet Faucet or test credentials become production fallbacks.

## Secret and signer rules

Application repositories may contain public addresses, interface identifiers and public endpoint configuration. They must not contain:

- raw private keys or seed/recovery phrases;
- passkey private material;
- Wallet signing secrets;
- validator signing keys;
- Engine JWT secrets;
- production provider/API secrets intended to remain confidential;
- unencrypted private user datasets, private AI prompts/outputs or private protocol payloads merely for debugging convenience.

Use external signer, Wallet, environment-secret or deployment-secret mechanisms appropriate to the runtime. DOC-9 guides should show public placeholders rather than real secrets.

## Choose the correct read source

Before choosing an SDK/API, decide what the application needs to know.

- current security-sensitive state: canonical RPC / owning contract;
- large history/search/feed: 420Indexer;
- application-specific presentation: app API/projection;
- official service/version identity: Registry/canonical catalogue;
- user authorization: Wallet/Smart Account;
- reproducible deployment evidence: 420Verify;
- operational liveness/readiness: Status/health endpoints, never chain authority.

See [Source of truth and finality](source-of-truth.md) for precedence rules.

## Baseline integration checklist

Before starting feature work, be able to answer:

1. Which environment and chain ID am I targeting?
2. How do I discover the canonical contracts/services I depend on?
3. Which reads require canonical RPC and which may use Indexer projections?
4. Which authority signs or authorizes each mutation?
5. What finality level does each workflow require?
6. What happens if RPC, Indexer, Wallet or a replaceable provider is unavailable?
7. Which information is public and which must remain private/off-chain?
8. Which references will be generated in DOC-10 rather than hand-maintained?

If any of these are unknown, resolve them before adding production-facing behavior.

## Related documentation

- [Developer documentation home](index.md)
- [Developer integration model](integration-model.md)
- [Source of truth and finality](source-of-truth.md)
- [Developer Hub roadmap closeout](../DEVELOPER-HUB-ROADMAP-CLOSEOUT.md)
- [End-to-end Developer Hub dApp guide](../developer-hub/guides/end-to-end-dapp.md)
