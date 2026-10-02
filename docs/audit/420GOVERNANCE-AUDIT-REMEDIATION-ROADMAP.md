# 420Governance audit remediation roadmap

## Authority and delivery rule

This roadmap is the dependency-ordered continuation of the complete repository-grounded 420Governance audit dated 2026-10-01.

The public application remains **420 Governance**. The canonical implementation family remains **420 Civic**. `Governance420` at `0x0000000000000000000000000000000000000437` remains compatibility-only; `GovernanceTimelock` at `0x0000000000000000000000000000000000000429` remains the frozen execution authority.

Repository truth overrides prior conversation. No step may silently redefine governance policy merely to make qualification pass.

Each step must retain exact-head evidence. Ordinary steps use focused qualification for what changed. Broader repository/global qualification is reserved for milestone/phase closeout unless a shared change materially requires it earlier.

## Current audit repairs already staged

The complete audit branch contains two narrow repairs that do not require a new governance decision:

1. `CivicGovernor420` now fails closed unless Constitution, Proposal Registry and Electorate Registry share one GovernanceTimelock and `CivicVoting420` is bound to the exact Proposal/Electorate registries supplied to the Governor.
2. 420Indexer now classifies the five canonical Civic modules under `420Governance`, with a regression test.

These repairs are retained as foundational work for GOV-AUDIT-2 and GOV-AUDIT-4 below. They do not close the later deployment, Wallet, testnet or Genesis gates.

---

## GOV-AUDIT-1 — canonical authority, dependency and cancellation decision

**Status: COMPLETE — implementation SHA `fde6b37d02db1a180a8635aeb037efd7db0d2cc6`; retained exact-head qualification re-established at `28f32c3c090f2b7b1020dafa2ed8a4bb5ee308c7` by 420Governance audit qualification run `36914171425`; evidence: `docs/audit/GOV-AUDIT-1-QUALIFICATION.md`.**

### Purpose
Freeze one internally consistent 420 Governance authority model before further implementation.

### Required work
- Reconcile the generic `420Governance` row in `contracts/config/interfaces/dependency-matrix.json` against the actual Civic runtime dependency graph.
- Classify each shared Genesis interface as direct runtime dependency, indirect deployment dependency, consumer-layer dependency, optional integration, local mechanism, or not applicable.
- Preserve `GovernanceTimelock` as the sole execution/governance mutation authority where current architecture requires it.
- Preserve `Governance420` as compatibility-only.
- Record an ADR for proposal cancellation covering:
  - whether ACTIVE, PASSED and/or QUEUED proposals are cancellable;
  - who may request cancellation;
  - whether cancellation requires a separate Civic proposal, emergency authority, proposer right, constitutional class, or is intentionally unsupported;
  - how `GovernanceTimelock.cancel` and Proposal Registry state remain atomic/consistent;
  - required events and Indexer semantics.
- Do not invent emergency power absent an explicit canonical decision.

### Qualification
- dependency-model verifier;
- authority graph tests;
- negative tests proving no compatibility/alternate authority;
- docs/reference consistency checks.

### Exit
A machine-readable dependency model and architecture decision define one canonical authority/cancellation model with no contradictory execution path.

---

## GOV-AUDIT-2 — Civic contract hardening and lifecycle completion

**Status: COMPLETE — qualified at implementation SHA `28f32c3c090f2b7b1020dafa2ed8a4bb5ee308c7`; evidence: `docs/audit/GOV-AUDIT-2-QUALIFICATION.md`.**

### Purpose
Make the canonical Civic contract family internally complete under the GOV-AUDIT-1 authority model.

### Required work
- Retain the module-graph constructor hardening introduced by the complete audit.
- Implement the GOV-AUDIT-1 cancellation decision if cancellation is supported.
- Ensure cancellation cannot desynchronize `CivicProposalRegistry420` from `GovernanceTimelock`.
- Reject invalid/mixed module graphs, zero/foreign authorities and inconsistent constructor dependencies.
- Verify all legal and illegal proposal state transitions.
- Harden threshold, block/timestamp, value-sum and action-batch boundary behavior.
- Verify one-time authority bindings cannot be replaced.
- Review external-call and reentrancy behavior around atomic execution without adding an undocumented global lock.
- Explicitly document accepted risks of governance-authorized arbitrary target calls.

### Qualification
- focused Foundry build;
- Civic/Governance unit and integration suites;
- negative/adversarial tests;
- fuzz/property tests for quorum/approval arithmetic and lifecycle transitions;
- targeted static/security analysis;
- forbidden primitive scan.

### Exit
Every canonical Civic state transition and authority boundary is implemented and independently tested.

---

## GOV-AUDIT-3 — adversarial, invariant and failure-path qualification

**Status: COMPLETE — qualified at implementation SHA `c2546d382f9296ea72141299693be542fc5d47c2`; evidence: `docs/audit/GOV-AUDIT-3-QUALIFICATION.md`.**

