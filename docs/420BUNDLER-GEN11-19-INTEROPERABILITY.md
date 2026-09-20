# GEN-11.19 — cross-client / independent-operator compatibility

Status: **implementation in qualification; live independent-operator acceptance remains open**. This phase does not certify a third-party network deployment, substitute for GEN-11.18 ordering closeout, or authorize a GEN-11.20 merge.

## Public operator wire contract

An operator exposes a POST-only JSON-RPC 2.0 endpoint accepting the nine-field signed `PackedUserOperation420` envelope (`sender`, `nonce`, `initCode`, `callData`, `accountGasLimits`, `preVerificationGas`, `gasFees`, `paymasterAndData`, `signature`) and the configured EntryPoint address. Quantities are 0x-prefixed canonical hexadecimal strings; dynamic bytes are 0x-prefixed even-length hex. An operation is bound to chain ID and EntryPoint by the canonical `EntryPoint420.getUserOpHash` algorithm, excluding signature from that hash. Independent operators must not replace wallet authorization or alter signed operation bytes.

The public RPC vocabulary is `eth_supportedEntryPoints`, `eth_sendUserOperation`, `eth_estimateUserOperationGas` and `eth_getUserOperationReceipt`. Admission returns the canonical UserOperation hash only after the local validation and simulation gate; receipt lookup returns JSON `null` until matched canonical inclusion evidence exists. Included receipt fields are `userOpHash`, `entryPoint`, `transactionHash`, `blockHash`, `blockNumber`, `success`, and `lifecycle: "included"`. Inclusion is not a claim of finality. Operational admission by one operator does not guarantee admission by another operator with an independently configured mempool, fee rules or chain view.

## Browser interoperability

Set `BUNDLER_CORS_ORIGINS` to a comma-separated list of exact web origins, for example `https://wallet.example,https://extension.example`. The default empty list disables cross-origin browser requests, while native and same-origin requests remain possible. Only HTTPS origins are allowed, except explicit HTTP localhost loopback origins for development. Credentials, wildcards, paths, queries and fragments are rejected at startup. Allowlisted JSON-RPC browser clients receive `Access-Control-Allow-Origin` for their exact origin and a bounded `OPTIONS` preflight for POST + `Content-Type`; no credential-sharing header is emitted. This CORS wrapper is mounted **only** on the public JSON-RPC route, not peer ingress, health or status. CORS is not authentication: production deployment still requires TLS, admission limits, abuse protection and network-layer controls.

## Operator/client conformance checks

- Go RPC compatibility tests build Wallet-style and independent-client-style JSON-RPC requests, exercise two separately configured fake operator backends, and verify hash normalization, request ID preservation, EntryPoint discovery and `null`/included receipt field compatibility.
- Browser CORS tests cover preflight, exact-origin acceptance, untrusted-origin rejection, native-client access and forbidden origins/headers.
- The 420Wallet Bundler transport selects an operator before sending, validates the operator's EntryPoint support, checks the returned canonical operation hash and does not automatically retry an ambiguous send against another operator.

## Required before GEN-11.20 closeout

Run the same signed UserOperation across two independently deployed compatible operators on the **same verified chain and EntryPoint**, check each operator's local admission and lifecycle, test an unavailable primary operator before submission, and test an ambiguous post-send failure without duplicate execution. Exercise web-wallet CORS from its actual deployed origin, plus mobile/extension/native clients. Test wrong chain/EntryPoint, canonical-hash mismatches, hostile receipts, reorgs, gas estimate divergence and stale nodes. Preserve complete run IDs, exact commit, network identifiers and independent receipt/block evidence. Local mock-backed compatibility tests alone do not satisfy these live gates.
