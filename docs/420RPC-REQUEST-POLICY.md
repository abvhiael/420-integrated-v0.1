# 420RPC RPC-5 request policy

RPC-5 is the public JSON-RPC request firewall. It validates request envelopes and method-specific parameters before chain-safety or routing logic runs.

## Policy order

1. request must be a JSON object using `jsonrpc: "2.0"`;
2. request ID must be a string, finite number or null;
3. notifications are denied by the default public policy;
4. method must exist in the RPC-2 compatibility catalogue;
5. privileged namespaces and node-managed signing/account methods remain excluded;
6. public requests use positional array parameters;
7. method-specific arity and primitive parameter forms are validated;
8. only an accepted request may proceed to RPC-4 safety filtering and RPC-3 provider routing.

## Privileged surface

The public gateway never exposes `engine_`, `admin_`, `personal_`, `debug_`, `miner_` or `txpool_` namespaces. `eth_sendTransaction`, `eth_sign`, `eth_signTransaction`, `eth_accounts` and `eth_coinbase` remain excluded because 420RPC is non-custodial and does not manage user signing keys.

## Parameter validation

RPC-5 validates canonical address/hash/hex quantity/data forms, block selectors, transaction-call objects, log filters, fee-history percentiles, raw signed transaction bytes and supported subscription types. Invalid parameters fail locally with JSON-RPC `-32602`; blocked or unknown methods fail with `-32601`; malformed request envelopes fail with `-32600`.

RPC-5 does not determine whether a syntactically valid transaction or call is semantically valid on-chain. Execution remains the responsibility of canonical execution nodes.

## Batch boundary

RPC-5 validates individual entries and rejects empty batch envelopes. RPC-6 owns limits on batch length, serialized request size, concurrency, quotas, rate limiting and abuse controls.

## Authority boundary

Request policy controls what the gateway is willing to forward. It does not alter signed transaction bytes, invent chain state, choose fork choice, decide finality or convert unsupported methods into private upstream calls.
