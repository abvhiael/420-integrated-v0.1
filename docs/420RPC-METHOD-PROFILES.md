# 420RPC RPC-2 method profiles

RPC-2 defines the public Ethereum JSON-RPC compatibility surface that later routing and policy phases may serve. The list is explicit and fail closed: an unknown method is not automatically proxied merely because an upstream node happens to implement it.

## Profiles

### Metadata

- `web3_clientVersion`
- `net_version`
- `eth_chainId`

These expose compatibility and chain identity metadata only.

### Read

RPC-2 includes the common canonical read surface required by wallets, explorers, dApps and developer tooling: block height, block/transaction lookup, receipts, logs, balances, code, storage, transaction count, `eth_call`, gas estimation and EIP-1559 fee helpers.

Read compatibility does not cause 420RPC to determine canonicality or finality. RPC-4 will add explicit freshness/finality safety rules.

### Submit

The only transaction-submission method in RPC-2 is `eth_sendRawTransaction`. 420RPC accepts already-signed transaction bytes for forwarding to an eligible execution upstream. It does not sign, unlock accounts or rewrite signed transaction semantics.

### Subscription

`eth_subscribe` and `eth_unsubscribe` are WebSocket-only and require an upstream whose RPC-1 discovery proved subscription capability. Subscription lifecycle and recovery are implemented later in RPC-7.

## Explicit exclusions

Account-managed methods such as `eth_sendTransaction`, `eth_sign`, `eth_signTransaction`, `eth_accounts` and `eth_coinbase` are not in the public profile because they imply node-side account custody or signing.

The following node-management or privileged namespaces are also outside the public 420RPC surface:

- `engine_`
- `admin_`
- `personal_`
- `debug_`
- `miner_`
- `txpool_`

RPC-5 will add request-validation and method-policy enforcement around this compatibility contract. RPC-2 establishes the contract itself.

## Upstream compatibility

A method being part of RPC-2 does not mean every upstream can serve it. Method eligibility is intersected with the runtime capabilities discovered in RPC-1. For example, raw transaction submission requires the `transaction-submission` capability and subscriptions require the `subscriptions` capability. Ineligible or non-execution upstreams cannot satisfy Ethereum JSON-RPC method profiles.

## Authority boundary

420RPC's method catalogue is a gateway compatibility decision, not a protocol rule. The execution node still validates transactions and returns canonical execution data. Consensus still determines fork choice and finality. Wallets and users remain responsible for signing. 420RPC does not gain authority by deciding which methods it is willing to proxy.
