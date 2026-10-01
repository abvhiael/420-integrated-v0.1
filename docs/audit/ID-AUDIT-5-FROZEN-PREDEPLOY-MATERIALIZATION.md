# ID-AUDIT-5 — Frozen Predeploy Materialization & Genesis State

**Status:** COMPLETE — Level 1 qualified  
**Repository:** `abvhiael/420-integrated-v0.1`  
**Working PR:** #438  
**Canonical roadmap:** `docs/audit/420IDENTITY-AUDIT-REMEDIATION-ROADMAP.md`

## Original step

ID-AUDIT-5 requires materialization of the frozen
`0x0000000000000000000000000000000000000436` Identity predeploy with:

- pinned runtime bytecode;
- immutable `governanceTimelock` materialization;
- explicit mutable storage state/root;
- runtime code hash;
- source/compiler provenance;
- collision verification against namespace authority.

**Exit criterion:** the predeploy plan moves from `SOURCE_READY` to retained
artifact-ready state without changing the frozen owner/address.

## Canonical inputs

ID-AUDIT-5 consumes, but does not redefine:

- `contracts/artifacts/Identity420.json` retained by qualified ID-AUDIT-4;
- frozen address `0x0000000000000000000000000000000000000436`;
- frozen GovernanceTimelock `0x0000000000000000000000000000000000000429`;
- compiler-emitted Identity immutable references;
- `contracts/config/predeploy/storage-init.json`;
- `contracts/config/genesis-address-namespace.json`;
- pinned Solidity `0.8.24`, Cancun, optimizer 200, via-IR profile.

The ID-AUDIT-4 build artifact remains the immutable compiler/build provenance
record. ID-AUDIT-5 materializes the final Genesis runtime into:

`contracts/config/predeploy/Identity420-predeploy-state.json`.

## Genesis constructor and storage model

`Identity420` inherits `SystemAccess`. Its only constructor effect is the
immutable GovernanceTimelock address. The canonical Identity constructor performs
no mutable storage writes.

Therefore Genesis materialization must:

1. patch every compiler-emitted GovernanceTimelock immutable reference in the
   deployed bytecode template with `0x...0429`;
2. use the resulting bytes as `genesis alloc.code`;
3. compute `runtimeCodeHash = keccak256(materialized runtime)`;
4. retain profiles, issuers, credentials and credential-candidate indexes as
   explicitly empty mutable state;
5. retain the Ethereum empty storage trie root
   `keccak256(0x80)`;
6. never infer storage slots or immutable offsets from Solidity source text.

The compiler storage layout is used only to prove the expected mutable state
families exist and that `governanceTimelock` is not mutable storage.

## Repository implementation

Added:

- `scripts/generate-id-audit-5-identity-predeploy.py`;
- `scripts/test-id-audit-5-identity-predeploy.py`;
- `scripts/verify-id-audit-5-identity-predeploy.py`;
- `.github/workflows/identity-id-audit-5.yml`;
- this evidence record.

Generated/updated by the materializer:

- `contracts/config/predeploy/Identity420-predeploy-state.json`;
- Identity420 entry in `contracts/config/predeploy/predeploy-plan.json`;
- Identity420 entry in `contracts/config/deployment-manifest.json`.

The ID-AUDIT-4 build artifact itself is not rewritten.

## Required manifest state

After successful materialization:

### Predeploy plan

Identity420 must remain:

- owner/name: `Identity420`;
- address: `0x0000000000000000000000000000000000000436`;
- source: `apps/Identity420.sol`;
- artifact: `contracts/artifacts/Identity420.json`.

It must advance to:

- status: `ARTIFACT_READY`;
- constructor strategy: `DIRECT_GENESIS_IMMUTABLE_MATERIALIZATION`;
- retained runtime code hash;
- retained predeploy-state path;
- retained source blob identity.

### Deployment manifest

The frozen Identity deployment entry must retain `0x0436` and add:

- runtime artifact path;
- runtime code hash;
- predeploy-state path;
- source blob SHA-1;
- `ID_AUDIT_5_ARTIFACT_READY` status.

## Security and adversarial invariants

Qualification must fail closed when:

- immutable references are missing;
- more than one immutable identifier is reported;
- immutable width is not 32 bytes;
- an immutable reference is out of bounds;
- materialized-reference count differs from ID-AUDIT-4;
- GovernanceTimelock appears as mutable storage;
- any canonical Identity state layout family disappears;
- predeploy/deployment manifest address drifts from `0x0436`;
- namespace authority does not uniquely assign `0x0436` to Identity420;
- storage-init no longer binds Identity420 constructor to GovernanceTimelock;
- runtime code hash does not equal Keccak-256 of retained materialized runtime;
- the explicit empty mutable state/root changes.

