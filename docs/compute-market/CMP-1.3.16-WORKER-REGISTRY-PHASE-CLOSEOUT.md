# CMP-1.3.16 — WorkerRegistry phase closeout, reconciliation, and retained evidence

Status: **COMPLETE WITHIN REPOSITORY QUALIFICATION SCOPE. LIVE DEPLOYMENT/PUBLICATION REMAINS BLOCKED.**

## Canonical definition

The controlling roadmap defines CMP-1.3.16 as the final CMP-1.3 reconciliation after CMP-1.3.8–CMP-1.3.15 are qualified.

Required:

- inventory all WorkerRegistry source/tests/docs/configuration;
- reconcile historical evidence caveats;
- verify invariant coverage and authority boundaries;
- record exact final SHA and workflow run IDs;
- distinguish repository qualification from live deployment claims;
- migrate/reconcile the useful material in `CMP-1.3-DEFERRED-CLOSEOUT-DRAFT.md` and `cmp-1.3-deferred-closeout-ledger.json` rather than discarding it.

The roadmap permits an evidence-only closeout commit to inherit an already-qualified implementation SHA. Evidence-only recording does not require a recursive full-suite rerun unless the evidence commit changes qualification-relevant contracts, tests, configuration, workflows, dependencies, or substantive requirements.

Exit: CMP-1.3 may be marked COMPLETE only after the exact qualification-relevant implementation head passes the retained qualification suite and the durable closeout record identifies that SHA and its run evidence.

## Repository baseline

CMP-1.3.16 originally began from `main`:

`5a2a273d8d6e0d9ab3428aab80ba0212f7bbb1bc`

That commit is the merge of PR #408 for CMP-1.3.15.

Before final qualification, `main` advanced through Registry/genesis/address-authority work. PR #411 was therefore reconciled cleanly onto current `main`:

`04f6200c2ae78db7d15db86b482fa6fa732017a6`

The reconciliation produced head `bb510047459b0578cfbc6b1d4f5db1a5f0960eeb`. The PR remained a seven-file CMP-1.3.16 closeout change set, became ahead of `main` by one commit and behind by zero, and required no conflict resolution that changed WorkerRegistry scope. The intervening `main` changes affected Registry/genesis/address/deployment authority surfaces but did not modify the CMP-1.3.16 closeout files or introduce a new WorkerRegistry runtime requirement. A fresh exact-head qualification cycle is therefore required on the reconciled branch before evidence recording.

Repository evidence inspected before modification included:

- the canonical CMP-1 roadmap;
- CMP-1.3.0 through CMP-1.3.15 qualification/design records;
- the 2026-09-28 CMP-1.3.8–1.3.16 gap audit;
- the historical roadmap-recovery mapping;
- the deferred closeout draft and ledger;
- the full CMP-INV-001–CMP-INV-030 evidence matrix and verifier;
- the historical CMP-1.3.7 deployment evidence;
- the CMP-1.3.15 release-candidate manifest/verifier;
- current WorkerRegistry contracts, tests, SDK/indexer surfaces and CI workflows;
- PR #408 and its exact-head workflow evidence.

No production WorkerRegistry contract change is required for CMP-1.3.16.

## Gap analysis

### Satisfied before this step

- CMP-1.3.8–CMP-1.3.15 implementation work is present.
- CMP-1.3.14 already provides an explicit 30-invariant evidence matrix.
- CMP-1.3.15 provides the final release-candidate graph, repository-readiness manifest and fail-closed live blockers.
- The exact CMP-1.3.15 evidence head `8653e105661c15ef66ad2236c467d0e63994cd1c` passed its full required PR workflow set before merge.
- The hardened graph already contains happy-path, negative, adversarial, replay, stale-revision, authorization, capacity, historical-reconstruction, non-AI, and failure-atomicity coverage.

### Blocking closeout gaps found

