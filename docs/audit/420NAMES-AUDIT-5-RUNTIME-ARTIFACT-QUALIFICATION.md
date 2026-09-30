# NAMES-AUDIT-5 — Canonical runtime artifact generation and freeze

Status: **QUALIFICATION PENDING**

Qualification level: **Level 1 — per-roadmap-step fast qualification**

## Canonical step

**NAMES-AUDIT-5 — generated runtime artifact**

Canonical requirement:

> compile the exact canonical Names420 source with pinned compiler settings and freeze reproducible ABI/runtime bytecode/artifact metadata.

This step intentionally stops at compiler-artifact identity. Constructor immutable materialization, final runtime `keccak256/extcodehash`, deterministic Genesis storage, storage root and deployment-manifest binding are NAMES-AUDIT-6.

## Frozen compiler inputs

- source: `contracts/src/apps/Names420.sol`
- source Git blob SHA-1: `4cb9b06b4a3febb3bf024c087f3ade1eebdcf31d`
- Solidity: `0.8.24`
- EVM: `cancun`
- optimizer: enabled
- optimizer runs: `200`
- via IR: enabled
- Foundry config blob SHA-1: `f18c965f43b244582f2a4c527e7bad6d23aee929`
- toolchain config blob SHA-1: `dd49cb0e07370b01401d63d2fb53683177de8abc`

## Frozen artifact

Path:

`contracts/artifacts/Names420.json`

Retained identity:

- schema: `420-names-compiler-artifact-v1`
- status: `NAMES_AUDIT_5_FROZEN_COMPILER_ARTIFACT`
- canonical address context: `0x0000000000000000000000000000000000000435`
- compiler runtime template bytes: `4336`
- compiler runtime-template SHA-256: `7b34c5506c526d9c7015d4d2c4514cacac585bd571050a53655ea2270d1210bd`
- creation bytecode bytes: `4491`
- creation bytecode SHA-256: `d69598a97871fe5f681f27886ab2b68fc232fafa1a2b53498873d3628fd9d7e3`
- artifact payload SHA-256: `c40970d3a04503309f9467eaca00c915f5ce3dd1e993c2df3318aa6cd149ab2c`
- compiler metadata SHA-256: `63f99e7d0d5970a7c13935719d0de4d1a26ba81099a1d131ee9c3cdd5390280b`
- immutable identifiers: `1`
- immutable materialization locations: `1`
- immutable reference: compiler identifier `946`, start `1126`, length `32`

The artifact also retains the complete compiler ABI and storage layout.

Compiler storage-layout roots:

- slot 0: `records`
- slot 1: `commitments`
- slot 2: `primaryNameByAddress`
- `governanceTimelock` is absent from mutable storage and is represented by compiler immutable metadata.

## Reproducibility implementation

`scripts/generate-names-audit-5-artifact.py`:

1. requires a fresh pinned Foundry `Names420` build;
2. validates canonical address/source/artifact mapping;
3. validates Solidity 0.8.24 / Cancun / optimizer 200 / via-IR settings;
4. validates compiler metadata version;
5. validates the required Names ABI and event surface;
6. freezes creation bytecode;
7. freezes the compiler-emitted deployed-runtime template without constructor materialization;
8. validates and retains compiler `immutableReferences`;
9. validates and retains compiler storage layout;
10. records source/config/toolchain provenance;
11. byte-for-byte reproduces the committed artifact in `--check` mode;
12. verifies the predeploy plan binds the same source/template/payload hashes.

`scripts/test-names-audit-5-artifact.py` provides adversarial coverage for:

- missing required ABI function;
- missing required event;
- missing immutable references;
- multiple immutable identifiers;
- out-of-bounds immutable reference;
- wrong immutable width;
- incomplete storage layout;
- accidental mutable governance-timelock storage;
- wrong compiler version;
- malformed hex payload.

## Predeploy-plan binding

`contracts/config/predeploy/predeploy-plan.json` now records:

- status `COMPILER_ARTIFACT_FROZEN`;
- exact source blob SHA-1;
- compiler runtime-template SHA-256;
- artifact payload SHA-256.

It does **not** claim a final materialized runtime code hash or Genesis storage root.

## Security / correctness boundary

NAMES-AUDIT-5 freezes what the compiler produced; it does not guess constructor effects from Solidity source text.

The final predeploy runtime cannot be considered deployable yet because `SystemAccess.governanceTimelock` is immutable and the compiler runtime template still requires constructor-value materialization. NAMES-AUDIT-6 must consume the compiler-reported immutable reference and storage layout to derive the actual Genesis runtime/state.

## Required Level-1 checks

The final exact implementation head must pass:

1. exact-head checkout;
2. Genesis interface-layer verifier;
3. Names dependency-model verifier;
4. Names Solidity formatting;
5. pinned `forge build src/apps/Names420.sol`;
6. canonical artifact regeneration;
7. adversarial artifact-generator tests;
8. clean committed-artifact status;
9. byte-for-byte `--check` reproducibility;
10. predeploy-plan provenance/hash binding;
11. retained Names Wallet/static checks applicable to the accumulated app branch;
12. Names authority/opcode scan.

Previously qualified contract behavior is preserved and does not require full fuzz/invariant/Slither reruns when the exact commit changes only artifact/evidence metadata.

## Level-2 status

Not required for NAMES-AUDIT-5 alone. The natural Level-2 milestone remains after NAMES-AUDIT-6, when the frozen compiler artifact and deterministic Genesis materialization converge.

## Deferred Level-3 / later-phase checks

- complete repository Solidity/Genesis qualification;
- 420 Integrated Qualification;
- repository-wide Docs/global reconciliation;
- final constructor immutable materialization;
- final runtime code hash;
- deterministic predeploy storage/root;
- deployment-manifest binding;
- Indexer/Search descriptor reconciliation;
- live testnet/runtime verification.

## Repository state at evidence creation

- repository: `abvhiael/420-integrated-v0.1`
- branch: `audit/420names-complete-20260930`
- PR: #427
- evidence-creation head: `3f31dab857928632c6a42fbadbc4ed15839eb895`
- current main: `8fbc37f254666fad5088d31101582a3cf292de9a`
- ahead: 87
- behind: 56

Current-main divergence is retained for the accumulating app audit branch. No ceremonial merge is performed because NAMES-AUDIT-5 depends on the exact branch source/config artifact being frozen; full reconciliation remains mandatory at phase closeout or earlier if an actual dependency conflict appears.

## Completion criterion

NAMES-AUDIT-5 is COMPLETE when the exact-head Names Level-1 workflow reproduces `contracts/artifacts/Names420.json` byte-for-byte from the pinned source/compiler/config inputs, validates the adversarial generator suite and predeploy-plan binding, and no artifact drift remains.

The next canonical roadmap step is:

**NAMES-AUDIT-6 — deterministic Genesis state** — derive constructor/storage state from compiler layout, generate Names420 predeploy state, code hash and storage root, and bind them into deployment/predeploy manifests.
