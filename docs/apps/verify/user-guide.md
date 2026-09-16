# User guide

420 Verify lets users and developers inspect whether published Solidity source/build inputs correspond to the code deployed at an exact network/address/runtime-code-hash binding.

## Result classes

- `FULL_MATCH` — runtime bytecode matches exactly and creation bytecode also matches when canonical creation evidence is recoverable.
- `PARTIAL_MATCH` — runtime matches exactly but an additional comparison, usually creation bytecode, cannot be completed.
- `MISMATCH` — reproduced bytecode differs from canonical deployed evidence.
- `UNVERIFIABLE` — required canonical or build evidence is missing, invalid, or unsupported.

Each result includes diagnostics explaining why that class was assigned.

## Evidence and history

Evidence records preserve source commitments, compiler identity/settings, build commitments, canonical deployment provenance, bytecode results, classification, diagnostics, and a record content hash. Histories are append-only and separated when the deployed runtime code hash changes.

## Proxies

Proxy shells and implementation contracts are verified separately. An implementation upgrade invalidates the prior implementation's current status; historical evidence remains visible, but the new implementation must be verified independently.

## Ecosystem displays

420 Explorer may link to readable source and evidence. 420 AppStore may show verification as sourced security context. 420 Registry remains the identity authority, and Wallet/Smart Accounts remain the permission/signing authority.

## Important warning

Verification only means source/build inputs correspond to deployed code. It does not mean audited, safe, official, immutable, authorized, non-malicious, or legally compliant.
