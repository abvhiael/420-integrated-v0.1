# 420Treasury TREASURY-AUDIT-2 qualification evidence

Status: **COMPLETE**  
Roadmap step: **TREASURY-AUDIT-2 — contract lifecycle and fail-closed hardening**  
Qualification level: **Level 1 — per-roadmap-step fast qualification**  
Implementation SHA: `56429210af5738114b47a1aa658509ee19a3b440`  
Qualification base/main SHA: `27ae1873edcca8fb05dec9f4e70af9832b5dafe2`  
Audit branch: `audit/420treasury-complete-20261001`  
Pull request: **#474**  
CI workflow: **420Treasury audit qualification**  
Passing workflow run: **36967108988**  
Passing job: **110713142223**

## Canonical scope

TREASURY-AUDIT-2 hardens the existing Treasury budget/disbursement lifecycle without changing the canonical custody or governance model:

- 420Treasury remains the budget/disbursement control plane.
- 420Vault remains the asset-custody/release authority.
- Budget creation, scheduling and cancellation remain GovernanceTimelock/Civic-controlled.
- Execution remains default-deny and narrowly capability-scoped to the exact disbursement.
- TreasuryRouter420 remains registry-resolved and is not assigned a fixed Genesis predeploy.

## Implementation completed

### `contracts/src/treasury/TreasuryDisbursementRegistry420.sol`

- scheduled disbursements may not begin before the parent budget validity window;
- scheduled disbursements may not expire after the parent budget validity window;
- execution re-checks parent-budget effectiveness;
- execution re-checks the current asset policy, including current single-disbursement allowance;
- nonzero Vault release commitment remains mandatory;
- existing exact-disbursement capability authorization, epoch accounting, cancellation release accounting and terminal state behavior are preserved.

### `contracts/src/treasury/TreasuryRouter420.sol`

- `isExecutable` now agrees with the write path on:
  - scheduled state;
  - disbursement timing;
  - effective parent budget;
  - current asset policy/single-disbursement allowance.

### `contracts/test/TreasuryGenesis420.t.sol`

Focused qualification was expanded to cover:

1. Civic-bound budget creation and replay-safe canonical disbursement IDs;
2. default-deny execution and exact scoped capability authorization;
3. single-disbursement cap fail-closed behavior;
4. epoch-cap enforcement across multiple disbursements;
5. early and late execution rejection;
6. rejection of disbursement windows that outlive the parent budget;
7. policy revocation blocking both router eligibility and execution;
8. rejection of zero Vault release commitment;
9. cancellation releasing reserved commitment and remaining terminal against replay.

## CI correction made during qualification

The first Treasury workflow attempt used `scripts/verify-genesis-dapps.py`, a repository/global Genesis inventory verifier. It failed on unrelated Governance, Explorer, Analytics and Notifications inventory drift even though the Treasury build and all focused Treasury tests passed.

Under the phase-based qualification policy, that global verifier is not a valid Level 1 Treasury requirement. The workflow was corrected rather than weakening protocol checks:

- removed the broad Genesis application inventory verifier from TREASURY-AUDIT-2 Level 1;
- removed the broad GOV-AUDIT-7 integration verifier as a Treasury surrogate;
- added a Treasury-specific authority/config verifier that checks:
  - Treasury schema/suite identity;
  - 420Vault custody boundary;
  - GovernanceTimelock/Civic governance boundary;
  - all ten canonical TREASURY invariants remain present;
  - TreasuryRouter420 remains registry-resolved;
  - TreasuryRouter420 remains absent from fixed Genesis assignments;
  - no new frozen Treasury predeploy is required.

Broad Genesis/global verification remains deferred to its canonical Level 3 owner and is not recorded as passing evidence for this step.

## Level 1 results on exact implementation SHA

Workflow run `36967108988`, job `110713142223`, exact implementation SHA `56429210af5738114b47a1aa658509ee19a3b440`:

- exact-head checkout: **PASS**
- remediated Treasury Solidity formatting: **PASS**
- Treasury contract build: **PASS**
- focused Treasury qualification suite: **PASS — 9 passed, 0 failed, 0 skipped**
- Treasury canonical authority/config boundary verifier: **PASS**
- Treasury forbidden primitive scan (`tx.origin`, `selfdestruct`, `delegatecall`): **PASS**

The repository's `Solidity Contracts` PR workflow also concluded successfully for the same implementation SHA. Its result is supplementary here; TREASURY-AUDIT-2 completion does not claim Level 3 full-repository qualification.

## Requirements satisfied

- scheduled lifecycle is bounded by the parent budget validity window;
- execution fails closed when the parent budget is not effective;
- execution fails closed when current policy no longer permits the asset/amount;
- router/read-path execution eligibility matches the write path for the hardened conditions;
- replay, authorization, epoch-limit, timing, cancellation-accounting and Vault-release-commitment behaviors have focused regression coverage;
- Treasury-specific exact-SHA Level 1 CI exists and passes.

## Security/adversarial result

No Treasury source matched the forbidden authority/opcode primitives checked by the Level 1 workflow. Focused negative tests passed for unauthorized execution, timing violations, policy revocation, cap violations, invalid release commitment, validity-window escape and cancellation replay.

## Intentionally deferred

These are not blockers for TREASURY-AUDIT-2 and remain assigned to later canonical roadmap steps:

- fuzz/property/invariant expansion and static-analysis closeout — TREASURY-AUDIT-3;
- final Vault release evidence-model reconciliation — TREASURY-AUDIT-4;
- modern Indexer/Explorer/Analytics integration qualification — TREASURY-AUDIT-5;
- deployment/runtime/ProtocolRegistry materialization — TREASURY-AUDIT-6;
- operator/documentation closeout — TREASURY-AUDIT-7;
- production-equivalent live testnet qualification — TREASURY-AUDIT-8;
- external security review and final Genesis/production closeout — TREASURY-AUDIT-9.

## Completion determination

Every TREASURY-AUDIT-2 exit requirement defined by the current canonical remediation roadmap is implemented and directly qualified at Level 1 against the exact implementation SHA above.

**TREASURY-AUDIT-2 is COMPLETE.**

Next canonical roadmap step: **TREASURY-AUDIT-3 — security/property/invariant expansion**.
