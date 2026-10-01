# GOV-AUDIT-1 — qualification evidence

## Step identity

- Step: **GOV-AUDIT-1 — canonical authority, dependency and cancellation decision**
- Qualification model: Level 1 required; Level 2 app-integration milestone required because this step reconciles a shared dependency-matrix interpretation and freezes the Governance authority model.
- Level 3: intentionally deferred to complete Governance app-phase closeout.

## Repository coordinates

- Repository: `abvhiael/420-integrated-v0.1`
- Base `main`: `e8d9096c4029c3c0218113afc1cbd3b8d0005878`
- Audit branch: `audit/420governance-complete-20261001`
- PR: #449
- GOV-AUDIT-1 implementation SHA: `dae5fb0d8429817ab9a89be5a41b92ad09e668f8`

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

## Implementation files

- `contracts/config/interfaces/dependency-matrix.json`
- `contracts/config/interfaces/governance-dependency-model.json`
- `scripts/verify-genesis-interface-layer.py`
- `scripts/verify-governance-audit-1.py`
- `contracts/src/governance/GovernanceTimelock.sol`
- `contracts/src/governance/CivicProposalRegistry420.sol`
- `contracts/test/GovernanceAudit420.t.sol`
- `contracts/test/CivicVoting420.t.sol`
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

## CI state at evidence creation

Required exact-head run:

- Workflow: **420Governance audit qualification**
- Run ID: `36888008789`
- Target SHA: `dae5fb0d8429817ab9a89be5a41b92ad09e668f8`
- State: **QUEUED**
- Conclusion: none

Additional exact-head repository checks observed:

- **Solidity Contracts** run `36888008905`: workflow completed successfully, but its Foundry job was skipped by scope classification; it is not counted as the required Governance contract qualification.
- **Genesis Address Authority** run `36888008873`: PASS. This is supporting address-map evidence only, not a substitute for the Governance workflow.
- unrelated/skipped workflows are not counted as green GOV-AUDIT-1 evidence.

## Level 1 status

**PENDING — REQUIRED STEP-SPECIFIC CI HAS NOT EXECUTED.**

No queued, skipped, cancelled or unrelated check is being represented as green.

## Level 2 milestone status

**PENDING.**

The GOV-AUDIT-1 ADR defines this authority/dependency freeze as an app integration milestone. The retained Governance contract/integration suite plus frozen-interface verifier in the dedicated Governance workflow constitute the required Level 2 scope. No repository-wide 420 Integrated/Geth/global qualification is required here.

## Level 3 status

**DEFERRED BY POLICY.**

Complete repository Solidity/Genesis inventories, 420 Integrated Qualification, Geth qualification, global fault/soak suites, repository-wide Docs qualification and final monolithic reconciliation remain deferred to the complete Governance app-phase closeout unless a later canonical step explicitly requires them earlier.

## Current completion state

**IMPLEMENTATION COMPLETE / QUALIFICATION PENDING — DO NOT ADVANCE TO GOV-AUDIT-2 YET.**

The step becomes COMPLETE only when the exact implementation SHA's required Governance qualification executes successfully and the Level 2 milestone evidence is recorded.