1. The deferred closeout ledger still claimed the authoritative later roadmap was unrecovered and deliberately left the closeout unnumbered. That is stale after the 2026-09-28 audit created the current authoritative CMP-1.3.8–CMP-1.3.16 roadmap.
2. The deferred draft had not yet been formally migrated into CMP-1.3.16.
3. CMP-1.3.15's durable qualification document still said its evidence-head requalification was pending even though the exact evidence head had passed and PR #408 was merged.
4. There was no single CMP-1.3.16 durable inventory tying source, tests, clients, docs and configuration together.
5. There was no CMP-1.3.16 mechanical closeout check preserving the invariant matrix, authority boundaries, prerequisite steps, repository/live distinction and deferred-material migration.
6. CMP-1.3.16 exact-head workflow evidence had not yet been produced.

No missing runtime feature, new economic authority, new custody path, new signer authority, or new deployment address was identified.

## Inventory

The machine-readable controlling inventory is:

`contracts/config/compute-market/cmp-1.3-deferred-closeout-ledger.json`

The deferred ledger has been promoted in place to schema:

`420Integrated.ComputeMarket.CMP-1.3.16.CloseoutLedger.v1`

This preserves provenance while avoiding a second conflicting closeout ledger.

### WorkerRegistry phase source inventory

The ledger inventories the complete phase-owned/phase-critical WorkerRegistry graph, including authorization, worker lifecycle, attestation, capability detail/eligibility, Trust, stake-reference binding, capacity, accepted-job snapshots, historical wiring, canonical read model and final release-candidate wiring.

### Retained test inventory

The ledger inventories the retained suites for:

- worker identity/lifecycle;
- delegated capability authorization;
- attestation/provenance;
- capability detail and eligibility;
- Trust references;
- compute-stake binding;
- accepted worker snapshots/execution-key signing/attempt lifecycle;
- capacity accounting;
- canonical wiring/read model;
- release-candidate wiring.

The CMP-1.3.14 invariant matrix additionally binds the WorkerRegistry graph to retained identity, matching, verification, custody/settlement and SDK/client tests where an invariant is enforced outside WorkerRegistry authority.

### Client/configuration inventory

The ledger retains the SDK Compute surface, SDK tests, indexer read-model descriptor, historical CMP-1.3.7 deployment evidence, final CMP-1.3.15 release-candidate package, and the promoted closeout ledger itself.

## Historical evidence reconciliation

### Deferred closeout material

`CMP-1.3-DEFERRED-CLOSEOUT-DRAFT.md` is retained as a historical migration record rather than deleted. Its useful material is now represented by this closeout document, the promoted closeout ledger, and `verify-cmp-1-3-16-closeout.py`.

### CMP-1.3.7

The CMP-1.3.7 deployment package remains historical evidence for the graph as it existed at that step. It is not rewritten as the final release candidate and is not used to fabricate post-1.3.7 deployment hashes.

### CMP-1.3.14

The consolidated invariant campaign remains controlling evidence for `CMP-INV-001` through `CMP-INV-030`. CMP-1.3.16 verifies that all 30 IDs and their evidence remain present.

### CMP-1.3.15

The final CMP-1.3.15 evidence-recording head:

`8653e105661c15ef66ad2236c467d0e63994cd1c`

passed:

- Solidity Contracts #3360 / run `36662815029` — 16/16 required PR shards;
- Genesis Address Authority #197 / run `36662815001` — cross-manifest authority plus 16/16 inventory shards;
- 420 Integrated Qualification #5997 / run `36662815016` — all four jobs;
- 420Docs Qualification #3373 / run `36662815011`;
- 420Indexer #980 / run `36662815010`;
- EXP-1.9 CI Qualification Automation #87 / run `36662815024`;
- EXP-1.10 Phase Closeout Qualification #93 / run `36662815032`.

It was merged through PR #408 into `main` at `5a2a273d8d6e0d9ab3428aab80ba0212f7bbb1bc`.

## Invariant and authority-boundary reconciliation

CMP-1.3.14's matrix contains exactly `CMP-INV-001` through `CMP-INV-030`, each classified as direct, retained/transitive, or non-applicable to WorkerRegistry authority with repository evidence.

