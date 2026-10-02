# 420Grants complete repository audit — 2026-10-02

## Application

**420Grants**

## Canonical definition

420Grants is a Genesis implementation protocol providing governed grant program, application, award and milestone state. It is not a separate public standalone Genesis application in the frozen public catalogue.

Authority boundaries:
- 420 Civic / GovernanceTimelock — governance decisions and privileged Grants mutations;
- 420 Treasury — budget/disbursement accounting and policy;
- 420Vault — asset custody and release;
- CapabilityRegistry420 — narrow delegated application/milestone submission authority;
- 420Grants — grant workflow/entitlement state and exact binding to Treasury disbursements;
- Wallet/Indexer/Explorer/Search/other clients — replaceable consumers, never grant-payment authority.

Canonical suite: GrantIds420, GrantAuthorization420, GrantProgramRegistry420, GrantApplicationRegistry420, GrantAwardRegistry420, GrantMilestoneRegistry420 and GrantRouter420.

Canonical Grants router address policy is Registry-resolved with **no fixed Genesis address**.

## Repository state at audit start

- repository: abvhiael/420-integrated-v0.1
- baseline main: 27ae1873edcca8fb05dec9f4e70af9832b5dafe2
- audit branch: feature/420grants-audit-remediation
- historical implementation PR: #26, feat(grants): add Genesis 420Grants lifecycle
- historical manifest status: IMPLEMENTED_PENDING_EXACT_HEAD_QUALIFICATION

## Architecture discovered

The implemented design is non-custodial:

Civic/GovernanceTimelock -> Grants workflow -> Treasury scheduled disbursement -> Treasury execution evidence -> Vault release commitment -> Grants PAID finalization.

Applications and milestones may be submitted by their principal or a narrowly scoped CapabilityRegistry delegate. Governance controls program/award/milestone administration. Grants itself contains no token transfer, Vault release, arbitrary-call, delegatecall or custody path.

## File/component inventory

| Component | Status | Notes |
| --- | --- | --- |
| Grant IDs/domains | COMPLETE | canonical component/action/program identifiers present |
| capability adapter | COMPLETE | program/award scoped default-deny delegated checks |
| program registry | REMEDIATED | canonical aggregate-award accounting plus one-time Award Registry controller |
| application registry | COMPLETE | canonical IDs, open-program validation, immutable submission |
| award registry | REMEDIATED | canonical program accounting and inactive-program rejection |
| milestone registry | REMEDIATED | parent-state validation, one-disbursement/one-milestone binding, cancellation/payment reconciliation |
| Grants router | COMPLETE | read-oriented program/award/milestone facade |
| Genesis config | REMEDIATED | classification, address model, deployment order and invariants reconciled |
| focused Foundry tests | REMEDIATED | adversarial replay/accounting/cancellation regressions added |
| dedicated audit verifier | CREATED | scripts/verify-grants-audit.py |
| dedicated audit CI | CREATED | .github/workflows/grants-audit.yml |
| standalone frontend | NOT APPLICABLE | not required by frozen public Genesis app catalogue |
| dedicated backend/API | NOT APPLICABLE | canonical state is contract-based; shared Indexer/client infrastructure is external |
| fixed Grants predeploy | NOT APPLICABLE | canonical namespace requires Registry resolution |

## Findings and remediation

### F-01 — divergent program award accounting — HIGH integrity risk

Before: GrantProgramRegistry420.Program.awarded and GrantAwardRegistry420.programAwarded were independent counters. Award creation updated only the Award Registry counter; the Program Registry value remained stale. GrantProgramRegistry420.reserveAward() was separately callable by Governance but was not part of award creation.

Repair: GrantProgramRegistry420 is now the single aggregate accounting authority. A one-time-bound GrantAwardRegistry420 is the only caller allowed to reserve award capacity. GrantAwardRegistry420.programAwarded() remains as a compatibility view over canonical Program Registry state.

### F-02 — Treasury disbursement replay across milestones — HIGH fund-accounting risk

Before: two milestones with matching program, recipient, amount, Civic and purpose fields could be approved against the same Treasury disbursement ID. One Treasury execution could therefore make multiple Grants milestones appear payable.

Repair: treasuryDisbursementMilestone enforces one-to-one binding. Duplicate use fails closed. An approved binding may be released only if the milestone is cancelled before Treasury execution.

### F-03 — cancelled parent award could still approve a claimed milestone — HIGH lifecycle risk

Before: submitClaim() required an ACTIVE award, but approve() did not. Governance could cancel an award after claim submission and still approve payment.

Repair: approve() now requires the parent award to remain ACTIVE.

