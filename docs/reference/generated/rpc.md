---
title: Generated public RPC reference
audience:
  - developer
category: reference
status: generated
version: current
---

# Generated public RPC reference

> GENERATED FILE - DO NOT EDIT. Regenerate from `420-rpc/src/methods.ts` and `420-rpc/src/request-policy.ts`.

Method source: `420-rpc/src/methods.ts`  
Request-policy source: `420-rpc/src/request-policy.ts`

420RPC is a public ingress/policy layer over compatible execution RPC providers. It does not become consensus, execution, finality, account or signing authority.

## Public compatibility surface

| Method | Profile | Transport | Parameters | Required upstream capability | Mutates chain | Requires user signature |
| --- | --- | --- | --- | --- | --- | --- |
| `web3_clientVersion` | `metadata` | `both` | `[]` | `client-version` | false | false |
| `net_version` | `metadata` | `both` | `[]` | `chain-identity` | false | false |
| `eth_chainId` | `metadata` | `both` | `[]` | `chain-identity` | false | false |
| `eth_syncing` | `read` | `both` | `[]` | `head-read` | false | false |
| `eth_blockNumber` | `read` | `both` | `[]` | `head-read` | false | false |
| `eth_getBalance` | `read` | `both` | `[address, block]` | `head-read` | false | false |
| `eth_getCode` | `read` | `both` | `[address, block]` | `head-read` | false | false |
| `eth_getStorageAt` | `read` | `both` | `[address, position, block]` | `head-read` | false | false |
| `eth_getTransactionCount` | `read` | `both` | `[address, block]` | `head-read` | false | false |
| `eth_getBlockByHash` | `read` | `both` | `[hash, fullTransactions]` | `head-read` | false | false |
| `eth_getBlockByNumber` | `read` | `both` | `[block, fullTransactions]` | `head-read` | false | false |
| `eth_getBlockTransactionCountByHash` | `read` | `both` | `[hash]` | `head-read` | false | false |
| `eth_getBlockTransactionCountByNumber` | `read` | `both` | `[block]` | `head-read` | false | false |
| `eth_getTransactionByHash` | `read` | `both` | `[hash]` | `head-read` | false | false |
| `eth_getTransactionByBlockHashAndIndex` | `read` | `both` | `[hash, index]` | `head-read` | false | false |
| `eth_getTransactionByBlockNumberAndIndex` | `read` | `both` | `[block, index]` | `head-read` | false | false |
| `eth_getTransactionReceipt` | `read` | `both` | `[hash]` | `head-read` | false | false |
| `eth_getLogs` | `read` | `both` | `[filter]` | `head-read` | false | false |
| `eth_call` | `read` | `both` | `[transaction, block] (+ optional state override)` | `head-read` | false | false |
| `eth_estimateGas` | `read` | `both` | `[transaction] (+ optional block)` | `head-read` | false | false |
| `eth_gasPrice` | `read` | `both` | `[]` | `head-read` | false | false |
| `eth_maxPriorityFeePerGas` | `read` | `both` | `[]` | `head-read` | false | false |
| `eth_feeHistory` | `read` | `both` | `[blockCount, newestBlock, rewardPercentiles]` | `head-read` | false | false |
| `eth_sendRawTransaction` | `submit` | `both` | `[signedTransactionBytes]` | `transaction-submission` | true | true |
| `eth_subscribe` | `subscription` | `websocket` | `[subscriptionType] (+ optional logs filter)` | `subscriptions` | false | false |
| `eth_unsubscribe` | `subscription` | `websocket` | `[subscriptionId]` | `subscriptions` | false | false |

## Request-envelope policy

- JSON-RPC notifications allowed: **no**
- Positional array parameters required: **yes**
- Invalid request envelope: `-32600`
- Method outside the public compatibility surface: `-32601`
- Invalid method parameters: `-32602`
- Accepted block selectors: `latest`, `earliest`, `pending`, `safe`, `finalized` plus canonical hex quantities.
- Supported `eth_subscribe` kinds: `newHeads`, `logs`, `newPendingTransactions`, `syncing`.

## Deliberately excluded public surface

420RPC fails closed instead of forwarding arbitrary upstream methods.

- Forbidden namespaces/prefixes: `engine_`, `admin_`, `personal_`, `debug_`, `miner_`, `txpool_`
- Explicitly forbidden account/signing methods: `eth_sendTransaction`, `eth_sign`, `eth_signTransaction`, `eth_accounts`, `eth_coinbase`
- Private Engine API is not part of this public reference.
- Node-managed accounts, node-side signing, admin/debug/miner/txpool access are not public 420RPC capabilities.

## Result-shape boundary

The current 420RPC implementation owns admission, compatibility, routing and policy, but does not redeclare independent result schemas for canonical Ethereum JSON-RPC methods. Successful result shapes therefore remain those of the compatible execution upstream. This generated reference does not invent schemas that are not encoded in 420RPC source.