### Purpose
Prove the contract core under hostile and boundary conditions rather than only ordinary paths.

### Required work
Cover at minimum:
- quorum exact-boundary, one-below and full-participation cases;
- approval exact-boundary and decisive-vote edge cases;
- abstain-only/no-decisive-vote behavior;
- dual-house independent pass/fail permutations;
- maximum/large electorate weights and arithmetic overflow resistance;
- duplicate ballot and cross-house behavior;
- source replacement after snapshot;
- malicious/reverting/malformed electorate adapters;
- voting-window boundaries;
- repeated finalization/queue/execution/cancellation attempts;
- action-batch substitution/reordering;
- total-value mismatch;
- one failed action rolling back the complete batch;
- reentrant target behavior and replay resistance;
- timelock timestamp overflow/early execution;
- unauthorized authority activation/scheduling/cancellation;
- legacy `Governance420` selector retirement.

### Qualification
Retain named tests and fuzz/property evidence tied to exact head.

### Exit
No unresolved high-severity contract-core finding remains within the defined Governance scope.

---

## GOV-AUDIT-4 — Indexer, ABI and event-model reconciliation

**Status: COMPLETE — qualified at implementation SHA `4d859e2f0f9f8371aaf2ee7259e414daf17720a2`; evidence: `docs/audit/GOV-AUDIT-4-QUALIFICATION.md`.**

### Purpose
Make canonical Civic activity reconstructable as non-authoritative `420Governance` projection state.

### Required work
- Retain the Civic contract-to-`420Governance` ABI mapping introduced by the complete audit.
- Generate descriptors from the exact qualified Civic artifacts.
- Reconcile lifecycle reducer event names with real emitted Civic events.
- If cancellation is supported, add its canonical event and projection behavior.
- Define proposal object keys and current-state reconstruction.
- Verify reorg rollback/replay and idempotent re-indexing.
- Ensure Indexer never becomes voting/outcome/execution authority.
- Reconcile public API/search/event-subscription schemas.

### Qualification
- Indexer build;
- descriptor/ABI tests;
- lifecycle reducer tests;
- reorg/replay tests;
- query/API tests;
- negative tests for unknown/stale/mismatched artifacts.

### Exit
Canonical Civic events can be deterministically decoded and rebuilt from qualified artifacts and chain history.

---

## GOV-AUDIT-5 — 420 Wallet Governance user application

**Status: COMPLETE — qualified at implementation SHA `2ea64dded4b2ea600adcc8989b6efbfc872a2ae1`; evidence: `docs/audit/GOV-AUDIT-5-QUALIFICATION.md`.**

### Purpose
Satisfy the frozen classification of 420 Governance as a **Genesis protocol and user app**.

### Required work
Implement a Wallet-integrated Governance surface with:
- proposal list and proposal detail;
- proposal class and frozen constitutional revision;
- voting window and current state;
- frozen community/validator electorate information;
- quorum/approval thresholds and live non-authoritative tallies;
- exact committed actions hash;
- decoded action-batch review where ABI metadata permits;
- explicit warning/fail-closed behavior when an action cannot be decoded or does not match the commitment;
- FOR / AGAINST / ABSTAIN vote submission;
- required-house awareness;
- connected-account eligibility/weight preflight;
- chain ID and deployed-code validation;
- canonical Governance/Civic discovery rather than hard-coded invented addresses;
- transaction simulation/gas estimation where supported;
- submitted/confirmed/failed/replaced transaction state;
- account/network-change invalidation;
- safe retry semantics;
- loading, empty and error states;
- accessibility basics and responsive behavior.

Proposal creation/queue/execution controls must be exposed only if the canonical policy says ordinary Wallet users should invoke them; presentation must not manufacture protocol authority.

### Qualification
- Wallet unit/integration tests;
- mocked hostile RPC/chain/account changes;
- ABI/address/version failures;
- transaction recovery tests;
- accessibility/static checks.

### Exit
A user can inspect and vote on canonical Governance state through 420 Wallet without trusting Wallet as governance authority.

---

## GOV-AUDIT-6 — deployment, artifacts, discovery and initialization

**Status: COMPLETE — qualified at implementation SHA `ce294990581aac97fc005ed3400be077eb8bc7a0`; evidence: `docs/audit/GOV-AUDIT-6-QUALIFICATION.md`.**

### Purpose
Turn the source-complete Civic family into a reproducible deployable Genesis candidate.

### Required work
- Pin compiler, optimizer, EVM target and exact source inputs.
- Produce reproducible compiler/runtime artifacts and runtime code hashes for:
  - GovernanceTimelock;
  - Governance420 compatibility surface;
  - CivicConstitution420;
  - CivicProposalRegistry420;
  - CivicElectorateRegistry420;
  - CivicVoting420;
  - CivicGovernor420.
