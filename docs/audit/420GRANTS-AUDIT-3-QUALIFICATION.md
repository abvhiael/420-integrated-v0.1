# GRANTS-AUDIT-3 qualification evidence

## Step

**GRANTS-AUDIT-3 — adversarial, replay and invariant qualification**

## Qualification level

**Level 1 — per-roadmap-step fast qualification**

This step qualifies the retained Grants lifecycle against adversarial, replay, cap-boundary, delegated-authority and Treasury-binding failure modes. The dedicated Grants workflow was run against the exact implementation SHA after the final test-formatting change.

## Implementation SHA

`ab6d245a193ac2e9d0369d2279090de276d9fc57`

## Reconciliation base

`main` at `14d46231aa4350b2e84dee52f0f664bdd2e785f4`

Audit branch: `feature/420grants-audit-remediation-v2`  
PR: #484 — `audit(grants): harden lifecycle and establish 420Grants audit track`

At qualification time PR #484 was open and mergeable and the audit branch was not behind `main`.

## Canonical GRANTS-AUDIT-3 requirements

### Application replay / default-deny delegation

**SATISFIED**

The retained suite proves that an ungranted delegate cannot submit an application, a correctly scoped application capability succeeds, the same canonical application cannot be replayed, and a consumed application nonce cannot be reused with altered content.

### Program and per-award cap boundaries

**SATISFIED**

The suite proves canonical program-award accounting, rejects program-cap overflow without mutating accounting, rejects applications above the configured per-award cap without consuming the nonce, and accepts the exact maximum boundary.

Application-level cumulative award accounting also rejects over-awarding one application across multiple awards.

### Controller bypass attempts

**SATISFIED**

Direct calls attempting to reserve program award capacity outside the one-time bound Award Registry controller fail closed.

### Inactive-program award attempts

**SATISFIED**

An application accepted before program deactivation cannot subsequently be converted into a new award after the program is inactive.

### Milestone aggregate caps and replay

**SATISFIED**

Milestone totals cannot exceed the parent award, milestone ordinals are single-use, and cancellation releases active milestone capacity without permitting ordinal replay.

### Treasury field mismatches

**SATISFIED**

The canonical Treasury binding matrix rejects mismatches in budget, recipient, amount, Civic action, purpose and Treasury state. Failed mismatch attempts leave both the Treasury-disbursement binding and milestone state unchanged.

### Duplicate Treasury-disbursement binding

**SATISFIED**

One Treasury disbursement cannot approve two milestones, and a failed replay attempt cannot overwrite the original milestone binding.

### Cancelled-parent approval attempts

**SATISFIED**

A claimed milestone whose parent award has been cancelled cannot be approved.

### Early finalization / payment-proof integrity

**SATISFIED**

A milestone cannot become PAID before Treasury execution and cannot become PAID from an EXECUTED Treasury record lacking a nonzero Vault release commitment. Finalization succeeds only after canonical executed-payment evidence is present.

### Executed-payment cancellation

**SATISFIED**

An executed Treasury payment cannot be hidden by cancelling its approved Grants milestone. The only valid terminal path is PAID finalization.

### Delegated capability boundaries

**SATISFIED**

Milestone claim delegation is default-deny. Wrong award scope and wrong action capability are rejected, while the correctly scoped Grants milestone capability succeeds.

### Dangerous Solidity primitive scan

**SATISFIED**

The retained security job passed the Grants forbidden-primitive scan and targeted Slither high-severity gate on the same exact implementation SHA.

## Focused regression inventory

The exact-head retained suite includes:

- `testApplicationReplayAndDelegationDefaultDeny`
- `testApplicationNonceCannotBeReusedWithDifferentContent`
- `testProgramAndAwardCapsFailClosedAndAccountingAgrees`
- `testApplicationCannotBeOverAwardedAcrossMultipleAwards`
- `testOnlyBoundAwardRegistryCanReserveProgramCap`
- `testInactiveProgramRejectsNewAward`
- `testMilestoneMustMatchTreasuryExactlyAndFinalizeAfterExecution`
- `testTreasuryDisbursementCannotPayTwoMilestones`
- `testCancelledAwardCannotApproveClaimedMilestone`
- `testApprovedMilestoneRequiresTreasuryCancellationBeforeGrantCancellation`
- `testExecutedTreasuryPaymentCannotBeHiddenByMilestoneCancellation`
- `testMilestoneOrdinalCannotBeReusedAndCancelledCapacityCanBeReplaced`
- `testPerAwardCapFailsClosed`
- `testTreasuryBindingRejectsEveryCanonicalFieldMismatch`
- `testMilestoneDelegationIsDefaultDenyAndScopeBound`
- `testMilestoneTotalCannotExceedAward`

## Level 1 exact-head qualification evidence

Exact-head workflow: **420Grants Audit Qualification**  
Run: **37059922255** / run number **24**  
Result: **PASS**

### grants-contract-core — job 111014056705

- exact qualification head checkout — PASS
- exact SHA verification — PASS
- Grants audit model verifier — PASS
- Grants Solidity formatting — PASS
- Grants contract-family build — PASS
- Grants lifecycle and adversarial regression suite — PASS

### grants-security — job 111014056888

- exact qualification head checkout — PASS
- exact SHA verification — PASS
- dangerous Grants primitive scan — PASS
- Grants tests under hardening profile — PASS
- targeted Grants Slither high-severity gate — PASS

Affected shared **Solidity Contracts** workflow: run **37059921662** / run number **4236** — **PASS** on the same implementation SHA.

Skipped unrelated/path-filtered workflows are not counted as passing evidence and are not required by this app-scoped Level 1 step.

## Files materially exercised by this step

- `contracts/test/GrantsGenesis420.t.sol`
- `contracts/src/grants/GrantProgramRegistry420.sol`
- `contracts/src/grants/GrantApplicationRegistry420.sol`
- `contracts/src/grants/GrantAwardRegistry420.sol`
- `contracts/src/grants/GrantMilestoneRegistry420.sol`
- `contracts/src/grants/GrantAuthorization420.sol`
- `scripts/verify-grants-audit.py`
- `.github/workflows/grants-audit.yml`

## Requirements satisfied

- application replay resistance qualified;
- application nonce replay with altered content rejected;
- application and milestone delegation proved default-deny and scope/action bounded;
- program and per-award cap boundaries qualified;
- application over-award invariant qualified;
- bound-controller bypass rejected;
- inactive-program award creation rejected;
- milestone aggregate cap and ordinal replay protections qualified;
- complete canonical Treasury field mismatch matrix rejected;
- duplicate Treasury-disbursement reuse rejected;
- cancelled-parent approval rejected;
- early PAID finalization rejected;
- missing Vault release commitment rejected;
- executed-payment cancellation rejected;
- dangerous Solidity primitive and Slither high-severity gates passed;
- exact-head app-specific workflow and affected shared Solidity workflow both passed.

## Milestone status

No separate Level 2 milestone is triggered by GRANTS-AUDIT-3 alone. The broader Civic/Treasury/Vault/capability reconciliation remains the next roadmap step.

## Intentionally deferred

- cross-system Civic/Treasury/Vault/capability reconciliation — GRANTS-AUDIT-4;
- deployment/Registry release-candidate artifacts — GRANTS-AUDIT-5;
- client/indexer integration — GRANTS-AUDIT-6;
- complete repository exact-final-head closeout — GRANTS-AUDIT-8;
- production-equivalent live deployment evidence — GRANTS-AUDIT-9;
- Genesis/production closeout — GRANTS-AUDIT-10.

## Limitations

This qualification establishes repository-side adversarial and invariant behavior. It does not claim live deployed runtime identity, Registry publication, live Treasury/Vault receipts, reorg/RPC behavior or production-equivalent chain execution.

## Blockers

**None for GRANTS-AUDIT-3.**

## Completion state

**COMPLETE**

Next canonical roadmap step: **GRANTS-AUDIT-4 — Civic/Treasury/Vault/capability integration reconciliation**.
