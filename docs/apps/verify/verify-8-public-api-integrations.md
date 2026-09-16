---
title: VERIFY-8 public API and Genesis integrations
audience: [developer, auditor]
category: application
status: development
version: current
---
# VERIFY-8 public API and Genesis integrations

VERIFY-8 exposes public, non-canonical 420Verify evidence without turning verification into protocol authority.

## Public API

The service exposes:

- `GET /v1/verify/{chainID}/{address}/{runtimeCodeHash}` — latest stored verification evidence for the exact deployment binding.
- `GET /v1/verify/{chainID}/{address}/{runtimeCodeHash}/history` — complete append-only verification history for that exact binding.
- `GET /v1/verify/evidence/{recordHash}` — reproducible evidence lookup by VERIFY-6 record content hash.
- `POST /v1/verify/submissions` — source/build submission entry point. The handler validates chain/address/source commitments and delegates verification to an injected processor. If no processor is configured, it fails closed with HTTP 503 rather than accepting or fabricating a result.

All lookup identity includes chain ID, address and deployed runtime code hash. Evidence for a different network, address or code hash is never reused.

## Consumer boundary

Every public result carries integration metadata with:

- `canonical: false`
- `registryAuthority: false`
- `walletAuthority: false`
- `appStoreSecurityContext: true`
- an Explorer address path derived from the verified chain/address
- an explicit warning that verification is not an audit, safety guarantee, official status, immutability claim, authorization grant or non-maliciousness claim

420Explorer may present published verification evidence and link to its source/build history. 420AppStore may consume the sourced verification class as one security-context signal. Neither consumer may reinterpret the result as canonical state or an endorsement.

420Registry remains the authority for registered application/service identity and legitimacy. A successful 420Verify result cannot register an application, alter Registry state, grant Wallet or Smart Account permissions, approve spending or authorize governance actions.

## Availability

The evidence lookup API is mounted by the 420Verify runtime whenever the evidence store opens successfully. Source submission is fail-closed when a verification processor is unavailable. Verify service unavailability must not block canonical chain operation, Registry reads, Wallet operation or Explorer chain-state access.