## Level 1 qualification

Required exact-head checks:

1. exact-head pinned Foundry compile of Identity420;
2. retained ID-AUDIT-4 build artifact reproduction/verification;
3. ID-AUDIT-5 deterministic materializer `--write` + `--check`;
4. independent ID-AUDIT-5 predeploy verifier;
5. focused adversarial materialization tests;
6. canonical Genesis address verifier;
7. active collision audit;
8. physical predeploy/deployment authority verifier;
9. `Identity420Audit.t.sol`;
10. `Identity420Compatibility.t.sol`;
11. `RegistryIdentityNames420.t.sol`;
12. directly triggered Genesis/config/docs consumers.

## Level 2 disposition

No Level 2 milestone is required solely by ID-AUDIT-5. It converts an already
qualified Identity build artifact into deterministic offline Genesis state and
does not introduce a new runtime authority or shared service.

The broader application integration milestone remains appropriate after the
derived-service compatibility work converges, not as ceremonial predeploy closeout.

## Level 3 disposition

Current-main reconciliation, complete Genesis inventories, global Solidity
qualification and complete cross-app release qualification remain intentionally
deferred to **ID-AUDIT-10 — phase closeout, reconciliation and retained evidence**.

Live code/storage verification at `0x0436` is explicitly **not** claimed by this
offline materialization step; that remains ID-AUDIT-9.

## Materialized Genesis identity

The first successful full materialization run was **420Identity ID-AUDIT-5 run `36817329087` / run number 3**.
It qualified parent SHA `daf44fd8d4ae38ce72e43d6c79a06510e3aa46c1`, generated the final offline
Identity predeploy state, passed all focused tests, and committed the generated Genesis outputs to
`dc04cc89487ad528fe91f79acdeb8efa856c31b2`.

Materialized values:

- frozen Identity address: `0x0000000000000000000000000000000000000436`;
- GovernanceTimelock immutable: `0x0000000000000000000000000000000000000429`;
- source Git blob SHA-1: `9d6bbfecf6cbb406312138acc735c5390513cd5a`;
- retained build ABI SHA-256: `5ea63254c724148eba47ee720486f41105f003602558cbd0b0a43bdc346d3a6e`;
- deployed-bytecode-template Keccak-256: `0x3183b8b7bbbde1c6698ffc3977d118a6847aced80038caf717d1d71e21f6f270`;
- compiler-emitted immutable references: **4**, at byte offsets 905, 1568, 1908 and 3966;
- materialized runtime bytes: **5681**;
- final runtime code hash: `0xda0fcd565d7aea6590b3e0ec468f7b99af50138b62527e770ca367a57e6cfd86`;
- mutable Genesis storage: **empty**;
- storage slot count: **0**;
- canonical empty storage trie root: `0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421`.

The generated predeploy plan now marks Identity420 `ARTIFACT_READY` with direct immutable
materialization, and the deployment manifest retains the same frozen `0x0436` address plus runtime
artifact/hash, state path and source provenance.

### First materialization qualification

Run `36817329087` completed **SUCCESS** after correcting an independent-verifier constant for the
Ethereum empty storage trie root. No materialization rule or contract behavior was weakened.

- exact-head checkout/assertion — success;
- pinned Foundry profile — success;
- exact Identity420 compile — success;
- retained ID-AUDIT-4 artifact verification — success;
- deterministic ID-AUDIT-5 generation and reproduction check — success;
- independent ID-AUDIT-5 verifier — success;
- adversarial materializer suite — **11 tests passed**;
- canonical address, active collision and predeploy authority verification — success;
- `Identity420Audit.t.sol` — **18 passed / 0 failed / 0 skipped**;
- `Identity420Compatibility.t.sol` — **6 passed / 0 failed / 0 skipped**;
- `RegistryIdentityNames420.t.sol` — **10 passed / 0 failed / 0 skipped**;
- generated Genesis output commit — success.

Because `dc04cc8…` changes configuration/deployment state, it cannot inherit qualification from its
parent. GitHub marked workflow runs directly emitted from the CI-authored commit as `action_required`,
so those are explicitly **not** treated as green evidence.

This evidence update creates a normal repository-authored head containing the generated state and is used
to trigger the required final exact-head qualification.

## Exact-head qualification evidence

**Qualified implementation SHA:** `22a5ed23265ca532f0a6acb656cba574b1ce4e69`  
**Current main at qualification:** `cbff831984df5d57540a26c879663cf95bcf61c9`  
**Audit merge base:** `df8f639d8f43b763298c8750ef49d3e5849c597c`  
**Branch divergence at qualification:** 47 commits ahead / 488 commits behind current `main`.

Current-main authority was checked before closeout:

