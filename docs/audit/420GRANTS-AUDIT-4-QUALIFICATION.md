# GRANTS-AUDIT-4 qualification evidence

## Step

**GRANTS-AUDIT-4 — Civic/Treasury/Vault/capability integration reconciliation**

## Qualification level

**Level 1 — per-roadmap-step fast qualification**

This step reconciles the existing Grants authority boundaries against the canonical Civic/GovernanceTimelock, Treasury, Vault-evidence and CapabilityRegistry contracts. No shared protocol semantics were changed. Qualification therefore remains app-scoped and targeted; Level 2 is not triggered because this step introduced no new shared dependency or authority model and the retained Grants suite directly exercises the reconciled boundaries.

## Implementation SHA

`7973f0d7f75209d48531f02e00f6ca31d3e7a73b`

## Reconciliation base

`main` at `14d46231aa4350b2e84dee52f0f664bdd2e785f4`

Audit branch: `feature/420grants-audit-remediation-v2`  
PR: #484 — `audit(grants): harden lifecycle and establish 420Grants audit track`

At qualification time PR #484 was open and mergeable. The branch was 43 commits ahead of and 0 commits behind `main`.

## Canonical definition and authority boundary

The canonical architecture requires:

- Civic/GovernanceTimelock to remain the sole privileged mutation authority for governed Grants state;
- 420Treasury to remain the budget/disbursement accounting and execution-state authority;
- 420Vault to remain custody/release authority;
- Grants to consume Treasury completion evidence without becoming custody or transfer authority;
- CapabilityRegistry420 delegation to remain default-deny and component/action/object-scope bounded;
- approved milestones to bind exactly to canonical Treasury budget, recipient, amount, Civic action and purpose;
- PAID to require canonical Treasury `EXECUTED` state plus a nonzero Vault release commitment.

## Gap analysis and implementation completed

The underlying Grants protocol semantics already satisfied the canonical integration model. Two qualification gaps remained and were closed without weakening or broadening authority:

### 1. Cross-contract verifier coverage

`scripts/verify-grants-audit.py` now:

- compares the Grants-local Treasury `State` enum directly with canonical `TreasuryDisbursementRegistry420.State`;
- compares the Grants-local Treasury `Disbursement` struct field layout directly with the canonical Treasury struct;
- verifies the Treasury disbursement getter surface used by Grants;
- verifies exact budget, recipient, amount, Civic-action and purpose binding checks;
- verifies approval requires canonical `SCHEDULED` state;
- verifies PAID finalization requires `EXECUTED` plus nonzero `vaultReleaseHash`;
- verifies `SystemAccess` binds authority directly to immutable `governanceTimelock`;
- verifies all governed Program/Award/Milestone mutations retain `onlyGovernance`;
- verifies Grants capability checks bind the fixed Grants component, supplied action and exact program/award object scope;
- verifies Grants runtime sources contain no payable/custody/transfer primitives or Vault/ERC20 custody interface.

### 2. Missing negative integration regressions

`contracts/test/GrantsGenesis420.t.sol` now explicitly proves:

- application delegation with the wrong program scope is rejected;
- application delegation with the wrong action is rejected;
- non-timelock callers cannot create governed Programs;
- non-timelock callers cannot create governed Awards;
- non-timelock callers cannot create governed Milestones;
- non-timelock callers cannot deactivate Programs;
- non-timelock callers cannot cancel Awards;
- Program, Award and Milestone registries are bound to the expected GovernanceTimelock address.

Existing retained regressions continue to prove exact Treasury field matching, early-finalization rejection, nonzero Vault-release evidence, duplicate-disbursement rejection, executed-payment cancellation rejection, and award-scoped milestone delegation.

## Requirements satisfied

### Treasury interface shape matches canonical TreasuryDisbursementRegistry420

**SATISFIED**

The verifier compares the local Grants Treasury enum and complete `Disbursement` struct layout against `contracts/src/treasury/TreasuryDisbursementRegistry420.sol`. The canonical fields and ordering match, including budget, recipient, asset, amount, timing, Civic commitment, purpose, Vault release commitment, state and existence marker.

### Exact Treasury binding

**SATISFIED**

Milestone approval remains restricted to an existing canonical Treasury record in `SCHEDULED` state whose budget, recipient, amount, Civic action and purpose exactly match the Program/Award/Milestone state. The retained mismatch matrix rejects every canonical field mismatch without changing milestone state or creating a disbursement binding.

### Treasury execution + Vault release commitment is the only PAID proof

**SATISFIED**

`finalizePaid()` requires the already-bound Treasury record to be `EXECUTED` and to carry a nonzero `vaultReleaseHash`. The retained regression rejects both pre-execution finalization and EXECUTED-with-zero-release evidence.

This remains the adopted V1 commitment-only evidence model: Grants does not independently move assets or cryptographically re-prove the Vault transaction. Live correlation belongs to production-equivalent testnet qualification.

### Grants has no transfer/custody path

**SATISFIED**

The Grants runtime suite contains no payable path, native-value transfer/send/call-value primitive, ERC20 custody interface or Vault custody interface. GrantRouter420 remains read-only. Grants records workflow/entitlement state and consumes Treasury evidence only.

### GovernanceTimelock remains the only governance mutation authority

**SATISFIED**

`SystemAccess` stores immutable `governanceTimelock` and `onlyGovernance` compares `msg.sender` directly to that address. Governed Program, Award and Milestone mutations retain that modifier. New negative tests prove representative non-timelock mutations fail across all three governed Grants registries.

### CapabilityRegistry delegation remains object/scope bounded

