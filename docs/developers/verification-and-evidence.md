---
title: Verification and evidence
audience:
  - developer
category: developer
status: development
version: current
---

# Verification and evidence

420Verify answers a narrow question: whether published source/build inputs reproduce the code deployed at a specific network/address under the recorded verification rules. It is evidence, not an audit or endorsement.

## Canonical anchor

Start only after deployment has been confirmed from canonical RPC. Bind verification evidence to:

- exact network/environment and chain ID;
- exact contract address;
- deployed runtime-code hash;
- creation-bytecode hash when recoverable;
- source-bundle hash;
- compiler version and settings;
- constructor arguments;
- linked-library addresses;
- proxy/implementation context when applicable.

An unconfirmed deployment receipt is not sufficient evidence.

## Plan versus result

Developer Hub may validate and render a verification plan:

```text
420 verify plan verify.json
420 verify view verify.json
```

The plan is an orchestration object. It does not itself classify the deployment.

## Result classes

420Verify can report:

- `FULL_MATCH` — the recorded build inputs reproduce the deployed code under the verification rules;
- `PARTIAL_MATCH` — evidence matches only the supported/declared subset and must retain caveats;
- `MISMATCH` — supplied evidence does not reproduce the deployed code;
- `UNVERIFIABLE` — available evidence is insufficient to establish a reproducible result.

Consumers must preserve the exact result class and caveats. Do not turn `PARTIAL_MATCH` into a green “verified” badge equivalent to `FULL_MATCH`.

## What FULL_MATCH does not mean

A full reproducible match does not establish that the contract is:

- audited or secure;
- bug-free;
- official or Registry-registered;
- immutable;
- approved by governance;
- authorized by a Wallet or Smart Account;
- suitable for a specific user or transaction.

420 Registry remains the authority for registered ecosystem identity. Wallet/Smart Account remains the authority for user signing and capability decisions.

## Proxies and upgrades

For proxy deployments, verify and present proxy code and implementation code separately. A later implementation upgrade changes the effective executable logic and requires fresh provenance/evidence for the new implementation. Historical evidence should remain attached to the historical code/address/version it actually proved.

## Consumer rules

Explorer, AppStore and other surfaces may display 420Verify evidence, but should include network, address, code-hash and result provenance. If current chain code no longer matches the verified code hash, the old verification evidence must not be presented as current evidence.

## Failure handling

Treat `MISMATCH` as a stop condition for release/registration unless the discrepancy is explicitly understood and the release evidence is corrected. Treat `UNVERIFIABLE` as unknown, not as a weak success. Re-run verification only after identifying which build or chain input changed.