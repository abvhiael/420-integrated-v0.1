# 420 Developer Hub — DEVHUB-10 Contract Verification Orchestration

## Status

DEVHUB-10 adds the Developer Hub orchestration layer for 420Verify. It validates reproducible verification evidence, binds that evidence to an exact chain/address/runtime-code subject, discovers the canonical 420Verify service from the selected network, and preserves 420Verify's four result classes without converting verification into protocol authority.

420Verify remains the verification authority. The Developer Hub does not become a verifier database, compiler trust root, Registry authority, audit service, security endorsement, wallet authorization surface, or source of canonical chain state.

## Existing 420Verify contract

The repository already defines 420Verify as the canonical discoverable Genesis service `420/service/verify/v1`. Verification answers whether submitted source and exact compiler settings reproduce deployed bytecode at a particular address on a particular network.

The result taxonomy remains:

- `FULL_MATCH`
- `PARTIAL_MATCH`
- `MISMATCH`
- `UNVERIFIABLE`

DEVHUB-10 preserves all four classes. `PARTIAL_MATCH`, `MISMATCH`, and `UNVERIFIABLE` require explicit diagnostic reasons and are never collapsed into an ambiguous boolean badge.

## Verification evidence

DEVHUB-10 introduces a versioned evidence contract with `schemaVersion: 1.0.0`.

Every verification subject is bound to:

- explicit decimal `chainId`;
- contract `address`;
- deployed `runtimeCodeHash`;
- optional `creationBytecodeHash` when recoverable.

The reproducible source/build evidence includes:

- source bundle format;
- repository-relative source bundle path;
- source bundle SHA-256 commitment;
- exact compiler version;
- optimizer enabled state and runs;
- EVM version;
- via-IR setting;
- metadata-hash mode;
- constructor arguments or the explicit `UNKNOWN` marker;
- linked-library addresses;
- proxy/implementation role metadata.

The preferred source format is `solidity-standard-json`. Multi-file bundles are also supported. Flattened source remains a compatibility form and is explicitly labeled as such.

`developer-hub/verification/evidence.example.json` provides the checked-in example structure.

## Canonical subject binding

`createVerificationPlan420()` consumes a DEVHUB-1 discovered network and validated verification evidence.

It fails closed when:

- evidence chain ID differs from the selected network;
- the network exposes no `services.verify` endpoint;
- the verify endpoint is malformed or not HTTP(S);
- the contract address is malformed;
- the runtime code hash is malformed or zero;
- the source bundle path escapes the repository-relative namespace;
- the source bundle hash is malformed or zero;
- compiler settings are incomplete or unsupported;
- linked-library addresses are malformed;
- proxy relationship metadata is malformed.

A verification result cannot be reused across another chain, another contract address, or another runtime code hash.

## DEVHUB-9 deployment handoff

DEVHUB-10 is layered after DEVHUB-9 deployment planning. A DEVHUB-9 externally supplied deployment receipt remains non-canonical until canonical RPC confirmation. DEVHUB-10 therefore does not treat an unconfirmed deployment receipt as sufficient verification evidence.

The verification subject must carry the exact deployed runtime-code hash obtained from canonical chain evidence. This prevents a wallet-, adapter-, or operator-supplied receipt from silently becoming the basis for a verification claim.

## 420Verify submission boundary

`submitVerification420()` accepts a prepared verification plan and an injected transport. The transport is responsible for the concrete 420Verify service protocol once that service endpoint/API is finalized for the selected network.

Developer Hub submits only the normalized subject and evidence package to the canonical discovered verification service. There is no arbitrary verify-service override in the verification plan.

The current public testnet 420Verify readiness metadata still marks the backend/frontend as pending. DEVHUB-10 therefore defines the stable orchestration contract without inventing a production backend URL or silently treating placeholder metadata as live infrastructure.

## Result recording

`recordVerificationResult420()` accepts only the four canonical 420Verify result classes and verifies that the returned:

- chain ID;
- contract address;
- runtime code hash