- Define whether each Civic module is fixed-predeploy or Registry-resolved; do not assign a reserved address by implication.
- Define canonical Registry service/component IDs and publication profiles for Registry-resolved modules.
- Define deterministic deployment/initialization order including:
  - Timelock materialization/deployment;
  - Constitution/Proposal/Electorate/Voting/Governor wiring;
  - electorate-source configuration;
  - initial constitutional rules;
  - Proposal/Snapshot authority bindings;
  - `Governance420.bindCivicGovernor`;
  - `GovernanceTimelock.activateCivicAuthority`;
  - Registry publication/discovery.
- Prove bootstrap authority is retired at the intended point.
- Generate storage/init manifests and verify all immutable references.
- Add deployment smoke verification and rollback/recovery instructions.

### Qualification
- artifact reproducibility;
- runtime-code-hash verification;
- deterministic deployment simulation;
- exact constructor/immutable/state verification;
- Registry resolution tests;
- bootstrap-to-Civic authority handoff tests.

### Exit
The complete canonical Governance stack can be reproduced and deployed from a clean checkout with no guessed address, authority or initialization value.

---

## GOV-AUDIT-7 — cross-protocol integration qualification

**Status: COMPLETE — qualified at implementation SHA `f3a46c4ccb51a777b3ac0a6966851aa8a42b0142`; evidence: `docs/audit/GOV-AUDIT-7-QUALIFICATION.md`.**

### Purpose
Verify Governance as one bounded authority inside 420Integrated.

### Required work
Qualify applicable integration with:
- 420Registry discovery/publication;
- 420Stake separation from voting weight;
- 420Treasury/Vault governed-action commitments and custody separation;
- 420Wallet;
- 420Indexer/Search/Explorer;
- 420Notifications where governance events are surfaced;
- other Genesis residents that call GovernanceAuthority or GovernanceTimelock.

Verify:
- canonical IDs/addresses;
- interface compatibility;
- permissions;
- event schemas;
- no circular authority;
- no deprecated compatibility path used as canonical Civic state;
- derived services cannot alter governance outcomes.

### Qualification
Focused cross-component integration and negative tests, including stale/mismatched Registry and projection state.

### Exit
Every required Governance dependency and consumer has a tested, documented authority boundary.

---

## GOV-AUDIT-8 — documentation, operator, threat-model and phase closeout

### Purpose
Make the repository sufficient for a new developer/operator to build, test, deploy, operate and recover Governance.

### Required work
Complete/reconcile:
- app README/index;
- architecture/component map;
- contract/API/event/state-machine documentation;
- roles and permissions;
- canonical Registry IDs and addresses;
- configuration/environment reference;
- build/test instructions;
- deployment/initialization instructions;
- upgrade/migration policy;
- operator runbook;
- troubleshooting/recovery;
- integration guide;
- user guide;
- security assumptions and threat model;
- known limitations;
- qualification/evidence ledger.

Perform Level-2/phase closeout qualification against the exact reconciled head.

### Exit
Documentation and evidence describe the implementation that actually exists at the qualified SHA.

---

## GOV-AUDIT-9 — production-equivalent testnet deployment qualification

### Purpose
Collect live evidence that repository-qualified Governance works on the approved testnet candidate.

### Required work
Retain durable evidence for:
- chain ID/network/genesis identity;
- exact deployed code and runtime hashes;
- constructor/immutable/storage bindings;
- GovernanceTimelock authority state;
- Civic module graph;
- Registry discovery;
- compatibility `Governance420` pointer;
- bootstrap retirement/Civic activation;
- initial rules and electorate sources;
- Wallet proposal/vote workflow;
- Indexer/Search reconstruction;
- proposal create/vote/finalize/queue/execute lifecycle on testnet;
- cancellation lifecycle if supported;
- restart/replay/reorg behavior for derived services.

### Exit
All production-equivalent testnet checks pass against the exact deployed release candidate. Repository-only simulation cannot satisfy this step.

---

## GOV-AUDIT-10 — Genesis candidate and production closeout

### Purpose
Make the final release-stage decision without conflating code completeness, testnet readiness, Genesis readiness and production readiness.

### Required work
- reconcile GOV-AUDIT-1 through GOV-AUDIT-9 evidence;
- run the broader final application-phase qualification once on the exact candidate SHA;
- verify no uncommitted/generated drift;
- bind all evidence to exact source/artifact/deployment SHAs;
- confirm production configuration, monitoring, incident response and recovery;
- publish explicit remaining blockers or release acceptance.

### Exit
The final closeout reports independently:
- CODE COMPLETE;
- BUILD COMPLETE;
- CONTRACT COMPLETE;
- TEST COMPLETE;
- DOCUMENTATION COMPLETE;
- INTEGRATION COMPLETE;
- SECURITY QUALIFIED;
- TESTNET READY;
- GENESIS READY;
- PRODUCTION READY.

No state is inferred from another.
