# GRANTS-AUDIT-2 qualification evidence

## Step

**GRANTS-AUDIT-2 — contract consistency and lifecycle remediation**

## Qualification level

**Level 1 — per-roadmap-step fast qualification**

This step is app-scoped contract/lifecycle remediation. The exact implementation SHA was already exercised by the dedicated Grants contract-core and security qualification before later evidence-only bookkeeping commits. No executable source, tests, workflows, dependencies, configuration, interfaces, artifacts or deployment state changed between that implementation SHA and the pre-closeout bookkeeping head.

## Implementation SHA

`02244b26b699557c8c42600c635b38b276249183`

## Pre-closeout bookkeeping HEAD

`c447a49d8ab64a721e35d3646827d7248d40d54b`

## Reconciliation base

`main` at `14d46231aa4350b2e84dee52f0f664bdd2e785f4`

Audit branch: `feature/420grants-audit-remediation-v2`  
PR: #484 — `audit(grants): harden lifecycle and establish 420Grants audit track`

At qualification review time PR #484 was open and mergeable. The branch was not behind `main`.

## Canonical GRANTS-AUDIT-2 requirements

### 1. Eliminate divergent program-award accounting

**SATISFIED**

`GrantProgramRegistry420.Program.awarded` is the single aggregate program-award accounting authority. `GrantAwardRegistry420.createAward()` reserves capacity through `programs.reserveAward(...)`; the Award Registry compatibility getter reads the Program Registry's canonical value rather than maintaining a second independent total.

### 2. Bind exactly one Award Registry as the reservation controller

**SATISFIED**

`GrantProgramRegistry420.bindAwardRegistry(address)` is Governance-only, rejects zero address, and rejects rebinding after the controller is set. `reserveAward()` accepts calls only from that bound registry and fails closed while no registry is bound.

### 3. Reject new awards for inactive programs

**SATISFIED**

`GrantAwardRegistry420.createAward()` loads the canonical program and rejects creation when `p.active` is false. Program reservation also independently rejects inactive programs.

### 4. Require ACTIVE parent award at milestone approval

**SATISFIED**

`GrantMilestoneRegistry420.approve()` reloads the parent award and requires `GrantAwardRegistry420.State.ACTIVE` before a Treasury disbursement may be bound.

### 5. Prevent one Treasury disbursement from funding multiple milestones

**SATISFIED**

`treasuryDisbursementMilestone` records the one-to-one binding. Approval rejects any nonzero existing binding using `TreasuryDisbursementAlreadyBound`.

### 6. Release an approved milestone/disbursement binding only through explicit safe cancellation

**SATISFIED**

An APPROVED milestone may not simply detach from a still-executable Treasury payment. Grants cancellation requires the canonical Treasury disbursement to already be `CANCELLED`; only then is `treasuryDisbursementMilestone` deleted and the local milestone binding cleared.

### 7. Prevent cancellation from hiding an executed Treasury payment

**SATISFIED**

If the Treasury disbursement is `EXECUTED`, Grants cancellation fails. The canonical path is instead `finalizePaid()`, which requires Treasury `EXECUTED` plus a nonzero Vault release commitment.

## Additional consistency hardening present on the same implementation SHA

The accumulated implementation also contains related consistency protections that reinforce this step without changing its canonical scope:

- cumulative awards for one application cannot exceed the application's requested amount;
- application nonce consumption is single-use per program/applicant;
- milestone ordinals are single-use per award;
- cancelled milestone face value is released from the active milestone aggregate;
- PAID finalization requires nonzero Treasury Vault-release evidence.

These protections are carried forward into GRANTS-AUDIT-3 adversarial/invariant qualification.

## Focused regression coverage

The retained Grants suite includes direct regressions for the GRANTS-AUDIT-2 lifecycle repairs, including:

- bound Award Registry/controller bypass and program-cap accounting;
- inactive-program award rejection;
- duplicate Treasury-disbursement binding rejection;
- cancelled-parent award approval rejection;
- Treasury-first cancellation requirement for approved milestones;
- executed Treasury payment cancellation rejection;
- successful PAID finalization only after valid executed Treasury evidence.

The repository verifier also mechanically checks the relevant source guards and regression-test presence.

## Level 1 qualification evidence

Exact implementation workflow: **420Grants Audit Qualification**  
Run: **37055267365**  
Result: **PASS**

### grants-contract-core — job 110998596847

- exact implementation-head checkout — PASS
- exact SHA verification — PASS
- `scripts/verify-grants-audit.py` — PASS
- Grants Solidity formatting — PASS
- Grants contract-family build — PASS
- focused Grants lifecycle/adversarial regression suite — PASS

### grants-security — job 110998596514

- exact implementation-head checkout — PASS
- exact SHA verification — PASS
- dangerous primitive scan — PASS
- hardening-profile Grants suite — PASS
- targeted Slither high-severity gate — PASS

Affected shared Solidity workflow: **Solidity Contracts**, run **37055267238** — **PASS** on the same implementation SHA.

## Evidence reuse validation

Comparison from implementation SHA `02244b26b699557c8c42600c635b38b276249183` to pre-closeout bookkeeping HEAD `c447a49d8ab64a721e35d3646827d7248d40d54b` contains only:

- `docs/audit/420GRANTS-AUDIT-1-QUALIFICATION.md`;
- `docs/audit/420GRANTS-AUDIT-REMEDIATION-ROADMAP.md`.

No executable source, tests, workflow, dependency, config, generated artifact, interface or deployment change occurred. Therefore the exact-SHA Level 1 evidence remains authoritative and no redundant requalification is required solely because GRANTS-AUDIT-1 evidence was committed.

## Files materially implementing this step

- `contracts/src/grants/GrantProgramRegistry420.sol`
- `contracts/src/grants/GrantAwardRegistry420.sol`
- `contracts/src/grants/GrantMilestoneRegistry420.sol`
- `contracts/test/GrantsGenesis420.t.sol`
- `contracts/config/420grants-genesis.json`
- `scripts/verify-grants-audit.py`
- `.github/workflows/grants-audit.yml`

## Milestone status

No separate Level 2 milestone is triggered by GRANTS-AUDIT-2 alone. The broader retained app integration milestone remains deferred until the related lifecycle/integration work has converged.

## Intentionally deferred

- broader retained Grants integration qualification — later Level 2 milestone;
- complete repository Level 3 closeout — GRANTS-AUDIT-8;
- production-equivalent live deployment and transaction evidence — GRANTS-AUDIT-9;
- Genesis/production closeout — GRANTS-AUDIT-10.

## Limitations

This Level 1 step establishes repository contract/lifecycle correctness for the defined remediation requirements. It does not claim live Treasury/Vault receipts, deployed runtime identity, Registry publication, or production-equivalent chain behavior.

## Blockers

**None for GRANTS-AUDIT-2.**

## Completion state

**COMPLETE**

Next canonical roadmap step: **GRANTS-AUDIT-3 — adversarial, replay and invariant qualification**.
