---
title: RPC and WebSocket access
audience:
  - developer
category: developer
status: development
version: current
---

# RPC and WebSocket access

420 Integrated uses standard EVM JSON-RPC semantics for application-facing execution access. In the current repository architecture, `node420` exposes the canonical execution JSON-RPC path through the pinned Geth distribution. 420RPC is a replaceable ingress/gateway layer and must not be documented as having replaced direct execution RPC until that deployment is actually active.

## Current execution endpoints

The frozen local profile uses:

- HTTP JSON-RPC: `http://127.0.0.1:8545`;
- WebSocket RPC: `ws://127.0.0.1:8545`;
- Engine API: `127.0.0.1:8551` with JWT authentication.

Only the public application RPC belongs in normal dApp integrations. The Engine API is a privileged consensus/execution interface and must never be used as a public dApp endpoint.

## Use the selected manifest

Prefer the RPC endpoints declared by the selected network manifest:

```bash
420 network --manifest <path-to-manifest>
420 rpc eth_chainId '[]' --manifest <path-to-manifest> --catalogue <matching-catalogue>
420 rpc eth_blockNumber '[]' --manifest <path-to-manifest> --catalogue <matching-catalogue>
```

An explicit `--rpc` override is available for controlled diagnostics, but the SDK still binds the connection to the selected manifest/catalogue identity. An override is not permission to connect to an arbitrary chain.

## Public method boundary

The current public execution surface is based on the approved EVM namespaces such as:

- `eth`;
- `net`;
- `web3`.

Application RPC may be used for chain identity, blocks, transactions, receipts, logs, account/contract state, gas/fee data and transaction submission where supported.

Public ingress must not expose privileged node-management or consensus surfaces such as:

- Engine methods/JWT;
- validator signing controls;
- administrative node APIs;
- unrestricted debug/maintenance APIs;
- local keystore or signer controls.

## Reads and finality

A successful RPC response is evidence from the selected execution source, but the meaning of the response still depends on its block/finality context.

For state-sensitive reads:

1. verify network identity first;
2. record the block number/hash when reproducibility matters;
3. distinguish head, safe and finalized state;
4. do not turn an observed head into a finalized assertion;
5. re-check canonical state after a reorg-sensitive operation.

See [Source of truth and finality](source-of-truth.md).

## Transaction submission

Submitting a signed transaction to an RPC endpoint means the endpoint accepted the submission request. It does not mean:

- the transaction entered every mempool;
- it was included in a block;
- the receipt is final;
- the intended protocol state transition succeeded.

Track the returned transaction hash and confirm inclusion, receipt status and the required finality level through canonical RPC.

## WebSocket usage

WebSocket transport is useful for subscriptions and lower-latency observations, but it carries the same authority limits as HTTP RPC.

Treat these events separately:

- **WebSocket disconnect** — a transport failure; reconnect and backfill missed canonical data.
- **new head** — current chain observation, not automatically finalized.
- **reorg** — canonical chain change; reconcile previously observed head-sensitive state.

Applications that depend on subscriptions should maintain a recovery cursor or block checkpoint so a disconnect does not create permanent gaps.

## 420RPC boundary

420RPC may provide provider selection, rate limiting, method policy, caching, observability or failover in front of execution RPC. It remains replaceable ingress.

420RPC does not own:

- consensus fork choice or finality;
- canonical protocol contract state;
- Wallet signing keys or capabilities;
- validator keys;
- Engine JWT authority;
- governance authority.

If 420RPC is unavailable, a qualified client may use another approved RPC path for the same verified network. The fallback must preserve network identity, method compatibility, freshness and finality safety.

## Credentials

Provider/application API credentials are transport credentials only. Keep them separate from Wallet signing material, validator keys, Engine JWTs and recovery secrets.

## Related guides

- [Networks and manifests](networks-and-manifests.md)
- [Endpoint health and failover](endpoint-health-and-failover.md)
- [First read and Wallet-authorized write](first-read-write.md)
- [RPC/gateway architecture](../architecture/infrastructure/rpc-gateways-network-ingress.md)
