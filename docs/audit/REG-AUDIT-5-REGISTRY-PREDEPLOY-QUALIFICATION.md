# REG-AUDIT-5 — Registry predeploy artifact qualification

## Canonical step

**REG-AUDIT-5 — generate final Registry artifact and predeploy state**

Canonical requirements from `docs/audit/420REGISTRY-COMPLETE-AUDIT-20260928.md`:

- compile Solidity 0.8.24 / Cancun with pinned settings;
- retain the `ProtocolRegistry` runtime artifact;
- record the runtime code hash;
- materialize immutable/constructor effects correctly for direct Genesis predeploy;
- record storage/root evidence where applicable.

Canonical exit:

> reproducible Registry predeploy artifact tied to exact source SHA.

## Implementation

REG-AUDIT-5 retains compiler-derived evidence for ProtocolRegistry at the canonical Genesis address
`0x0000000000000000000000000000000000000434`.

Pinned build profile:

- Solidity: `0.8.24`
- EVM: `cancun`
- optimizer: enabled
- optimizer runs: `200`
- via IR: enabled

The contract inherits `SystemAccess`, where `governanceTimelock` is a Solidity immutable. Direct Genesis
predeploy placement does not execute the constructor, so REG-AUDIT-5 uses the compiler-emitted
`immutableReferences` to materialize the constructor argument
`0x0000000000000000000000000000000000000429` into the deployed runtime bytecode.

The ProtocolRegistry constructor performs no mutable-storage writes. Compiler-derived storage layout is
retained, but all mappings/scalars begin in their zero/empty state. The predeploy state therefore records
zero explicit storage slots and the Ethereum empty storage-trie root.

## Canonical retained evidence

- source: `contracts/src/apps/ProtocolRegistry.sol`
- source Git blob SHA-1: `9ab3d53a68b6533978f41e0202e5268f1d615c19`
- artifact: `contracts/artifacts/ProtocolRegistry.json`
- state: `contracts/config/predeploy/ProtocolRegistry-predeploy-state.json`
- runtime code hash: `0x9f9e5f794296cf9faf5f8c8d17cd815f3c19c004a158c15cb61b5a29eaacb330`
- immutable materialization references: `7`
- mutable constructor storage slots: `0`
- storage root: `0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421`
- canonical Registry address: `0x0000000000000000000000000000000000000434`
- GovernanceTimelock immutable: `0x0000000000000000000000000000000000000429`

## Reproducibility and verification

`scripts/generate-reg-audit-5-registry-predeploy.py`:

1. validates the pinned Foundry/toolchain configuration;
2. validates the canonical Registry predeploy address/source/artifact mapping;
3. consumes Foundry's deployed runtime artifact;
4. consumes compiler-emitted immutable references;
5. materializes the immutable GovernanceTimelock;
6. obtains compiler storage layout with `forge inspect`;
7. derives the runtime EVM code hash with `cast keccak`;
8. derives the empty storage-trie root with `cast keccak 0x80`;
9. writes canonical artifact/state files;
10. byte-for-byte verifies the committed files against fresh generation.

`scripts/test-reg-audit-5-registry-predeploy.py` adds focused negative/adversarial coverage for missing,
multiple, malformed and out-of-bounds immutable references and rejects any model where the governance
timelock appears as mutable storage.

`.github/workflows/registry-reg-audit-5.yml` checks out the exact PR head, verifies the exact SHA,
compiles the exact candidate, regenerates and verifies artifact/state, runs the adversarial generator
tests and retained Registry Solidity regressions.

## Parent configuration updates

- `contracts/config/predeploy/predeploy-plan.json` marks ProtocolRegistry `ARTIFACT_READY`, records
  the exact runtime code hash, source blob and state evidence, and records direct immutable materialization.
- `contracts/config/deployment-manifest.json` binds the canonical ProtocolRegistry entry to the exact
  artifact, runtime code hash, source blob and predeploy-state record.

These changes are Registry-scoped. They do **not** claim the entire Genesis predeploy set is artifact-ready.

## Security and integration conclusions

- no Registry Solidity source or authorization semantics were weakened for this step;
- constructor authority is materially preserved in runtime bytecode through compiler-reported immutable offsets;
- no constructor storage is invented from source text;
- runtime hash is computed from the materialized deployed runtime, not creation bytecode;
- canonical address remains `0x0434`;
- live-chain deployment is explicitly outside REG-AUDIT-5 and remains a later roadmap gate.

## Limitations

This evidence is an offline, reproducible Genesis predeploy artifact. It is **not** production-equivalent
testnet deployment evidence and does not assert `eth_getCode`, live storage, transaction receipt, block,
chain identity or on-chain code-hash verification. Those remain REG-AUDIT-8 responsibilities.

Generated catalogue/reference cleanup remains REG-AUDIT-6.

## Exact-head qualification

The exact qualified commit SHA and final CI run IDs are recorded in PR #409 metadata after the
evidence-recording head itself passes the retained qualification suite. This avoids creating an
evidence-only commit after qualification and thereby invalidating the exact-head proof.

**Status before final exact-head CI:** IMPLEMENTED — qualification pending.