exactly match the submitted verification subject.

For non-full outcomes, a diagnostic reason is mandatory. A recorded result remains:

`canonicalProtocolState: false`

because the verification database is reproducible evidence rather than canonical protocol state.

## Meaning of FULL_MATCH

A `FULL_MATCH` means the submitted source/compiler/settings reproduce the deployed runtime bytecode under the recorded rules. DEVHUB-10 explicitly retains:

- `verificationIsAudit: false`;
- `verificationIsOfficialRegistration: false`;
- `verificationGrantsWalletAuthority: false`;
- `canonicalProtocolState: false`.

420Registry remains the authority for registered ecosystem identity. 420 Wallet and Smart Accounts remain the authority boundary for user permissions and transaction signing.

## Proxy and upgrade handling

Verification evidence records one of three subject roles:

- `none`;
- `proxy`;
- `implementation`.

A related address may be supplied for proxy/implementation relationships. Proxy shells and implementation contracts remain independent verification subjects. No prior implementation verification is inherited by a new implementation after an upgrade.

## CLI

DEVHUB-10 adds:

```text
420 verify plan EVIDENCE_JSON [--manifest PATH] [--catalogue PATH]
420 verify view EVIDENCE_JSON [--manifest PATH] [--catalogue PATH]
```

`verify plan` validates and emits the exact 420Verify submission plan without performing a network submission.

`verify view` emits the machine-readable verification control view. A new valid plan reports:

`SUBMIT_TO_420VERIFY`

as its next action.

The core runtime also exposes `submitVerification420()` through an injected transport so a finalized browser/service adapter can perform the actual submission without changing evidence semantics.

## Invariants

- **DEVHUB-INV-064** — every verification result is bound to explicit chain ID, contract address, and deployed runtime code hash.
- **DEVHUB-INV-065** — source/build evidence preserves source-bundle commitment and exact compiler configuration required for independent reproduction.
- **DEVHUB-INV-066** — verification service discovery comes only from the selected canonical network manifest; arbitrary verifier substitution is not part of the plan contract.
- **DEVHUB-INV-067** — FULL_MATCH, PARTIAL_MATCH, MISMATCH, and UNVERIFIABLE remain distinct result classes.
- **DEVHUB-INV-068** — PARTIAL_MATCH, MISMATCH, and UNVERIFIABLE preserve explicit diagnostic reasons.
- **DEVHUB-INV-069** — 420Verify evidence/results are non-canonical protocol state and cannot grant Registry legitimacy, wallet authority, governance authority, asset authority, or audit status.
- **DEVHUB-INV-070** — verification results cannot be replayed across a different chain ID, contract address, or runtime code hash.
- **DEVHUB-INV-071** — proxy and implementation contracts remain separately verified subjects; implementation upgrades cannot inherit prior verification.
- **DEVHUB-INV-072** — verification orchestration never accepts or manages private keys, mnemonics, seed phrases, session keys, or signing secrets.
- **DEVHUB-INV-073** — unconfirmed DEVHUB-9 deployment receipts are insufficient proof for source verification; canonical deployed-code evidence remains required.

## Exit criteria

DEVHUB-10 is complete when:

1. verification evidence has a strict, versioned, fail-closed contract;
2. chain/address/runtime-code subject binding is mandatory;
3. source and compiler evidence is reproducible and explicit;
4. the selected canonical 420Verify endpoint is discovered through DEVHUB-1;
5. submission orchestration cannot change verification authority;
6. result taxonomy and mismatch diagnostics are preserved;
7. cross-chain/address/code-hash result reuse fails closed;
8. verification cannot be transformed into an audit, official registration, or wallet permission;
9. CLI plan/view commands expose the same semantics as the runtime orchestration layer.

## Next

DEVHUB-11 adds Developer Hub integration with the 420Indexer public API for blocks, transactions, logs, protocol objects, search-style developer queries, and operational diagnostics while preserving the Indexer's non-authoritative projection boundary.
