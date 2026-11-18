---
title: Executable Wallet, Exchange and SDK bridge integration
audience: [developer, architect, operator]
category: developer
status: current
version: current
---

# Executable Wallet, Exchange and SDK bridge integration

The canonical service ID is `420/service/bridge/v1` (hashed for `ProtocolRegistry.getService`). It is a service namespace, separate from the component IDs in `BridgeIds420`: `keccak256("420/APP/420BRIDGE/" + suffix)`. Service discovery grants navigation, not spending authority.

`wallet/web/core/bridge-client.js` implements `createBridgeClient420`. `exchange/web/core/canonical-bridge.js` uses that exact implementation; the Exchange build packages its source verbatim and rewrites only the import location. `@420/sdk` exports `createBridgeSdk420`, packages the same implementation, and resolves ProtocolRegistry from the selected SDK catalogue. Supply the Registry runtime hash from the trusted deployment release, never from a route manifest, Explorer, Search, Status or an arbitrary API response. Exchange also requires its qualified contract address and runtime hash.

```js
import {createBridgeSdk420} from '@420/sdk';
const bridge = createBridgeSdk420({
  sdk, provider: selectedEip1193Provider, registryCodeHash,
  exchangeQualificationCodeHash
});
await bridge.connect(); // explicit eth_requestAccounts
// If needed, user action can call await bridge.switchChain().
const review = await bridge.review({
  routeId, exchangeAssetId, amountRaw: '1000000',
  recipientBytes, feeValueWei: '0', extra: '0x'
});
// Render exact raw amount, recipient bytes, source/destination network
// fingerprints, assets, adapter, fee, risk estimate and quote expiry.
const transactionHash = await bridge.submit(review, async reviewed => {
  return await showExplicitUserConfirmation(reviewed);
});
// A submitted transaction is not destination delivery.
const canonicalTransfer = await bridge.transfer(transferId);
```

The provider interface is EIP-1193 `request({method, params})`. Wallet's existing `InjectedProvider420` wrapper instead exposes `request(method, params)`; pass its underlying injected provider, not that differently shaped wrapper. Account access is explicit. Switching never silently adds a provider-supplied network. The browser execution controller exposes `prepareBridge(input)` and `submitBridge(review, confirm)`, retains the existing submission gate, binds the selected provider/session/runtime/generation, and invalidates execution when those change. Its `runtime.bridge` supplies `registry`, `registryCodeHash`, `exchangeQualification` and `exchangeQualificationCodeHash`. No display fixture is converted to executable input.

## Review and freshness

Every review resolves active bridge components from ProtocolRegistry, checks runtime hashes and component IDs at one block, checks the canonical service, route direction/version, chain fingerprints, local asset, adapter identity, current chain/verifier bindings, router admission, and Exchange asset/route qualification when requested. Exchange asset ID and Bridge asset ID are distinct namespaces. The exact outbound ABI is `initiateOutbound(bytes32,bytes32,bytes32,bytes,uint256,bytes)`; extra adapter bytes and native fee value are part of the reviewed transaction.

Raw amounts are decimal strings, never floating point. EVM destination recipients must be nonzero 20-byte addresses. Other families use exact native adapter bytes; their adapter simulation is required and unsupported formats fail closed. Do not label an arbitrary EVM address as a Bitcoin, Solana or other native recipient. Display network fingerprints and asset IDs rather than relying on ticker names or a manifest's labels.

The core protocol minimum is one raw unit (`amount > 0`). Additional adapter/provider constraints are enforced by simulation; this interface does **not** invent a common remote-provider minimum or claim a live all-in fee quote. `feeValueWei` is the exact user-reviewed local transaction value; `feeAuthority: ADAPTER_SIMULATION` means the actual adapter accepts that value in simulation, not that an unauthenticated endpoint guarantees remote miner/issuer/provider costs. Real provider-specific fee quotes and funded mainnet/testnet operation require the existing approved deployment/provider infrastructure. Reject unsupported routes rather than displaying invented fees.

