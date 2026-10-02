# 420Grants audit remediation roadmap

## Authority rule

Repository truth overrides conversational memory. 420Grants is a **Genesis implementation protocol**, not a separately frozen public standalone Genesis application. Its canonical responsibility is governed grant workflow state; Civic/GovernanceTimelock owns governance authorization, 420Treasury owns budget/disbursement controls, 420Vault owns custody/release, CapabilityRegistry420 owns delegated capability authority, and Registry-resolved clients are replaceable presentation/transaction surfaces.

No roadmap step may manufacture custody, bypass Treasury policy, invent a fixed Grants predeploy, or promote repository simulation as live deployment evidence.

## GRANTS-AUDIT-1 — canonical definition, inventory and authority graph

**Status: COMPLETE**

- reconciled architecture, Genesis map, Wallet inventory, Registry/address namespace, historical PR and contract inventory;
- classified frontend/backend/indexer/client surfaces as required, optional, shared or not applicable;
- preserved grants-router as REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS;
- recorded the seven-contract canonical suite and four core upstream authorities;
- Level 1 exact-head qualification **PASS** on implementation SHA `02244b26b699557c8c42600c635b38b276249183`;
- 420Grants Audit Qualification run `37055267365`: contract-core job `110998596847` PASS and grants-security job `110998596514` PASS;
- affected shared Solidity Contracts run `37055267238` PASS on the same implementation SHA;
- durable evidence: `docs/audit/420GRANTS-AUDIT-1-QUALIFICATION.md`, introduced by evidence commit `a31b4c29ab27bbba4a19c587879929470eac2b8b`.

Level 2 is not triggered by this definition/inventory step. Level 3 remains deferred to GRANTS-AUDIT-8.

## GRANTS-AUDIT-2 — contract consistency and lifecycle remediation

**Status: COMPLETE**

- eliminated divergent program-award accounting by making GrantProgramRegistry420.awarded authoritative;
- bound exactly one GrantAwardRegistry420 as the only award-cap reservation controller;
- rejected new awards for inactive programs;
- required ACTIVE parent award state at milestone approval;
- prevented one Treasury disbursement from funding multiple milestones;
- permitted release of an approved milestone/disbursement binding only after canonical Treasury cancellation;
- prevented cancellation from hiding an already executed Treasury payment;
- Level 1 exact-head qualification **PASS** on implementation SHA `02244b26b699557c8c42600c635b38b276249183`;
- 420Grants Audit Qualification run `37055267365`: contract-core job `110998596847` PASS and grants-security job `110998596514` PASS;
- affected shared Solidity Contracts run `37055267238` PASS on the same implementation SHA;
- later GRANTS-AUDIT-1 bookkeeping changed documentation only, so exact-SHA qualification remained authoritative without redundant rerun;
- durable evidence: `docs/audit/420GRANTS-AUDIT-2-QUALIFICATION.md`, introduced by evidence commit `c5e8fa11e671c837291bb99db3fc1818d55be019`.

Level 2 is not triggered by this lifecycle-remediation step alone. Level 3 remains deferred to GRANTS-AUDIT-8.

## GRANTS-AUDIT-3 — adversarial, replay and invariant qualification

**Status: COMPLETE**

- qualified application replay resistance and application-nonce replay rejection with altered content;
- proved application delegation is default-deny and program-scope bounded;
- qualified program-cap, per-award-cap and cumulative application-award boundaries;
- rejected direct program-cap reservation outside the bound Award Registry controller;
- rejected new awards after program deactivation;
- qualified milestone aggregate caps, ordinal replay rejection and safe cancelled-capacity replacement;
- rejected Treasury budget, recipient, amount, Civic-action, purpose and state mismatches without mutating binding/state;
- rejected duplicate Treasury-disbursement binding across milestones;
- rejected approval after parent-award cancellation;
- rejected PAID finalization before Treasury execution and without nonzero Vault release commitment;
- rejected milestone cancellation after Treasury execution;
- proved milestone delegation is default-deny and award-scope/action bounded;
- dangerous Solidity primitive scan and targeted Slither high-severity gate PASS;
- Level 1 exact-head qualification **PASS** on implementation SHA `ab6d245a193ac2e9d0369d2279090de276d9fc57`;
- 420Grants Audit Qualification run `37059922255` / #24: contract-core job `111014056705` PASS and grants-security job `111014056888` PASS;
- affected shared Solidity Contracts run `37059921662` / #4236 PASS on the same implementation SHA;
- durable evidence: `docs/audit/420GRANTS-AUDIT-3-QUALIFICATION.md`, introduced by evidence commit `09938328fde916d6c6caf84c299b7c9e04426df2`.

