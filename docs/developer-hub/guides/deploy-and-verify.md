# Deploy and verify a contract

This guide connects the DEVHUB-9 deployment planner to DEVHUB-10 verification orchestration without moving signing, chain truth or verification authority into Developer Hub.

## Goal

Deploy an application contract with explicit artifact provenance, external signing, canonical receipt confirmation and reproducible 420Verify evidence.

## 1. Produce a qualified artifact

Before deployment, preserve:

- contract name;
- repository-relative artifact path;
- artifact SHA-256;
- source bundle;
- compiler version and settings;
- constructor arguments;
- linked-library addresses;
- metadata mode and other reproducibility inputs.

Artifact provenance is developer/build evidence. It is not deployed-chain proof.

## 2. Build the deployment request

Use the DEVHUB-9 request shape and bind it to the selected chain ID, public deployer identity and explicit external executor.

```text
420 deploy plan deploy.json
420 deploy view deploy.json
```

A valid initial plan ends at `READY_FOR_EXTERNAL_SIGNER`.

**Authority:** Developer Hub validates/plans only.

## 3. Hand execution to the signer

Use `420-wallet` or a separately qualified project deployment adapter. Developer Hub does not accept raw private keys, mnemonics or signing secrets.

The external signer owns authorization and submission.

**Authority:** Wallet/project adapter for signing; chain RPC for submitted transaction state.

## 4. Confirm the receipt from canonical RPC

Do not treat an adapter-returned receipt as canonical proof by itself. Confirm:

- chain ID;
- transaction hash;
- contract address;
- receipt status;
- deployed runtime bytecode;
- runtime bytecode hash.

Only canonical chain state can establish what code is actually deployed at the address.

## 5. Build verification evidence

Bind DEVHUB-10 evidence to:

- exact chain ID;
- exact contract address;
- deployed runtime-code hash;
- creation-bytecode hash when recoverable;
- source-bundle hash;
- compiler version/settings;
- constructor/library/proxy context.

```text
420 verify plan verify.json
420 verify view verify.json
```

A plan is an orchestration object, not a verification result.

## 6. Submit to 420Verify

420Verify reports one of:

- `FULL_MATCH`;
- `PARTIAL_MATCH`;
- `MISMATCH`;
- `UNVERIFIABLE`.

A `FULL_MATCH` means the published source/build inputs reproduce deployed code under the recorded rules. It does not mean audited, safe, official, immutable, registered or wallet-authorized.

**Authority:** 420Verify for verification classification; chain state for deployed code; 420Registry for official registration.

## 7. Keep registration separate

Verification does not publish an application into 420Registry or 420AppStore. That workflow belongs to DEVHUB-13 and the owning Registry/AppStore authority.

## Boundary summary

| Stage | Owner | Canonical? |
| --- | --- | --- |
| Build artifact | build system | No |
| Deployment plan | Developer Hub | No |
| Signature/submission | Wallet/project adapter | Authorization yes |
| Receipt/deployed code | 420 chain RPC | Yes |
| Verification result | 420Verify | Reproducible evidence, not protocol legitimacy |
| App registration | 420Registry / 420AppStore | Separate canonical authority |

The safe workflow is a chain of handoffs, not one privileged Developer Hub deploy-and-bless command.