Risk estimates mirror route/asset max-single, hourly/daily outbound windows and settled backing excluding unsettled inbound claims, and separately check the shared risk limit. They carry a block hash and remain estimates. Exact `eth_call` and `eth_estimateGas` are mandatory. Review expiry, account, chain, Registry components and route bindings are rechecked before and after explicit confirmation; risk and simulation are checked again immediately before submission. Contract execution remains the final authority if limits change after those reads.

Only review objects issued by the client can submit. Review data is frozen; concurrent submission is rejected. The review is consumed before `eth_sendTransaction`, so an uncertain provider response cannot trigger blind replay. Recover using canonical message/transfer history and preserve the original funding identity.

## History, notifications and compositions

`bridgeTransferDescriptors420(registryResolvedTransferAddress)` and `bridgeTransferDecoder420(...)` bind the exact current `BridgeTransferRegistry` event ABI to its deployment address. Register these with the existing ProtocolProjection420/IndexerIngestor420; use the existing durable consumer/checkpoint configuration for production. TransferCreated, OutboundTransferCreated, SourceTransactionBound, TransferStatus and TransferTransition are indexed under `transferId:<lowercase bytes32>`, not route ID. Apply `420-indexer/sql/008-bridge-lifecycle.sql` to existing databases; fresh databases have matching view definitions in 005. `idx_bridge_state` preserves the last state event when a later non-state event appears. The existing protocol history API queries the same object key. Existing canonical rollback deletes orphaned events before replay.

FAILED, EXPIRED, PAUSED, DISPUTED and RETRYABLE are workflow states, not refunded funds. Only COMPLETED and REFUNDED are terminal in the generic reducer. State, amount, source transaction/message and finality come from canonical contracts/RPC. `bridge.transfer(id)` reads the finalized block and checks its canonical hash; Explorer/Search/Status cannot supply the result or settlement authority.

Bind `NotificationsConsumerAdapter420`'s optional fourth argument to `event => qualifyBridgeNotification420(chainSource, event, {registry, registryRuntimeHash})`. Matching bridge lifecycle notifications otherwise fail closed without advancing the checkpoint. Qualification checks finalized canonical block, historical Registry/runtime/address, successful transaction receipt and exact log fields, stable fork-specific event ID, topic, transfer object key and lifecycle status. Non-lifecycle configuration logs cannot become transfer notifications. Unsubscribed bridge events do not block other protocols. Existing canonicality signals provide consumer retraction/replacement updates after a reorganization; notifications remain non-authoritative.

`requireBridgeCompositionSettlement420(client, transferId)` permits a follow-on composition only after finalized canonical COMPLETED. Local submission, proof availability, a local burn, a failed request or a UI refund label cannot start Pay/Swap with unreceived value. REFUNDED permits recovery of the original workflow, not successful-payment presentation. Actual refund/retry execution continues to use the already-qualified Bridge custody/outcome interfaces; these clients cannot mint, refund or settle from a projection.

The shipped Exchange display remains under its existing unqualified-browser submission lock until real deployment and operational qualification. The new controller/SDK interfaces are locally executable and tested with controlled RPC/provider evidence. No public route, issuer approval, source custody or live qualification is asserted by a successful local test.

## Security qualification corrections

BRIDGE-AUDIT-11 binds the current outbound admission qualification ID to the review and presents a foreign-to-local canonical route's outbound reverse leg using the actual local source and foreign destination. Both canonical endpoint orientation and actual outbound identity remain in the binding. A fresh approval, even under identical labels, invalidates an old review. After the final risk reads, the client checks expiry and live wallet state once more and includes the expected EIP-155 `chainId` in the submitted transaction. See the [security/economic qualification](../audit/BRIDGE-AUDIT-11-SECURITY-ECONOMICS.md) for reproductions and evidence.
