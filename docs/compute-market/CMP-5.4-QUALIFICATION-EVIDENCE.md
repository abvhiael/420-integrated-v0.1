# CMP-5.4 — Qualification Evidence

Status: **COMPLETE — Level 1 exact-head qualified.**

## Qualification identity

- Roadmap step: **CMP-5.4 — University/HPC gateway**
- Qualification level: **Level 1**
- Exact implementation SHA: `e7cc08829b470c6048e2a06cef3f22411630d809`
- Reconciliation base/main SHA: `7700caec39c6ef4212a433b493faa9876f3d7ece`
- Reconciliation merge candidate before harness repair: `34c0a1215caefeaeea470755a8455707f68432ee`
- Branch: `cmp-5.1-folding-at-home-adapter-20261006`
- PR: **#539**
- Branch disposition at qualification: **0 commits behind main**
- Previous Level 2 milestone: **CMP-5.2 — BOINC adapter**
- Level 3: **deferred to CMP-5.8 — Phase closeout**

## Implementation qualified

The qualified accumulated graph includes:

- `contracts/src/compute/ComputeUniversityHpcGateway420.sol`
- `contracts/test/ComputeUniversityHpcGateway420.t.sol`
- retained four-family regression in `contracts/test/ComputeExternalContributionAdapters420.t.sol`
- `contracts/config/compute-market/cmp-5.4-university-hpc-gateway.json`
- `docs/compute-market/CMP-5.4-UNIVERSITY-HPC-GATEWAY.md`
- `scripts/verify-cmp-5-4-university-hpc-gateway.py`
- Compute Market workflow ownership and roadmap reconciliation.

The final exact SHA also includes the narrow test-harness repair that instantiates the HPC gateway in the cross-adapter non-authority test.

## Exit criteria disposition

1. Stable versioned gateway/adapter/system/protocol identities — **PASS**.
2. Contribution identity binds institution, gateway, scheduler, account, project, workload and allocation — **PASS**.
3. Full record binds optional queue/partition, result, lifecycle, usage, accounting and evidence — **PASS**.
4. Missing required bindings and impossible lifecycle ordering fail closed — **PASS**.
5. Optional queue/partition commitment preserves all remaining mandatory bindings — **PASS**.
6. Gateway implements the existing provider-neutral external-adapter identity interface — **PASS**.
7. Folding-at-home, BOINC, research-cluster and university/HPC domains remain mutually distinct — **PASS**.
8. No credential-verification, result-verification, reward, settlement, stake/slash or duplicate-prevention authority is introduced — **PASS**.
9. CMP-5.6 and CMP-5.7 remain the canonical future owners of duplicate prevention and external truth — **PASS**.
10. Dedicated tests, four-family regression, verifier and exact-head Compute Market Level 1 workflow pass — **PASS**.

## Failure diagnosis and repair

The first reconciled candidate `34c0a1215caefeaeea470755a8455707f68432ee` failed only in the retained Compute Solidity suite because `ComputeExternalContributionAdapters420.t.sol` referenced `hpc` in the second regression test without constructing it in that function.

This was classified as a **test-harness defect**. The protocol contract build had already passed. The narrow repair commit:

- `e7cc08829b470c6048e2a06cef3f22411630d809`
- message: `test(compute): fix CMP-5.4 cross-adapter gateway scope`

adds the missing gateway construction without changing protocol semantics.

The repaired exact SHA was then requalified from scratch at the required Level 1 scope.

## Exact-head CI evidence

### Compute Market Qualification #452

- Run: `37527877955`
- Job: `112489398358`
- Exact-head checkout/verification — **PASS**
- Build Compute Market contracts — **PASS**
- Retained `Compute*.t.sol` Solidity suite — **PASS**
- Verification-script compilation — **PASS**
- Retained verifier chain — **PASS**
- CMP-5.1 Folding@home verifier — **PASS**
- CMP-5.2 BOINC verifier — **PASS**
- CMP-5.3 Research-cluster verifier — **PASS**
- CMP-5.4 University/HPC gateway verifier — **PASS**
- Final result — **SUCCESS**

### Solidity Contracts #5217

- Run: `37527878038`
- Classification — **PASS**
- Compute-fast job: `112489465749` — **SUCCESS**
- Exact-head verification — **PASS**
- Compute Market build — **PASS**
- Retained Compute Solidity suite — **PASS**
- Full repository Foundry job — **SKIPPED as expected**
- Full repository PR shards — **SKIPPED as expected**

The skipped repository-wide jobs are correct for this ordinary Level 1 step and are not substituted for required passing evidence.

## Supporting exact-head workflows

- Genesis Address Authority #2187 / run `37527878024` — **SUCCESS**
- 420Docs Qualification #6364 / run `37527877979` — **SUCCESS**
- Compute Worker Fast Qualification #462 / run `37527877994` — **SUCCESS**
- 420Indexer #2470 / run `37527878037` — **SUCCESS**
- 420Oracle audit qualification #1698 / run `37527877942` — **SUCCESS**
- 420Registry REG-AUDIT-4 #1996 / run `37527877967` — **SUCCESS**

These are supporting observed exact-head results; they do not elevate CMP-5.4 into a Level 2 or Level 3 closeout.

## Security / adversarial disposition

Coverage includes:

- institution/gateway/scheduler/account/project/workload/allocation substitution;
- partition/result/start/completion/resource/accounting/evidence substitution;
- required-zero field rejection;
- invalid lifecycle ordering;
- optional partition behavior;
- four-family adapter/system/protocol collision resistance;
- cross-adapter identity separation;
- explicit absence of credential, external-truth, verification, settlement, reward, stake/slash and duplicate-prevention authority.

## Milestone status

CMP-5.4 is an ordinary **Level 1** extension. CMP-5.2 remains the first and most recent CMP-5 Level 2 integration milestone. No new Level 2 milestone is required by CMP-5.4.

## Intentionally deferred

- CMP-5.5 — External proof/credit adapters
- CMP-5.6 — Double-reward prevention
- CMP-5.7 — External-result attestation
- CMP-5.8 — Level 3 phase closeout
- CMP-6 useful-computation rewards
- live Slurm/PBS/LSF/vendor scheduler integration
- institution-specific credential federation, accounting APIs and administrative approval

## Limitations / blockers

No repository blocker remains for CMP-5.4.

Live institution-specific scheduler/API integration and administrative authorization are outside CMP-5.4 repository qualification and remain intentionally deferred.

## Completion

**CMP-5.4 is repository COMPLETE at Level 1 on exact implementation SHA `e7cc08829b470c6048e2a06cef3f22411630d809`.**

This evidence-only follow-up changes no executable source, tests, workflows, configuration, interface or deployment state and therefore inherits the exact-head qualification without recursive rerun.

## Next canonical step

**CMP-5.5 — External proof/credit adapters**