Level 2 is not triggered by this adversarial/invariant step alone. Complete repository exact-final-head closeout remains deferred to GRANTS-AUDIT-8.

## GRANTS-AUDIT-4 — Civic/Treasury/Vault/capability integration reconciliation

**Status: COMPLETE**

- mechanically reconciled the Grants-local Treasury enum and Disbursement struct against canonical TreasuryDisbursementRegistry420;
- verified exact SCHEDULED Treasury budget/recipient/amount/Civic-action/purpose binding at milestone approval;
- preserved EXECUTED + nonzero vaultReleaseHash as the only Grants PAID completion evidence;
- verified Grants contains no custody/transfer path and remains entitlement/workflow state only;
- verified SystemAccess binds governed Grants mutations exclusively to GovernanceTimelock;
- added non-timelock negative mutation regressions across Program/Award/Milestone registries;
- verified CapabilityRegistry calls remain fixed-component, action-specific and program/award object-scope bounded;
- added wrong-program-scope and wrong-action application-delegation regressions while retaining award-scope milestone negatives;
- Level 1 exact-head qualification **PASS** on implementation SHA `7973f0d7f75209d48531f02e00f6ca31d3e7a73b`;
- 420Grants Audit Qualification run `37065796100` / #30: grants-contract-core job `111033535620` PASS and grants-security job `111033535266` PASS;
- affected Solidity Contracts workflow run `37065796096` / #4284 completed SUCCESS on the same SHA, with its classifier correctly skipping repository-wide Foundry inventory for this app-scoped change;
- durable evidence: `docs/audit/420GRANTS-AUDIT-4-QUALIFICATION.md`, introduced by evidence commit `57d972dddbc14bf768804b6e58b8bf672c92244e`.

Level 2 is not triggered by this reconciliation-only step because no new shared implementation dependency, authority model or cross-component runtime semantics were introduced. Level 3 remains deferred to GRANTS-AUDIT-8.

## GRANTS-AUDIT-5 — Registry, address and deployment model

**Status: COMPLETE**

- preserved GrantRouter420 as `REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS` with no invented fixed predeploy or CREATE2 address;
- preserved frozen GovernanceTimelock `0x0000000000000000000000000000000000000429` and ProtocolRegistry `0x0000000000000000000000000000000000000434`;
- retained CapabilityRegistry420 candidate status without promoting it to live deployment evidence;
- added `contracts/config/grants/grants-audit-5-release-materialization.json` with deterministic deployment order, constructor graph, one-time Award Registry binding, exact artifact inventory, Registry publication descriptor and explicit repository/live evidence boundary;
- linked the Grants Genesis config to the release materialization;
- added `contracts/test/GrantsDeploymentBinding420.t.sol` using real ProtocolRegistry, CapabilityRegistry420, TreasuryDisbursementRegistry420 and the complete Grants deployment graph;
- proved exact constructor/dependency bindings, one-time Award Registry binding, canonical `420/service/grants/v1` publication, active resolution to the exact GrantRouter420, Registry EXTCODEHASH identity and wrong-router visibility;
- retained exact compiled artifact SHA-256, compiler runtime-template SHA-256 and local deployed runtime code hashes for all six deployable Grants contracts;
- retained dependency-root, manifest and interface commitments;
- added `scripts/verify-grants-audit-5-release.py` to fail closed on namespace/address/deployment/publication drift or fabricated live evidence;
- extended Grants CI to qualify the release package and retain artifact/runtime identities;
- Level 1 exact-head qualification **PASS** on implementation SHA `19c8a7875525b0e363c3a537d5de8e03a8182386`;
- 420Grants Audit Qualification run `37069334943` / #42: grants-contract-core job `111045205831` PASS and grants-security job `111045206014` PASS;
- affected Solidity Contracts workflow run `37069334633` / #4303 completed SUCCESS on the same SHA under app-scoped classification;
- durable evidence: `docs/audit/420GRANTS-AUDIT-5-QUALIFICATION.md`, introduced by evidence commit `1b8c26941227c6ee9696a0e4d531f7c3e55d3953`.

