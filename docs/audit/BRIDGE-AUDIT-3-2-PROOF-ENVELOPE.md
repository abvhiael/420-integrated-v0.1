# BRIDGE-AUDIT-3.2 — Canonical proof envelope integration

**Status:** implementation candidate; requires exact-head compile/test and source-verifier qualification. **Do not treat mock proofs as real finality evidence.**

## Transport contract

`BridgeProofEnvelope420.Envelope` is the versioned, canonical ABI transport for `GatewayRouter420.acceptInbound`. The router ABI remains `acceptInbound(bytes32 adapterId, bytes proof)`, but callers must supply `abi.encode(Envelope)` in `proof`, not raw source-chain evidence. `innerProof` contains the chain-specific source verifier's proof. Short, oversized, noncanonical ABI, bad version, missing identifiers, zero-value claims, expired/future evidence and wrong destination router/chain are rejected.

An envelope binds the selected route, adapter, local asset, source/destination chain IDs and network fingerprints, configured source asset, configured verifier hash, destination chain ID and router, recipient, amount, source transaction and message IDs. Router compares resulting `VerifiedTransfer` to these claims; route/chain binding is checked against canonical `BridgeRouteRegistry` and its `BridgeChainRegistry420` snapshot.

**Gateway claim:** the router also calls `IBridgeVerifiedSourceContext420.verifiedSourceContext(sourceMessageId)` on the concrete adapter *after* `verifyInbound(innerProof)` returns. It rejects zero/mismatched gateway and source-asset context. Because this call and transfer occur atomically, a failing comparison rolls back adapter consumption and downstream accounting. The proof context must originate from the verifier-returned source record and cannot be copied from caller-controlled envelope bytes.

Source context is exposed by Ethereum, BNB, Solana, Tron, XRPL, Dogecoin, PotCoin, Curecoin and Dobbscoin adapter implementations. For single-native-asset families without a source-token field the adapter's canonical local asset binding is used as a source-asset representation; the configured route's `sourceAsset` must match that representation. Bitcoin, Litecoin and Pirate Chain lack independently returned source gateway/script identities in their current `FinalizedTransfer` schema. Until this provenance is supplied, the router's required context call fails closed for those adapters. Do not invent a gateway from tx/outpoint/nullifier or treat it as source gateway authority.

**Important limits:** The envelope and adapter's verified-source-context getter are domain-consistency checks, **not independent proof of source consensus, receipt inclusion, validity of on-chain source contract or governance verifier trust**. External verifier families are unqualified as recorded in `BRIDGE-AUDIT-3-1-VERIFIER-QUALIFICATION-INVENTORY.md`; independent verifier authenticity, revocation and production route admission are handled in BRIDGE-AUDIT-3.3–3.4. No testnet or real-value route has been qualified by these mock tests.

## Source proof shape

```solidity
struct Envelope {
    uint256 version;              // 1
    bytes32 routeId;
    bytes32 adapterId;
    bytes32 assetId;
    uint64 sourceChainId;
    uint64 destinationChainId;
    bytes32 sourceNetworkId;
    bytes32 destinationNetworkId;
    bytes32 sourceGateway;        // adapter-derived gateway/program/script identity
    bytes32 sourceAsset;          // route-configured source representation
    bytes32 verifierConfigHash;
    uint256 destinationChainIdEvm;
    address destinationRouter;
    address recipient;
    uint256 amount;
    bytes32 sourceTxId;
    bytes32 sourceMessageId;
    uint64 observedAt;            // observation timestamp
    uint64 expiresAt;             // finite expiry
    bytes innerProof;             // authenticated by selected adapter verifier
}
```

The envelope is restricted to 128 KiB encoded bytes, maximum evidence age of one day and a maximum one-day validity span. These guards limit stale/malformed claim replays; finality and reorg policy remain the source-specific verifier's duty. Transport bytes are ABI-reencoded and compared for canonicality to reject altered offsets, padding and trailing bytes.

**Generic `VerifiedGateway420` boundary:** its legacy `IVerifiedGatewayVerifier420` four-tuple does not provide sufficient source gateway, source-chain or proof-domain context for this envelope. It must not be treated as evidence of production finality or routed through this proof transport until its verifier boundary is separately qualified. No Genesis predeploy or `VerifiedGateway420` ABI is changed here.

## Targeted test scope

`BridgeGenesisIntegration420.t.sol` and `PaySwapBridgeGenesisIntegration420.t.sol` now encode canonical envelopes rather than arbitrary bytes at the router, and targeted negative fixtures exercise wrong domain, gateway, route, adapter, verifier hash, source asset, recipient, amount, transaction/message ID, malformed bytes and invalid timing. Chain-specific direct adapter tests continue using their inner proof ABI; they remain mocks, not live finality.