### F-04 — inactive program could still receive new awards — MEDIUM lifecycle risk

Before: application submission required programs.isOpen(), but award creation did not require the program to remain active.

Repair: award creation rejects inactive programs while still permitting normal post-application-window award decisions for an active program.

### F-05 — executed Treasury payment could be hidden by cancelling the approved milestone — HIGH accounting/provenance risk

Before: an APPROVED milestone could be cancelled without checking whether its bound Treasury disbursement had already executed.

Repair: cancellation rejects an already executed Treasury disbursement; the milestone must instead be finalized PAID, preserving canonical payment history.

## Security assessment

Verified or mitigated behavior:
- default-deny delegated submission authority;
- GovernanceTimelock-only administrative mutation;
- no token custody/transfer path in Grants;
- exact Treasury budget/recipient/amount/Civic/purpose matching;
- Treasury execution and nonzero Vault release evidence required for PAID;
- program and milestone aggregate caps;
- exact replay rejection for existing application/award/milestone IDs;
- one Treasury disbursement cannot fund more than one milestone after remediation;
- dangerous Solidity primitives delegatecall, selfdestruct and tx.origin are forbidden by dedicated audit CI.

Accepted design constraints:
- cancellation does not claw back already released assets;
- recovery of paid funds is a separate Civic/Treasury action;
- Registry-resolved Grants contracts have no fixed Genesis address;
- derived clients/indexers are non-authoritative.

Remaining live/deployment risks:
- no official production-equivalent public testnet deployment evidence;
- no final deployed runtime hashes/addresses/Registry publication receipts;
- no live end-to-end Treasury/Vault payment receipts for the Grants release candidate;
- whole-system Genesis reconciliation and external security review remain later release gates.

## Requirement matrix

| Requirement | Current implementation | Tests | Status | Required remediation |
| --- | --- | --- | --- | --- |
| non-custodial Grants authority | no transfer/custody path | verifier/security scan | COMPLETE | none |
| program definition/caps | Program Registry | cap tests | COMPLETE | none |
| aggregate award accounting | single Program Registry counter after remediation | accounting agreement + cap tests | COMPLETE | exact-head qualify |
| application canonical identity | Application Registry | replay/default-deny | COMPLETE | none |
| delegated application submission | CapabilityRegistry scope | delegate test | COMPLETE | none |
| award recipient/application binding | Award Registry | lifecycle tests | COMPLETE | none |
| inactive-program award rejection | remediated | regression | COMPLETE | exact-head qualify |
| milestone aggregate cap | Milestone Registry | aggregate cap | COMPLETE | none |
| exact Treasury binding | exact field checks | mismatch test | COMPLETE | none |
| one disbursement / one milestone | remediated binding map | replay regression | COMPLETE | exact-head qualify |
| parent award active at approval | remediated | cancellation regression | COMPLETE | exact-head qualify |
| PAID only after Treasury execution + Vault evidence | finalizePaid | early/final test | COMPLETE | none |
| executed payment cannot be hidden by cancellation | remediated | regression | COMPLETE | exact-head qualify |
| Registry/address model | Registry-resolved/no fixed address | repository verifier | COMPLETE | live publication later |
| standalone Grants website | not required | n/a | NOT APPLICABLE | do not invent |
| live deployment qualification | not available | no live evidence | BLOCKED | official testnet |
| production qualification | not reached | not reached | BLOCKED | testnet + Genesis/system gates + external review |

## Readiness before GRANTS-AUDIT-8 closeout

- CODE COMPLETE: NO — remediation staged but not yet exact-head qualified.
- BUILD COMPLETE: NO — exact final audit-head build evidence pending.
- CONTRACT COMPLETE: NO — exact final audit-head qualification pending.
- TEST COMPLETE: NO — dedicated audit CI and affected repository CI pending.
- DOCUMENTATION COMPLETE: YES for repository-stage scope, subject to exact-head verifier.
- INTEGRATION COMPLETE: NO — repository authority reconciliation exists; live Registry/Treasury/Vault integration is testnet-gated.
- SECURITY QUALIFIED: NO — repository hardening pending CI; external/live review remains later.
- TESTNET READY: NO — no official deployed candidate evidence.
- GENESIS READY: NO — testnet and whole-system Genesis gates remain.
- PRODUCTION READY: NO — testnet, Genesis, external audit and production operations remain.

## Next gate

Complete GRANTS-AUDIT-8 by qualifying the exact PR head, fixing failures, then commit durable evidence tied to that exact implementation SHA. After repository qualification, stop at GRANTS-AUDIT-9 until the official production-equivalent testnet exists.
