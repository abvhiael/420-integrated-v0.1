# NAMES-AUDIT-6 — Deterministic Genesis predeploy state

Status: **COMPLETE**

Qualification level: **Level 1 + Level 2 app-integration milestone**

Qualified implementation SHA: `f4a1242c155b75edb09e907e4bf0f8559bcebbe1`

420Names qualification run: `36796471172` — **SUCCESS**

Wallet Web deployment/inventory run on the same SHA: `36796471139` — **SUCCESS**

## Canonical requirement

NAMES-AUDIT-6 requires the frozen NAMES-AUDIT-5 compiler artifact to be converted into deterministic Genesis predeploy state by deriving constructor/immutable materialization and storage state from compiler output, generating the final runtime code hash and storage root, and binding those results into the deployment/predeploy manifests.

## Final Genesis identity

Canonical Names420 address:

`0x0000000000000000000000000000000000000435`

Governance timelock constructor value:

`0x0000000000000000000000000000000000000429`

Materialized runtime:

- source compiler artifact: `contracts/artifacts/Names420.json`
- runtime bytes: `4336`
- compiler-reported immutable identifier: `946`
- immutable offset: `1126`
- immutable length: `32`
- materialized value: ABI-encoded `0x0429`
- final runtime code hash: `0xa974fffd3a40e7f28db41e4ae30656b33789d2483b18b47c809ce2385de709b7`

Mutable Genesis storage:

- constructor mutable storage writes: `0`
- `records` mapping root slot: `0`
- `commitments` mapping root slot: `1`
- `primaryNameByAddress` mapping root slot: `2`
- initialized concrete storage slots: `0`
- storage root: `0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421`
- root basis: Ethereum empty storage-trie root, `keccak256(0x80)`

The governance timelock is a Solidity immutable and therefore does not occupy mutable storage.

## Retained artifacts and bindings

Generated/frozen:

- `contracts/artifacts/Names420.json`
  - preserves the NAMES-AUDIT-5 compiler projection;
  - adds `genesisMaterialization` with the final materialized deployed runtime and runtime code hash.
- `contracts/config/predeploy/Names420-predeploy-state.json`
  - canonicalized byte-for-byte deterministic state;
  - records constructor materialization, runtime hash, storage layout roots, empty storage root and Level-2 milestone requirement.
- `contracts/config/predeploy/predeploy-plan.json`
  - Names420 status: `ARTIFACT_READY`;
  - constructor strategy: `DIRECT_GENESIS_IMMUTABLE_MATERIALIZATION`;
  - binds final runtime hash and predeploy-state path.
- `contracts/config/deployment-manifest.json`
  - binds runtime artifact, final runtime code hash, predeploy-state file and source blob identity.

Generator:

`scripts/generate-names-audit-6-genesis-state.py`

The generator always reconstructs from the frozen compiler projection, never from a previously materialized runtime, patches only the compiler-reported immutable reference, derives `keccak256` of the resulting deployed runtime, derives the empty storage root, and validates manifest bindings.

## Adversarial / boundary qualification

`scripts/test-names-audit-6-genesis-state.py` verifies:

1. governance timelock is materialized only at the compiler-reported reference;
2. incorrect immutable-reference count fails closed;
3. incorrect immutable width fails closed;
4. out-of-bounds immutable reference fails closed;
5. storage-root layout is exact;
6. storage-layout drift fails closed;
7. frozen source-identity drift fails closed;
8. final materialized runtime differs from the raw compiler template.

All 8 adversarial tests passed on the qualified implementation SHA.

## Level 1 results

Run `36796471172` on exact SHA `f4a1242c155b75edb09e907e4bf0f8559bcebbe1`:

- exact-head verification — PASS
- Genesis interface-layer inventory — PASS
- Names dependency-model verification — PASS
- Solidity formatting — PASS
- NAMES-AUDIT-5 compiler projection/build/reproducibility — PASS
- NAMES-AUDIT-6 deterministic runtime/state regeneration — PASS
- byte-for-byte committed state cleanliness — PASS
- predeploy/deployment manifest binding verification — PASS
- 8/8 Genesis-state adversarial tests — PASS
- Wallet Names integration/management tests — PASS
- Names-only Wallet static qualification — PASS
- authority/opcode scan — PASS

Wallet Web Verification `36796471139` also passed on the same SHA, including deployment inventory and predeploy/global-namespace regressions.

## Level 2 milestone

NAMES-AUDIT-6 is the app-integration milestone where previously qualified contract behavior, hardening/invariants, the frozen compiler artifact, deterministic Genesis materialization and Wallet deployment consumption converge.

On exact SHA `f4a1242c155b75edb09e907e4bf0f8559bcebbe1`:

- full retained Names Solidity suite including hardening/invariants — PASS
- targeted Names420 Slither gate — PASS
- deterministic Genesis-state gate — PASS
- Wallet Names integration/management tests — PASS
- Names Wallet static gate — PASS
- Wallet Web deployment/inventory verification — PASS

A previous attempt exposed only a canonical JSON key-order mismatch. The data was identical; the committed predeploy-state file was then rewritten to the generator's canonical `sort_keys=True` form. The final exact-head milestone run passed without weakening the reproducibility check.

## Main divergence

Current main observed during evidence closeout:

`df8f639d8f43b763298c8750ef49d3e5849c597c`

Audit branch is ahead/behind current main, but comparison found no step-specific conflict requiring early ceremonial reconciliation. Full main reconciliation remains mandatory at Level 3 complete app-phase closeout.

## Limitations / deferred work

NAMES-AUDIT-6 provides deterministic **offline Genesis predeploy evidence**, not live-chain proof.

Still deferred:

- NAMES-AUDIT-7 Indexer/Search descriptor reconciliation against the frozen artifact;
- NAMES-AUDIT-8 operator/deployment documentation;
- NAMES-AUDIT-9 production-equivalent testnet `eth_getCode`, runtime-hash, storage, governance, Registry, Wallet and indexing verification;
- Level-3 repository-wide complete app-phase reconciliation and qualification.

## Exit criteria

- compiler-derived constructor/immutable state: **SATISFIED**
- deterministic mutable storage state: **SATISFIED**
- final materialized deployed runtime: **SATISFIED**
- final runtime code hash: **SATISFIED**
- deterministic storage root: **SATISFIED**
- retained predeploy-state artifact: **SATISFIED**
- predeploy-plan binding: **SATISFIED**
- deployment-manifest binding: **SATISFIED**
- adversarial generator tests: **SATISFIED**
- exact-head Level-1 qualification: **SATISFIED**
- Level-2 app milestone: **SATISFIED**

## Next canonical roadmap step

**NAMES-AUDIT-7 — indexer/search artifact reconciliation** — build real event descriptors from the frozen Names420 artifact and qualify lifecycle/query/reorg/recovery behavior against those exact descriptors.