CMP-1.3.16 preserves these authority boundaries:

- worker lifecycle authority does not imply Vault/custody, settlement, verifier, bridge, validator, governance or arbitrary-wallet authority;
- operator/lifecycle authority remains separate from execution-key authority;
- attestation and 420Trust remain evidence, not job-result correctness or settlement authority;
- ComputeWorkerStake420 remains a binding/read layer and owns no collateral custody or slash authority;
- capacity reservation owns concurrency accounting only;
- ProtocolRegistry publication owns discovery/version authority only;
- accepted historical work remains reconstructable and is not rewritten by later live-policy or identity changes;
- non-AI workloads remain explicitly supported.

No closeout change expands any production authority.

## Repository qualification versus live deployment

CMP-1.3 repository qualification and live deployment are deliberately separate.

Repository closeout may become COMPLETE when the exact closeout head passes the retained qualification suite.

Live deployment/publication remains **not qualified** until real evidence exists for:

- a qualified live CMP-1.5 compute-collateral source where stake-required production admission needs it;
- canonical public testnet availability;
- real deployed addresses;
- deployment transactions and blocks;
- runtime code hashes and release graph hash;
- canonical graph bindings;
- governance-authorized ProtocolRegistry publication.

No address, transaction, block, runtime hash, graph hash or publication evidence is fabricated by CMP-1.3.16.

## Implementation

CMP-1.3.16 changes are reconciliation/evidence infrastructure only:

- promote the deferred closeout ledger into the authorized CMP-1.3.16 inventory/blocker ledger;
- mark the deferred draft as migrated while retaining its provenance;
- add `scripts/verify-cmp-1-3-16-closeout.py`;
- wire the closeout verifier into Docs qualification;
- correct the stale CMP-1.3.15 durable completion status;
- add this durable closeout record.

No production Solidity contract, SDK behavior, indexer behavior, economic rule, authorization rule or deployment descriptor is changed.

## Qualification gate

Before CMP-1.3.16 may be marked COMPLETE:

1. reconcile the branch against current `main`;
2. qualify the exact reconciled qualification-relevant HEAD;
3. require the retained suite relevant to this phase, including Solidity Contracts all required PR shards, 420 Integrated Qualification, 420Docs Qualification including CMP-1.3.14/CMP-1.3.15/CMP-1.3.16 verifiers, Genesis Address Authority when triggered, 420Indexer when triggered, and retained EXP qualification workflows when triggered;
4. treat no missing, failed, cancelled or required-untriggered gate as passing;
5. record the exact qualified SHA and workflow run IDs here;
6. an evidence-only closeout commit may inherit the qualified implementation SHA without another full-suite rerun, provided it changes no qualification-relevant contracts, tests, configuration, workflows, dependencies, or substantive requirements.

## Final qualification evidence

Qualified implementation/reconciliation SHA:

`82f123e4093095babf9c2f93d870269ece43c804`

Successful retained qualification runs:

- Solidity Contracts #3383 / run `36750528808`;
- Genesis Address Authority #218 / run `36750528895`;
- 420 Integrated Qualification #6030 / run `36750528745`;
- 420Docs Qualification #3406 / run `36750528945`;
- 420Indexer #1012 / run `36750528883`;
- 420Registry REG-AUDIT-4 #47 / run `36750528826`;
- EXP-1.9 CI Qualification Automation #93 / run `36750528687`;
- EXP-1.10 Phase Closeout Qualification #100 / run `36750528767`.

This evidence-only closeout update records the already-qualified SHA and run evidence and does not alter qualification-relevant implementation, tests, workflow logic, dependencies, or substantive CMP-1.3 requirements.


**COMPLETE WITHIN REPOSITORY QUALIFICATION SCOPE.** The exact reconciled implementation/reconciliation head passed the complete retained qualification set, and this durable closeout record identifies that SHA and its run evidence. Live deployment/publication remains blocked by the separately recorded CMP-1.5, public-testnet, runtime-evidence and ProtocolRegistry-publication prerequisites.
