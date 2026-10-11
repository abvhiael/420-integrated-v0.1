# R03 phase closeout evidence — pending exact-SHA acceptance

Status: **NOT QUALIFIED / NOT MERGED**. This record prevents historical green checks from being confused with final Level 3 certification.

## Scope and dependency
- Repository: abvhiael/420-integrated-v0.1.
- R02 PR #593 (review/high-country-complete-audit-20261009) remains OPEN; R03 PR #607 targets this branch.
- Most recent independently inspected main: e7614af49336f70e6ff0eda55aba41fdd3fc6ab3. R02-to-main comparison: 284 ahead / 71 behind, including changes to 205 files. R02 PR #593 is draft and GitHub reports mergeable=false. PR #607 depends on R02 and must not be force-merged. Recheck immediately before reconciliation.
- Canonical R03 requirements: R03.1 single-use harvest admission; R03.2 deterministic scoring; R03.3 provenance and historical issuance ledger; R03.4 exactly-once capacity release; R03.5 adversarial conservation and event reconciliation.
- General InventoryRegistry/ResourceLedger remains R04.1 scope. Do not represent the R03.3 historical issuance counters as spendable inventory or material consumption.

## Newly added public capacity regression
- `contracts/test/highcountry/unit/cultivation/CultivationEngine.t.sol` tests public plot registration and allocation, source approval bound to the same plot, public occupancy, occupied-allocation release rejection, READY→TERMINATED capacity release, private accounting isolation, duplicate termination rejection, and subsequent allocation release/reuse.
- The direct R03.5 tests also cover delayed settlement of already-accepted harvest receipts following termination, preserving canonical owner, quantity, replay protection, and issuance/capacity separation.
- Latest verified qualifying implementation: 9970d03e6af30b60c54af909e48f10b38b36213f. **Executed GitHub Actions all PASS at this SHA**: R03.1 run 38104976896; R03.2 run 38104976884; R03.3 run 38104976855; R03.4 run 38104976924; R03.5 run 38104976942; R02 Level 2 integration run 38104976936; Solidity Contracts run 38104976972. These results are app/contract evidence on the pre-reconciliation implementation only, not final Level 3 acceptance.

## Qualification ownership, required before declaring completion
1. All affected R03.1–R03.5 workflows pass on the final implementation SHA, with genuine public-plot and adversarial tests executed.
2. Confirm event/receipt reconciliation, authority revocation, wrong sealed ruleset/phenotype, zero-yield and arithmetic invariants explicitly; do not infer untested coverage from one green workflow.
3. Resolve and merge R02 PR #593 through normal approvals, reconcile R03 with newly current main preserving all commits; review frozen Genesis authority.
4. At one final merge-candidate SHA: complete canonical Solidity Foundry inventory once (approximately four balanced shards); independent Genesis Address Authority without duplicated Foundry; required integrated/global, Docs, retained High Country, ABI, deployment/configuration, security and client/service acceptance.
5. Record exact run IDs/job results, final main/base/implementation SHA, implementation file changes, evidence-only commit SHA, residual testnet/external blockers, and final disposition.

Level 3 status: **NOT RUN on reconciled final candidate**. **Hard dependency blocker:** #593 draft/non-mergeable, R02 diverged from current main; merging or constructing a synthetic merge commit from one side's tree could silently discard main changes and is prohibited. **Missing exact-SHA evidence:** Genesis Address Authority, 420 Integrated/global, Docs reconciliation, independent security/deployment and affected services against a reconciled candidate. Any earlier Solidity success on older SHA is historical only. No production signoff is claimed.
