---
title: Networks and manifests
audience:
  - developer
category: developer
status: development
version: current
---

# Networks and manifests

Use an explicit network manifest before opening an RPC connection, resolving a contract, requesting Faucet funds, or asking a Wallet to sign. Developer Hub discovery is a configuration and validation layer; it does not create network authority.

## Current repository state

The repository currently checks in one example network manifest: `developer-hub/manifests/local.example.json`.

That file describes the local development environment only. It must not be copied, renamed, or inferred into a public testnet or mainnet configuration. Official testnet/mainnet hostnames, chain identity evidence, service endpoints and deployment records belong in the corresponding deployment-time manifests when those environments exist.

The current local example declares:

- environment: `local`;
- chain ID: `420`;
- native currency: `$420`, 18 decimals;
- HTTP RPC: `http://127.0.0.1:8545`;
- WebSocket RPC: `ws://127.0.0.1:8545`;
- local service endpoints for Explorer, Indexer, Verify, Status and Faucet;
- example contract records with explicit provenance.

These values describe the repository local profile. They are not public-network coordinates.

## Manifest contract

Network manifests use schema version `1.0.0` and identify:

- network name, environment and positive decimal chain ID;
- native `$420` currency metadata;
- one or more HTTP RPC endpoints and optional WebSocket endpoints;
- optional named service endpoints such as Explorer, Indexer, Verify, Status and Faucet;
- canonical/discovered contract entries with an address, version where applicable and provenance.

Allowed environment classes are `local`, `devnet`, `testnet` and `mainnet`.

Contract provenance is explicit and limited to the supported sources: `genesis`, `registry`, `governance` or `deployment-manifest`. An unknown service or contract is not guessed; discovery returns no value and the integration must fail closed if that dependency is required.

## Select a manifest explicitly

Inspect the selected environment before doing anything else:

```bash
420 network --manifest <path-to-manifest>
```

Then resolve services or contracts from the same environment:

```bash
420 service indexer --manifest <path-to-manifest>
420 contract Registry420 --manifest <path-to-manifest> --catalogue <path-to-catalogue>
```

Keep the manifest and catalogue bound to the same environment. A chain/catalogue mismatch must fail closed rather than silently substituting another deployment.

## Chain ID is necessary, not sufficient

The current execution genesis uses chain ID `420`, and local development also reports `420`. Chain ID therefore cannot, by itself, prove that an endpoint is the intended local, testnet or mainnet network.

Always compare the endpoint to the selected manifest. For higher-risk operations also verify stronger identity evidence, such as:

1. expected environment and deployment manifest;
2. expected canonical contract/deployment identities;
3. expected genesis/network metadata when available;
4. compatible fork/client configuration;
5. expected safe/finalized state from the selected network.

A reachable endpoint that returns chain ID `420` but disagrees with the selected deployment must be rejected.

## Environment-safety checklist

Before any write, deployment or value-sensitive operation:

1. select the intended manifest explicitly;
2. inspect `environment`, `chainId` and RPC endpoints;
3. call `eth_chainId` through the selected RPC and compare it to the manifest;
4. resolve the required canonical contracts/services from the same environment;
5. verify any deployment-specific identity needed by the operation;
6. confirm the connected Wallet is on the same intended environment;
7. stop if local, devnet, testnet or mainnet evidence conflicts.

Never silently fail over across environment classes.

## Authority boundary

A manifest is trusted configuration used to select and validate an environment. It does not rewrite chain history, grant Wallet permission, make an Indexer canonical, prove contract source code, or turn an endpoint into protocol authority. Canonical state still belongs to the selected chain and owning protocol contracts.

## Related guides

- [Source of truth and finality](source-of-truth.md)
- [Local development](local-development.md)
- [Testnet and Faucet](testnet-and-faucet.md)
- [RPC and WebSocket access](rpc-and-websocket.md)
- [Endpoint health and failover](endpoint-health-and-failover.md)