- `genesis-address-namespace.json` is byte-identical and still uniquely fixes Identity420 at `0x0436`;
- `storage-init.json` is byte-identical and still binds Identity420 only to the frozen GovernanceTimelock constructor input;
- current-main Identity source is still the original audit baseline blob
  `bb982605d94090b6cbd473079c722a39e00ed19d`; no competing main-only Identity implementation has appeared;
- current main still has Identity420 `SOURCE_READY` and no retained `Identity420.json` artifact, so it contains no competing
  artifact/predeploy authority; this branch is the active remediation candidate;
- unrelated main-side Registry/Names/Compute/config evolution is intentionally reconciled once at ID-AUDIT-10 rather than
  importing hundreds of unrelated commits into this ordinary Level 1 step.

### Final exact-head Level 1 results

- **420Identity ID-AUDIT-5** run `36817976700` / run number 6 — **SUCCESS**
  - exact-head checkout/assertion — success;
  - pinned Foundry/Solidity profile verification — success;
  - exact `Identity420.sol` compile — success;
  - retained ID-AUDIT-4 artifact reproduction/verification — success;
  - deterministic ID-AUDIT-5 materialization — success;
  - independent ID-AUDIT-5 predeploy verifier — success;
  - adversarial materialization suite — **11 passed**;
  - canonical Genesis address verifier — success;
  - active namespace collision audit — success;
  - physical predeploy/deployment authority verification — success;
  - `Identity420Audit.t.sol` — **18 passed / 0 failed / 0 skipped**;
  - `Identity420Compatibility.t.sol` — **6 passed / 0 failed / 0 skipped**;
  - `RegistryIdentityNames420.t.sol` — **10 passed / 0 failed / 0 skipped**;
  - generated-output comparison — **already current**, no further config/deployment mutation;
  - evidence upload — success.
- **420Identity ID-AUDIT-4** run `36817976657` / run number 23 — **SUCCESS** after making the prior artifact verifier
  accept the canonical later `ARTIFACT_READY` state while still requiring the retained artifact/state/hash boundary.
- **Genesis Address Authority** run `36817976658` / run number 362 — **SUCCESS**.
- **420Docs Qualification** run `36817976636` / run number 3749 — **SUCCESS**.
- **420 Developer Hub** run `36817976601` / run number 321 — **SUCCESS**.
- **420Indexer** package workflow run `36817976711` / run number 631 — **SUCCESS**.
- broader **420Indexer** run `36817976627` / run number 1169 — **SUCCESS**.
- **420 Wallet Web Verification** run `36817976653` / run number 1114 — **SUCCESS**.
- directly triggered Registry address/metadata compatibility workflows also completed successfully.

The generic `Solidity Contracts` workflow is not required as ID-AUDIT-5 evidence. This ordinary step's focused
workflow performs the affected exact Identity compile and all retained Identity/Names Solidity regressions; complete
repository Solidity inventory remains intentionally deferred to Level 3.

### Exit-criterion reconciliation

| Original requirement | Result |
| --- | --- |
| frozen Identity owner/address remains `0x0436` | PASS |
| pinned materialized runtime retained | PASS |
| GovernanceTimelock immutable patched to `0x0429` | PASS — 4 compiler references |
| explicit mutable Genesis state retained | PASS — empty |
| explicit storage root retained | PASS — canonical empty trie root |
| runtime code hash retained and reproducible | PASS — `0xda0fcd565d7aea6590b3e0ec468f7b99af50138b62527e770ca367a57e6cfd86` |
| source/compiler provenance retained | PASS |
| collision/namespace authority verified | PASS |
| predeploy plan promoted from `SOURCE_READY` to `ARTIFACT_READY` | PASS |
| deployment manifest wired to runtime/state/provenance | PASS |
| adversarial materialization checks | PASS — 11/11 |
| retained Identity/Names regressions | PASS — 34/34 |
| exact-head Level 1 CI | PASS |

No Level 2 milestone is required for this step. The predeploy work introduces no new runtime authority or shared
service; broader derived-service integration qualification begins in ID-AUDIT-6.

Level 3 whole-app/current-main/Genesis reconciliation remains intentionally deferred to
**ID-AUDIT-10 — phase closeout, reconciliation and retained evidence**.

Live testnet code/storage/immutable verification remains intentionally deferred to ID-AUDIT-9 and is not claimed here.

This closeout update is evidence-only. It changes no executable code, tests, workflows, dependencies, configuration,
generated artifacts, interfaces or deployment state, so it references the already-qualified implementation SHA without
recursively rerunning Level 1.

## Completion state

**ID-AUDIT-5 — COMPLETE.**

Next canonical step after successful closeout:

**ID-AUDIT-6 — Indexer/Search/Explorer compatibility**
