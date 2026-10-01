# ID-AUDIT-4 — generated ABI, artifact and reference metadata

**Status:** IMPLEMENTED — Level 1 qualification pending exact-head materialization/CI  
**Repository:** `abvhiael/420-integrated-v0.1`  
**Working PR:** #438  
**Canonical roadmap:** `docs/audit/420IDENTITY-AUDIT-REMEDIATION-ROADMAP.md`

## Original step

ID-AUDIT-4 requires the exact `Identity420` artifact to be generated and retained
from the pinned Solidity/compiler profile, including ABI, runtime-bytecode identity,
source identity and generated-reference integration.

**Exit criterion:** `contracts/artifacts/Identity420.json` and generated references
reproduce deterministically and pass verification.

## Canonical phase boundary

ID-AUDIT-4 retains the **compiler-emitted build/runtime template identity**.

It does **not** materialize the GovernanceTimelock immutable into final Genesis runtime,
advance the predeploy plan to artifact-ready, or claim a final runtime code hash.
Those are canonical ID-AUDIT-5 responsibilities.

The retained artifact therefore records:

- exact source Git blob identity;
- pinned Solidity/compiler/optimizer/EVM/via-IR profile;
- creation bytecode identity;
- deployed bytecode template and template Keccak identity;
- compiler-emitted immutable references;
- ABI and canonical ABI SHA-256;
- compiler storage layout;
- frozen canonical Identity address;
- an explicit marker that final runtime materialization remains ID-AUDIT-5 work.

## Implementation

Added:

- `scripts/generate-id-audit-4-identity-artifact.py`
- `scripts/verify-id-audit-4-artifact.py`
- `.github/workflows/identity-id-audit-4.yml`

The generator deterministically owns:

- `contracts/artifacts/Identity420.json`;
- the `Identity420` entry in `developer-hub/catalogue/local.example.json`.

The existing generated-reference pipeline then deterministically owns the updated
`docs/reference/generated/**` outputs.

## Generated-reference integration requirements

The retained Identity catalogue/reference entry must bind:

- contract: `Identity420`;
- protocol: `420Identity`;
- version: `3.0.0`;
- frozen address: `0x0000000000000000000000000000000000000436`;
- artifact: `contracts/artifacts/Identity420.json`;
- frozen interface: `contracts/src/interfaces/genesis/IIdentityCredential420.sol`;
- canonical SHA-256 of the retained ABI;
- `verified: true` only when the artifact exists and the ABI identity matches.

Generated contract and event/error references must include Identity420 and remain
visibly scoped as local/repository reference evidence rather than live deployment proof.

420Indexer must retain its canonical `Identity420 -> 420Identity` descriptor mapping.

## Security / integrity checks

Level 1 requires:

1. exact-head pinned Foundry compilation of `Identity420.sol`;
2. deterministic artifact regeneration and byte-for-byte `--check`;
3. source blob identity verification;
4. compiler profile verification;
5. ABI SHA-256 verification;
6. immutable-reference retention;
7. explicit rejection of a false final-runtime-hash claim before ID-AUDIT-5;
8. canonical address/interface/catalogue parity;
9. required Identity event presence in retained ABI;
10. generated-reference deterministic regeneration/check;
11. directly applicable Indexer/reference/catalogue tests;
12. active docs/config CI triggered by changed generated references.

## Level 2 disposition

No Level 2 milestone is required. ID-AUDIT-4 creates deterministic build/reference
metadata and introduces no new runtime authority or shared service dependency.

## Level 3 disposition

Complete repository/main/Genesis reconciliation remains intentionally deferred to
**ID-AUDIT-10 — phase closeout, reconciliation and retained evidence**.

## Exact-head qualification evidence

Pending generated artifact materialization and exact-head CI.

## Completion state

**PENDING LEVEL 1 EXACT-HEAD QUALIFICATION**

Next canonical step after successful closeout:

**ID-AUDIT-5 — final Identity predeploy artifact and state**