**SATISFIED**

`GrantAuthorization420` always queries `CapabilityRegistry420.isAuthorized` using the fixed Grants component plus the exact requested action and a domain-separated program or award scope. Application delegation now explicitly rejects wrong program scope and wrong action; retained milestone delegation already rejects wrong award scope and wrong action. Both paths remain default-deny.

## Implementation commits for this step

- `8ff82ad766d2d4d2f0c227814f8819650b2a0211` — add governance/capability integration negative tests;
- `ca93944789d23fc0cbc59e4c4adf9612dfe3455f` — strengthen cross-authority audit verifier;
- `7973f0d7f75209d48531f02e00f6ca31d3e7a73b` — Forge-format-only correction; exact qualified implementation head.

## CI diagnosis before final qualification

420Grants Audit Qualification run #29 / `37064050596` correctly failed in `grants-contract-core` at the Forge formatting gate. The strengthened repository verifier had already passed. The failure was a test-harness formatting defect in one newly added multiline low-level call, not a protocol behavior failure.

The defect was corrected exactly to Forge's requested formatting in `7973f0d7...`; no assertions or semantics were weakened.

## Level 1 exact-head qualification evidence

Exact-head workflow: **420Grants Audit Qualification**  
Run: **37065796100** / run number **30**  
Result: **PASS**

### grants-contract-core — job 111033535620

- exact qualification head checkout — PASS;
- exact SHA verification — PASS;
- strengthened Grants audit model verifier — PASS;
- Grants Solidity formatting — PASS;
- Grants contract-family build — PASS;
- Grants lifecycle/adversarial/integration regressions — PASS.

### grants-security — job 111033535266

- exact qualification head checkout — PASS;
- exact SHA verification — PASS;
- dangerous Grants primitive scan — PASS;
- retained Grants suite under hardening profile — PASS;
- targeted Grants Slither high-severity gate — PASS.

### Affected shared workflow

**Solidity Contracts** run **37065796096** / #4284 completed **SUCCESS** on the same SHA.

Its classifier completed successfully and correctly skipped the expensive repository-wide Foundry jobs under the active PR classification policy. This is not represented as a full-repository Solidity inventory pass; the app-specific Grants workflow owns the directly applicable build/test/security qualification for this ordinary step.

Unrelated Treasury, Registry, Docs, Indexer and Genesis workflows resolved as expected path/classification skips and are not counted as passing AUDIT-4 evidence.

## Bookkeeping requalification / evidence reuse validation

After exact-head implementation qualification passed, the closeout introduced documentation bookkeeping only.

Comparison from implementation SHA `7973f0d7f75209d48531f02e00f6ca31d3e7a73b` through roadmap bookkeeping commit `31005d1c29e06171ab8fb10ef3047fd6bf4a1474` contains only:

- `docs/audit/420GRANTS-AUDIT-4-QUALIFICATION.md`;
- `docs/audit/420GRANTS-AUDIT-REMEDIATION-ROADMAP.md`.

No executable Solidity, test, workflow, dependency, configuration, generated/runtime artifact, interface, deployment state or substantive requirement changed. Therefore exact-SHA run `37065796100` remains authoritative for GRANTS-AUDIT-4 and no recursive app qualification is required solely for evidence bookkeeping.

Evidence document creation commit: `57d972dddbc14bf768804b6e58b8bf672c92244e`.  
Roadmap completion bookkeeping commit: `31005d1c29e06171ab8fb10ef3047fd6bf4a1474`.

## Files materially changed for this step

- `contracts/test/GrantsGenesis420.t.sol`
- `scripts/verify-grants-audit.py`

No Grants production Solidity semantics, Treasury production Solidity, Vault production Solidity, CapabilityRegistry production Solidity, workflow definition, dependency, deployment configuration, generated artifact or address authority changed.

## Security / adversarial / invariant result

**PASS**

The exact-head suite proves default-deny delegated access, object/action scope separation, exclusive timelock mutation authority, exact Treasury binding, PAID evidence requirements and absence of dangerous Grants primitives. Targeted Slither reports no blocking high-severity Grants finding.

## Level 2 milestone status

**NOT TRIGGERED by GRANTS-AUDIT-4.**

This step reconciled and strengthened qualification of already-existing cross-authority boundaries. It introduced no new shared implementation dependency, authority, lifecycle or cross-component runtime semantics requiring a separate retained Level 2 integration run.

A broader retained app integration milestone may be appropriate once the Registry/deployment model and client/indexer integration work in GRANTS-AUDIT-5 and GRANTS-AUDIT-6 converge.

## Intentionally deferred

- reproducible release-candidate artifact/runtime hashes and Registry publication descriptor — GRANTS-AUDIT-5;
- Grants client/indexer/user-flow integration — GRANTS-AUDIT-6;
- documentation/threat-model/operator closeout — GRANTS-AUDIT-7;
- complete exact-final-head Level 3 app-phase qualification — GRANTS-AUDIT-8;
- live deployed Treasury/Vault correlation and complete production-equivalent flow — GRANTS-AUDIT-9;
- Genesis/production closeout — GRANTS-AUDIT-10.

## Limitations

Repository qualification proves the configured authority boundaries and retained contract behavior. It does not prove that a real testnet Vault release occurred. Under the canonical Treasury V1 evidence model, production-equivalent qualification must correlate `vaultReleaseHash` with actual Vault transaction/event/receipt evidence.

## Blockers

**None for GRANTS-AUDIT-4.**

## Completion state

**COMPLETE**

Next canonical roadmap step: **GRANTS-AUDIT-5 — Registry, address and deployment model**.
