# ID-AUDIT-4 — generated ABI, artifact and reference metadata

**Status:** COMPLETE — Level 1 qualified  
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

## Materialized artifact identity

The first successful materialization run was **420Identity ID-AUDIT-4 run `36814515776` / run number 9**.
It compiled parent SHA `2bdc29894d5454786c6147b7ef8e9068d5473576`, generated and independently
verified the Identity artifact/reference outputs in the workflow workspace, passed all metadata consumers,
and committed those exact generated outputs to branch commit
`74b829b912db1acf4de978990234ccda593798f5`.

Retained artifact identity at that generated commit:

- artifact: `contracts/artifacts/Identity420.json`;
- artifact Git blob SHA-1: `b484e52db2f2e7edcb7e3039296d3f7462dba61a`;
- source: `contracts/src/apps/Identity420.sol`;
- source Git blob SHA-1: `9d6bbfecf6cbb406312138acc735c5390513cd5a`;
- Solidity: `0.8.24`;
- EVM: `cancun`;
- optimizer: enabled, 200 runs;
- via-IR: enabled;
- Foundry config blob SHA-1: `f18c965f43b244582f2a4c527e7bad6d23aee929`;
- toolchain config blob SHA-1: `dd49cb0e07370b01401d63d2fb53683177de8abc`;
- canonical address: `0x0000000000000000000000000000000000000436`;
- creation-bytecode SHA-256: `47dd72e3c94bd0de3b41cd4e51d522a4f888369a47ff9012e8e1a8004bc687e2`;
- deployed-bytecode-template Keccak-256: `0x3183b8b7bbbde1c6698ffc3977d118a6847aced80038caf717d1d71e21f6f270`;
- deployed template bytes: `5681`;
- compiler-emitted immutable references: `4`;
- ABI SHA-256: `5ea63254c724148eba47ee720486f41105f003602558cbd0b0a43bdc346d3a6e`;
- final runtime code hash: intentionally **not claimed** until ID-AUDIT-5.

The Developer Hub catalogue now contains exactly one `Identity420` entry using version `3.0.0`,
the frozen `0x0436` address, the retained artifact path, the frozen
`IIdentityCredential420.sol` interface, and the exact ABI SHA-256 above.

Generated contract and event/error references contain Identity420, and the retained 420Indexer
mapping remains `Identity420 -> 420Identity`.

## First materialization Level 1 results

**420Identity ID-AUDIT-4 run `36814515776` — SUCCESS**

- exact-head parent checkout/assertion — success;
- pinned compiler settings — success;
- exact Identity420 compile — success;
- deterministic artifact/catalogue generation — success;
- deterministic generated-reference regeneration — success;
- independent artifact/reference verifier — success;
- Developer Hub catalogue consumers — success;
- 420 SDK catalogue/reference consumers — success;
- 420Indexer retained Identity artifact descriptor test — success;
- generated output branch commit — success.

Because the successful workflow itself created commit `74b829b…`, that generated commit contains
artifact/config/reference changes and therefore requires a final exact-head rerun. This evidence update
is intentionally used to trigger that rerun.

## Exact-head qualification evidence

**Qualified implementation SHA:** `4d490f676325ac257e8d0496dee3254997b3b4d6`  
**Current main at qualification:** `42c6a40cb476122f75250835c46d32e846a56881`  
**Audit merge base:** `df8f639d8f43b763298c8750ef49d3e5849c597c`  
**Branch divergence at qualification:** 37 commits ahead / 181 commits behind current `main`.

The large main-only delta accumulated while the long-running Identity audit branch was open. Step-relevant
reconciliation found no newer main Identity catalogue entry or conflicting Identity artifact authority:

- current-main `developer-hub/catalogue/local.example.json` still contains ProtocolRegistry only;
- the reference generators are byte-identical between current main and this branch;
- current-main Indexer differences add Names420 release-descriptor support and do not replace the retained
  `Identity420 -> 420Identity` mapping;
