# 420Verify

420Verify is the contract-source verification application for the 420 Integrated blockchain. It answers a narrow but important question: **does this published source code, compiled with these exact settings, reproduce the bytecode that is actually deployed at this address on this network?**

420Verify is a Genesis user application and canonical discoverable service (`420/service/verify/v1`), but it does not require its own protocol-state contract. Deployed bytecode and deployment context come from canonical chain state. Registered application/service identity comes from 420Registry. 420Explorer and 420AppStore may display 420Verify results, but neither presentation layer changes what a verification result means.

## Verification result classes

- **FULL_MATCH** — the submitted compiler inputs reproduce the deployed runtime bytecode under the recorded verification rules.
- **PARTIAL_MATCH** — meaningful portions correspond, but some reproducibility condition is unresolved or differs and is explicitly reported.
- **MISMATCH** — compilation completes but does not reproduce the deployed bytecode.
- **UNVERIFIABLE** — required compiler/source/deployment information is unavailable, invalid, unsupported or insufficient to make a reproducible determination.

420Verify must not collapse these outcomes into a misleading binary badge.

## Recorded evidence

Verification is bound to the chain ID, contract address and deployed runtime code hash. A published result records or commits to the source bundle, compiler version, optimizer status/runs, EVM version, via-IR setting, metadata-hash mode, linked libraries, constructor arguments or an explicit unknown marker, immutable handling and creation bytecode when it can be recovered.

The preferred submission format is Solidity Standard JSON Input with a complete multi-file source bundle. Flattened source is accepted only as a compatibility path because flattening can lose build context.

## Proxies and upgrades

Proxy shells and implementation contracts are separate verification subjects. A verified proxy does not imply that its implementation is verified or safe. A verified implementation does not imply that the proxy admin or upgrade path is safe. When an implementation changes, the new code must be independently verified; the previous implementation's status cannot be inherited.

## What “verified” means

A full verification means that published source/build inputs correspond to deployed code. It does **not** mean:

- independently audited;
- secure or bug-free;
- endorsed by 420 Integrated;
- officially registered;
- immutable or non-upgradeable;
- non-malicious;
- legally compliant;
- authorized to access a user's wallet.

420Registry remains the canonical source for registered protocol/application identity. 420Wallet and Smart Accounts remain the authorization boundary for user permissions and transactions.

## Ecosystem use

420Explorer can link deployed bytecode to readable source and compiler evidence. 420AppStore can show sourced verification context beside publisher, version, permission and security information. Developers can use 420Verify to publish reproducible builds, users can inspect contracts before interacting, and auditors/security researchers can reproduce the exact deployed artifact independently.

420Verify is intentionally replaceable: independent verification services and local reproducible builds must be able to reach the same result from the same evidence.
