---
title: 420Grants Threat Model
audience:
  - security
  - developer
  - operator
category: security
status: current
version: current
---

# 420Grants threat model

## Scope

This threat model covers the repository-qualified 420Grants contracts and their canonical dependencies: GovernanceTimelock/Civic, 420Treasury, 420Vault, CapabilityRegistry420, ProtocolRegistry and replaceable Indexer/Wallet/client surfaces.

420Grants owns grant workflow state. It does not own Treasury custody, governance authorization or client signing authority.

## Security objectives

420Grants must preserve these properties:

1. only GovernanceTimelock performs governed Program/Award/Milestone mutations;
2. delegated Application and Milestone submissions are default-deny and exactly component/action/object-scope bounded;
3. immutable Application identity and consumed nonce rules prevent replay/substitution;
4. Program, Application, Award and Milestone caps cannot be exceeded;
5. inactive/cancelled/terminal parent state cannot be bypassed;
6. one Treasury disbursement cannot fund multiple Milestones;
7. Milestone approval binds exact Treasury budget, recipient, amount, Civic action and purpose;
8. PAID requires canonical Treasury EXECUTED state plus nonzero Vault release commitment;
9. Grants never acquires custody or transfer authority;
10. derived clients remain non-authoritative and Wallet/SmartAccount remains transaction authority.

## Trust boundaries

| Boundary | Trusted for | Not trusted for |
| --- | --- | --- |
| GovernanceTimelock | governed Grants mutations | custody, arbitrary capability bypass |
| CapabilityRegistry420 | exact delegated Grants authorization result | governance mutation, Treasury/Vault bypass |
| TreasuryDisbursementRegistry420 | canonical disbursement fields/state/release commitment | Grants workflow state |
| 420Vault | actual asset custody/release | grant selection/approval |
| ProtocolRegistry | qualified service/component discovery | Grants lifecycle authority |
| Indexer/Wallet/Explorer | reconstruction/presentation/transaction preparation | canonical state, governance or custody |
| Treasury authorized executor | submitting Treasury execution evidence within its authorization | independent proof that a nonzero hash corresponds to a real Vault release |

## Threats and mitigations

### T1 — governance authority bypass

**Threat:** a non-timelock caller creates or mutates Programs, Awards or governed Milestones.

**Mitigation:** governed registries inherit `SystemAccess` and gate mutations with `onlyGovernance`; negative regressions exercise non-timelock mutation attempts.

**Residual risk:** compromised GovernanceTimelock/governance execution remains outside Grants' local authority model and requires governance-system incident response.

### T2 — capability overreach

**Threat:** a delegated principal uses a grant intended for one action/program/award to submit another object/action.

**Mitigation:** `GrantAuthorization420` queries the fixed Grants component, exact action and domain-separated program/award scope; tests reject wrong action and wrong object scope.

**Residual risk:** compromise of CapabilityRegistry component authority can issue malicious but formally valid grants; revoke affected grants and audit resulting submissions.

### T3 — application replay/substitution

**Threat:** replay an Application ID, reuse applicant/program nonce with altered content, or substitute recipient later.

**Mitigation:** canonical domain-separated Application identity, immutable Application records, per-program/applicant nonce consumption, and Award recipient equality with the recorded applicant.

### T4 — cap/accounting bypass

**Threat:** exceed Program cap, per-award cap, Application requested amount or Award milestone face value.

**Mitigation:** ProgramRegistry is the single aggregate awarded authority; only the one-time-bound AwardRegistry reserves Program cap; AwardRegistry tracks Application awarded amount; MilestoneRegistry tracks aggregate non-cancelled milestone total.

**Residual risk:** incorrect deployment/controller binding could invalidate assumptions; AUDIT-5 deployment qualification and operator preflight checks detect this.

### T5 — inactive/cancelled parent bypass

**Threat:** create Award after Program deactivation, approve a Milestone under a cancelled Award, or progress terminal state.

**Mitigation:** explicit active-state checks and terminal transition guards; adversarial regressions cover these cases.

### T6 — Treasury substitution

**Threat:** approve a Milestone against a disbursement with different budget, recipient, amount, Civic commitment or purpose.

**Mitigation:** exact field-by-field match while Treasury state is SCHEDULED; mismatch matrix is retained in Grants adversarial tests.

### T7 — duplicate Treasury funding

**Threat:** bind one Treasury disbursement to multiple Milestones.

**Mitigation:** `treasuryDisbursementMilestone` enforces one-to-one binding; duplicate binding is rejected.

### T8 — detach from executable/executed Treasury payment

**Threat:** cancel an approved Milestone while its Treasury payment can still execute, or hide an already executed payment.

**Mitigation:** approved cancellation requires Treasury CANCELLED first; an executed payment cannot be detached and must be finalized PAID.

### T9 — false PAID evidence

