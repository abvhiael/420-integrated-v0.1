---
title: Deployment workflow
audience:
  - developer
category: developer
status: development
version: current
---

# Deployment workflow

420 Integrated deployment tooling is deliberately non-custodial. Developer Hub may validate inputs and build a deployment plan, but the qualified external signer owns authorization and submission, and canonical chain state owns the result.

## 1. Freeze reproducible build inputs

Before submission, preserve the exact source/build inputs required to reproduce the release, including:

- contract and repository artifact identity;
- source bundle and artifact hashes;
- compiler version and settings;
- constructor arguments;
- linked-library addresses;
- metadata mode;
- proxy or implementation context when applicable.

A local artifact is build evidence only. It does not prove what is deployed.

## 2. Bind the request to one environment

The deployment request must identify the selected network/environment, chain ID, intended deployer and execution adapter. Apply the DOC-9.3 network checks before preparing a transaction.

Do not let a deployment tool silently fall back to another endpoint or environment. If the selected environment cannot be proven, stop.

## 3. Plan without signing

Repository-native Developer Hub tooling can validate and render the deployment request. A successful plan should end at a handoff state such as `READY_FOR_EXTERNAL_SIGNER`; it is not a transaction and is not proof of deployment.

```text
420 deploy plan deploy.json
420 deploy view deploy.json
```

Actual contract-specific deployment adapters remain project/runtime code. Use the qualified deployment mechanism for the contract being shipped.

## 4. Hand execution to the signer

Use 420 Wallet or a separately qualified deployment adapter. Developer Hub must not ingest raw private keys, seed phrases, passkey private material or other signing secrets.

The signer is responsible for presenting the operation, obtaining authorization, signing and submitting it to the selected chain.

## 5. Confirm from canonical RPC

Never treat the adapter-returned transaction response as sufficient proof. Confirm from canonical RPC:

- connected chain/environment;
- transaction hash;
- receipt status;
- deployed contract address;
- runtime bytecode at that address;
- runtime bytecode hash;
- appropriate confirmation/finality state for the release policy.

A failed receipt or absent runtime code means the deployment is not usable even if a local tool reported success.

## 6. Preserve release provenance

Carry the confirmed chain ID/environment, transaction hash, contract address, runtime code hash and exact build inputs into verification and registration. These values are the handoff between deployment, 420Verify and 420 Registry.

## Safe deployment state machine

Treat the workflow as distinct states:

`BUILD_READY` -> `PLAN_VALID` -> `READY_FOR_EXTERNAL_SIGNER` -> `SUBMITTED` -> `RECEIPT_CONFIRMED` -> `CODE_CONFIRMED` -> `READY_FOR_VERIFICATION`

Do not collapse these states into a single “deployed” boolean. Each transition has a different authority and failure mode.

## Failure handling

If submission is uncertain, query the transaction hash before retrying. If a deployment transaction may have been accepted, do not blindly submit another creation transaction because that can produce a second contract address. Reconcile canonical chain state first.

Deployment success also does not imply verification, Registry registration, AppStore publication, Wallet capability, audit status or protocol endorsement. Those are separate handoffs.