- current-main predeploy-plan differences are Names420 artifact/predeploy closeout data;
- full current-main integration/rebase is therefore intentionally deferred to ID-AUDIT-10 rather than
  importing 181 unrelated commits into this Level 1 artifact step.

### Exact-head Level 1 results

- **420Identity ID-AUDIT-4** run `36814815688` / run number 13 — **SUCCESS**
  - exact-head checkout/assertion — success;
  - pinned Solidity/Foundry settings — success;
  - exact `Identity420.sol` compile — success;
  - deterministic artifact/catalogue generation — success;
  - deterministic generated-reference regeneration — success;
  - artifact/reference independent verifier — success;
  - Registry catalogue namespace regression fixtures — success;
  - Developer Hub catalogue consumers — success;
  - shared 420 SDK catalogue/reference consumers — success;
  - retained Identity artifact -> 420Indexer descriptor test — success;
  - generated-output comparison/materialization step — success with retained outputs current;
  - generated evidence upload — success.
- **420Docs Qualification** run `36814815862` / run number 3732 — **SUCCESS**.
- **420 Developer Hub** run `36814815668` / run number 311 — **SUCCESS**.
- **420Indexer** package workflow run `36814815643` / run number 619 — **SUCCESS**.
- Broader **420Indexer** run `36814815700` / run number 1152 passed the directly relevant
  **Test TypeScript 420Indexer** stage on the exact head; the remaining Explorer/global inventory tail is
  outside ID-AUDIT-4 Level 1 scope.
- **Genesis Address Authority** run `36814815618` / run number 347 — **SUCCESS**.
- **420Registry REG-AUDIT-4** run `36814815770` / run number 182 — **SUCCESS** after the catalogue-order
  regression fixture was made order-independent.
- **420Registry REG-AUDIT-6** run `36814815647` / run number 10 — **SUCCESS**, providing retained generated
  metadata/reference compatibility evidence.
- **420 Wallet Web Verification** run `36814815771` / run number 1104 — **SUCCESS**.

The generic `Solidity Contracts` long-lived-PR classifier again selected its Compute fast path and skipped
the ordinary PR shards. It is not used as ID-AUDIT-4 evidence. ID-AUDIT-4 changed no production Solidity
source, and the focused exact-head workflow compiled the affected Identity contract from the pinned profile.
A complete repository Solidity inventory remains a Level 3 closeout concern.

### Exit-criterion reconciliation

| Requirement | Result |
| --- | --- |
| retained exact Identity420 artifact | PASS |
| pinned compiler/profile provenance | PASS |
| exact source identity | PASS |
| ABI retained with deterministic SHA-256 | PASS |
| deployed runtime-template identity retained | PASS |
| immutable references retained | PASS |
| false final-runtime-hash claim prevented before ID-AUDIT-5 | PASS |
| frozen address/interface catalogue parity | PASS |
| required Identity events present | PASS |
| generated contract/event references include Identity420 | PASS |
| Developer Hub/SDK consumers accept retained metadata | PASS |
| 420Indexer consumes retained Identity artifact | PASS |
| generated outputs reproduce deterministically | PASS |
| namespace/address authority remains valid | PASS |
| exact-head Level 1 CI | PASS |

No Level 2 milestone is required because this step introduces deterministic artifact/reference metadata only,
with no new runtime authority or shared service dependency.

Level 3 whole-app/main/Genesis reconciliation remains intentionally deferred to
**ID-AUDIT-10 — phase closeout, reconciliation and retained evidence**.

This closeout update is evidence-only. It changes no executable code, tests, workflows, dependencies,
configuration, generated artifacts, interfaces, deployment state or substantive requirements, so it may
reference the already-qualified implementation SHA without recursively rerunning Level 1.

## Completion state

**ID-AUDIT-4 — COMPLETE.**

Next canonical step:

**ID-AUDIT-5 — final Identity predeploy artifact and state**

Next canonical step after successful closeout:

**ID-AUDIT-5 — final Identity predeploy artifact and state**