Production-equivalent chain/genesis identity, deployed addresses/runtime hashes, constructor-binding receipts and live ProtocolRegistry transactions remain explicitly testnet-gated to GRANTS-AUDIT-9 and are not blockers for repository completion of this step.

Level 2 is not separately triggered because the real Registry/Capability/Treasury deployment graph is exercised directly in Level 1 together with retained Grants lifecycle/security qualification. Level 3 remains deferred to GRANTS-AUDIT-8.

## GRANTS-AUDIT-6 — client/indexer/user-flow integration

**Status: PARTIAL**

420Grants is not a standalone frozen public Genesis application. A separate Grants website is therefore **not** required by current canonical Genesis scope.

Repository-required integration is:
- discoverable Grants service/component metadata;
- Wallet/catalog awareness;
- event/indexer compatibility sufficient for ecosystem clients to reconstruct non-authoritative program/application/award/milestone views;
- transaction handoff that preserves Wallet/Smart Account authority.

A dedicated Grants-specific Wallet workflow is not currently defined as a canonical Genesis acceptance requirement. If later adopted, it must be added as a new explicit roadmap requirement rather than inferred retroactively.

## GRANTS-AUDIT-7 — documentation, threat model and operator guidance

**Status: IMPLEMENTED — pending exact-head qualification**

- canonical architecture remains docs/architecture/protocols/stake-governance-treasury-grants.md;
- audit report and this remediation roadmap record actual repository state;
- Genesis config records deployment order, address model and security invariants;
- known testnet/live blockers remain explicit.

## GRANTS-AUDIT-8 — exact-head repository qualification and durable evidence

**Status: IN PROGRESS**

Required exact-head gates:
- python3 scripts/verify-grants-audit.py;
- forge fmt --check src/grants test/GrantsGenesis420.t.sol;
- forge build src/grants --force --sizes;
- forge test --match-path test/GrantsGenesis420.t.sol -vvv under CI profile;
- same retained suite under hardening profile;
- broader affected repository CI required by the PR;
- no unresolved failed/cancelled required checks;
- clean branch divergence/evidence tied to one exact SHA.

Do not mark COMPLETE until these gates are green against the exact final bookkeeping head.

## GRANTS-AUDIT-9 — production-equivalent testnet qualification

**Status: BLOCKED — official production-equivalent testnet required**

Collect durable live evidence for chain/genesis identity; deployed Grants addresses/runtime hashes; constructor/immutable bindings; one-time Award Registry controller binding; Registry publication/discovery; live CapabilityRegistry delegation; a complete program-to-PAID Treasury/Vault flow; rejection of duplicate Treasury-disbursement reuse; client/indexer reconstruction; and restart/reorg/RPC-disagreement behavior.

Local Anvil, mocks and CI cannot close this step.

## GRANTS-AUDIT-10 — Genesis candidate / production closeout

**Status: BLOCKED on GRANTS-AUDIT-9 and whole-system Genesis gates**

Reconcile all prior evidence and separately report CODE, BUILD, CONTRACT, TEST, DOCUMENTATION, INTEGRATION, SECURITY, TESTNET, GENESIS and PRODUCTION readiness. No readiness state is inferred from another.