**Threat:** mark Milestone PAID before Treasury execution or without release commitment.

**Mitigation:** finalization requires Treasury EXECUTED and nonzero `vaultReleaseHash`.

**Residual risk:** Treasury V1 uses authorized-executor commitment-only evidence. A malicious/compromised authorized executor can submit an arbitrary nonzero value unless operational controls correlate it to real Vault evidence. GRANTS-AUDIT-9 must prove live correlation.

### T10 — direct custody/transfer expansion

**Threat:** Grants evolves into a second Treasury/Vault path through payable/native/ERC20 transfer logic.

**Mitigation:** architecture prohibits custody; audit verifier scans the Grants runtime suite for custody/transfer primitives/interfaces; Router remains read-only.

### T11 — Registry/service substitution

**Threat:** clients resolve an unqualified Grants Router or wrong dependency graph.

**Mitigation:** ProtocolRegistry publication binds Router code identity plus release commitments; AUDIT-5 local deployment test proves exact Router resolution and wrong-Router visibility.

**Residual risk:** live publication/address/runtime correctness remains GRANTS-AUDIT-9 evidence.

### T12 — derived-state authority confusion

**Threat:** Indexer/Wallet/UI projection is treated as canonical and used to overwrite or contradict chain state.

**Mitigation:** Grants read models return `authoritative: false`; operator recovery is chain-outward; SmartAccount420 remains Wallet transaction authority.

### T13 — reorg/RPC disagreement

**Threat:** clients display a grant transition from noncanonical history or disagree across RPC providers.

**Mitigation:** Indexer provenance includes block/tx/log identity; derived projections are rebuildable.

**Residual risk:** production-equivalent restart/reorg/RPC-disagreement behavior is explicitly deferred to GRANTS-AUDIT-9.

### T14 — evidence loss during incident response

**Threat:** corrective deployment or projection rebuild destroys forensic evidence.

**Mitigation:** operator runbook requires preservation of chain identity, runtime hashes, Registry/Civic/Capability/Treasury/Vault records and client provenance before correction.

## Abuse cases that must fail closed

- non-governance Program/Award/Milestone mutation;
- default-deny delegated submission;
- wrong action capability;
- wrong Program/Award capability scope;
- Application replay or nonce reuse with changed content;
- Award recipient substitution;
- inactive Program Award creation;
- Program/per-award/Application/Milestone cap overflow;
- reused Milestone ordinal;
- Treasury field/state mismatch;
- duplicate Treasury disbursement binding;
- approval after parent Award cancellation;
- PAID before Treasury execution;
- PAID with zero Vault release commitment;
- approved cancellation before Treasury cancellation;
- cancellation after Treasury execution;
- Grants custody/transfer primitive introduction;
- client transaction handoff that bypasses SmartAccount420;
- Indexer descriptor ABI/indexing drift.

## Monitoring signals

Security monitoring should correlate:

- Grants lifecycle events;
- GovernanceTimelock execution;
- CapabilityRegistry grant/revoke events;
- Treasury schedule/execute/cancel events;
- Vault release evidence;
- ProtocolRegistry publication/lifecycle changes;
- Indexer provenance/reorg signals.

High-priority alerts include:

- unexpected Grants runtime/dependency hash;
- Award Registry controller mismatch;
- Milestone Treasury dependency mismatch;
- capability activity outside expected operator window/scope;
- PAID state lacking correlated Vault evidence;
- Registry service implementation change;
- derived client disagreement with canonical chain state.

## Recovery principles

- canonical chain state is authoritative;
- Grants cannot rewrite historical Applications, paid Milestones or executed Treasury state;
- revoke compromised capabilities narrowly;
- use governance for corrective lifecycle/deployment changes;
- use Treasury/Civic for recovery of already-released assets;
- rebuild derived services from chain state;
- do not invent fixed addresses or operational shortcuts.

## Residual risks and live-only evidence

Repository qualification does not close:

- actual network/genesis identity;
- live Grants implementation/runtime hashes;
- live CapabilityRegistry identity/delegation;
- live ProtocolRegistry publication;
- actual program-to-PAID Treasury/Vault correlation;
- operational key/governance compromise;
- live reorg/restart/RPC-disagreement behavior.

Those are GRANTS-AUDIT-9 concerns.

## Security evidence

Retained repository qualification:

- GRANTS-AUDIT-3 adversarial/replay/invariant evidence;
- GRANTS-AUDIT-4 cross-authority reconciliation evidence;
- GRANTS-AUDIT-5 deployment/Registry evidence;
- GRANTS-AUDIT-6 client/indexer/Wallet integration evidence;
- targeted Grants Slither high-severity gate;
- forbidden `delegatecall`, `selfdestruct`, and `tx.origin` scan.

Level 3 exact accumulated merge-candidate qualification is owned by GRANTS-AUDIT-8.
