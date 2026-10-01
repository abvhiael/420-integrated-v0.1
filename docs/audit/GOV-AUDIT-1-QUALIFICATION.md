# GOV-AUDIT-1 — qualification evidence

## Step identity

- Step: **GOV-AUDIT-1 — canonical authority, dependency and cancellation decision**
- Qualification model: Level 1 required; Level 2 app-integration milestone required because this step reconciles a shared dependency-matrix interpretation and freezes the Governance authority model.
- Level 3: intentionally deferred to complete Governance app-phase closeout.

## Repository coordinates

- Repository: `abvhiael/420-integrated-v0.1`
- Base `main`: `06e137050964bb4f787164c9900f1740f2cf4b97`
- Audit branch: `audit/420governance-complete-20261001`
- PR: #449
- GOV-AUDIT-1 implementation SHA: `fde6b37d02db1a180a8635aeb037efd7db0d2cc6`

This file is evidence-only. It does not change executable code, tests, workflows, dependencies, configuration, interfaces, artifacts or substantive requirements. The implementation SHA above remains the qualification target.

## Canonical decisions implemented

1. 420 Governance remains the public Genesis application; 420 Civic remains the canonical implementation family.
2. GovernanceTimelock remains the sole delayed execution/SystemAccess governance identity.
3. Governance420 at 0x0437 remains compatibility-only; its legacy proposal/vote/result selectors remain retired.
4. The `420Governance` shared-interface runtime dependency row is reconciled to the actual Civic graph and is empty.
5. All 25 frozen shared Genesis interfaces have an explicit app-specific classification in `governance-dependency-model.json`.
6. Registry is an optional deployment/discovery integration, not Civic proposal/vote/execution authority.
7. Genesis initialization/migration are indirect deployment/release concerns.
8. Replay and metadata commitment semantics are local mechanisms.
9. Civic v1 proposals are not cancellable in ACTIVE, PASSED or QUEUED states.
10. Timelock cancellation is legacy/bootstrap-only before Civic authority activation and fails closed afterward.
11. Proposal Registry rejects `CANCELLED` as a canonical v1 transition.
12. 420Indexer no longer synthesizes Governance cancellation from non-canonical cancellation event names.
13. Current `main` was merged cleanly into the audit branch before final GOV-AUDIT-1 qualification; the intervening mainline changes were Compute Market-only and did not alter Governance semantics.
14. A queued Civic action batch that attempts to invoke the retired Timelock cancellation primitive is proven to fail atomically without splitting Proposal Registry or Timelock state.
15. A separately approved queued Civic action batch that attempts `CivicProposalRegistry420.transition(target, CANCELLED)` is proven to fail atomically, preserving both the target proposal and the cancellation-attempt proposal states.
16. The GOV-AUDIT-1 verifier now fails if the 420Indexer Governance lifecycle policy contains `ProposalCancelled` or `CivicProposalCancelled`.

## Implementation files

- `contracts/config/interfaces/dependency-matrix.json`
- `contracts/config/interfaces/governance-dependency-model.json`
- `scripts/verify-genesis-interface-layer.py`
- `scripts/verify-governance-audit-1.py`
- `contracts/src/governance/GovernanceTimelock.sol`
- `contracts/src/governance/CivicProposalRegistry420.sol`
- `contracts/test/GovernanceAudit420.t.sol`
- `contracts/test/CivicVoting420.t.sol`
- `contracts/test/CivicTimelockExecution420.t.sol`
- `420-indexer/src/lifecycle-reducer.ts`
- `420-indexer/test/lifecycle-reducer.test.ts`
- `docs/architecture/decisions/GOV-AUDIT-1-AUTHORITY-DEPENDENCY-CANCELLATION.md`
- `docs/apps/governance/architecture.md`
- `docs/apps/governance/security.md`
- `docs/apps/governance/faq.md`
- `docs/apps/governance/concepts.md`
- `docs/apps/governance/developer/errors.md`
- `.github/workflows/governance-audit.yml`

The previously staged Civic module-graph hardening and Governance Indexer ABI mapping remain preserved on the audit branch and are exercised by the retained Governance suite.

## Required qualification commands

The dedicated Governance workflow on the exact implementation SHA runs:

- `python scripts/verify-governance-audit-1.py`
- `python scripts/verify-genesis-interface-layer.py`
- Governance Solidity formatting
- focused Governance Solidity build
- all `test/Civic*.t.sol`
- all `test/Governance*.t.sol`
- forbidden authority/opcode scan
- 420Indexer build
- `abi-manifest.test`
- `lifecycle-reducer.test`

## CI state at evidence update

Required exact-head runs:

- Workflow: **420Governance audit qualification**
- Push run: **#46**, run ID `36891755734`
- Pull-request run: **#47**, run ID `36891765490`
- Target SHA: `fde6b37d02db1a180a8635aeb037efd7db0d2cc6`
- Current state at this evidence update: **QUEUED**
- Conclusion: none

The earlier implementation run `36888008789` at `dae5fb0d...` failed only because three Governance documentation pages did not use the verifier's explicit no-cancellation wording. Those pages were corrected. Subsequent intermediate exact-head runs were cancelled by later corrective commits under the workflow's concurrency policy; cancelled runs are not counted as green. The final repository-side gap review then added end-to-end queued-batch rejection for both cancellation primitives and extended the verifier to reject non-canonical Governance cancellation projections.

The current exact-head implementation has also been reconciled with current `main` at `06e13705...` and includes the additional end-to-end cancellation-atomicity regression. No queued, skipped, cancelled, superseded or unrelated check is represented as green.

## Level 1 status

**IMPLEMENTATION COMPLETE / CI EXECUTION PENDING.**

Every GOV-AUDIT-1 repository requirement and identified test gap has been implemented. The remaining gate is execution of the required exact-head Governance workflow. Runner queue state is an external CI-capacity condition, not a repository implementation gap, but the step must not be reported COMPLETE until the required run succeeds.

## Level 2 milestone status

**IMPLEMENTATION COMPLETE / CI EXECUTION PENDING.**

GOV-AUDIT-1 is the authority/dependency integration milestone. Its retained Governance contract/integration suite, frozen-interface verifier, Indexer mapping/lifecycle tests and cancellation atomicity regression are all wired into the dedicated Governance workflow. Level 2 becomes qualified when that exact-head run succeeds.

## Level 3 status

**DEFERRED BY POLICY.**

Complete repository Solidity/Genesis inventories, 420 Integrated Qualification, Geth qualification, global fault/soak suites, repository-wide Docs qualification and final monolithic reconciliation remain deferred to the complete Governance app-phase closeout unless a later canonical step explicitly requires them earlier.

## Current completion state

**IMPLEMENTATION COMPLETE / EXTERNAL CI QUEUE PENDING — DO NOT ADVANCE TO GOV-AUDIT-2 YET.**

No remaining repository implementation gap is known for GOV-AUDIT-1. The step becomes COMPLETE only when the exact implementation SHA's required Governance qualification executes successfully.
