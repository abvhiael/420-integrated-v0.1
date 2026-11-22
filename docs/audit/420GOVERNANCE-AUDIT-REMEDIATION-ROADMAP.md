# 420Governance audit remediation roadmap

## Authority and delivery rule

This roadmap is the dependency-ordered continuation of the complete repository-grounded 420Governance audit dated 2026-10-01.

The public application remains **420 Governance**. The canonical implementation family remains **420 Civic**. `Governance420` at `0x0000000000000000000000000000000000000437` remains compatibility-only; `GovernanceTimelock` at `0x0000000000000000000000000000000000000429` remains the frozen execution authority.

Repository truth overrides prior conversation. No step may silently redefine governance policy merely to make qualification pass.

Each step must retain exact-head evidence. Ordinary steps use focused qualification for what changed. Broader repository/global qualification is reserved for milestone/phase closeout unless a shared change materially requires it earlier.

## Supplemental founding Genesis accounting — GOV-PRE-01

**Status: CANONICAL 42M CANDIDATE POLICY AND SUPPLY RECONCILIATION QUALIFIED, NOT LIVE GENESIS RELEASE.** [Retained GOV-PRE-01 qualification](GOV-PRE-01-QUALIFICATION.md) and [focused exact-head CI](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44971227517).

The existing 8.6M ProtocolReserve at 0x0424 remains the single on-ledger Genesis source for non-additive 4.2M Founding Operations and 840K Contingency earmarks, leaving 3.56M unearmarked. The founder, validator-credit, Community Reward, public distribution, Attention, Development and validator bootstrap allocations stay within exactly 42M supply. Dedicated Python/Go validators reject duplicate issuances and false Vault funding. No frozen predeploy address, V3 ceremony output, emission schedule or existing allocation was silently changed.

This qualification covers modeled source attribution only. Actual Treasury Vault funding, founder wallet proofs, signed Genesis V4 and on-chain release remain blocked by their distinct approvals and technical workstreams. GOV-AUDIT-9 and GOV-AUDIT-10 remain separate, unstarted release milestones; GOV-PRE-02 (founder wallet enrollment) is the next *founding* workstream, not a claim of audited deployment.

---

## Supplemental founding wallet and Treasury preparation — GOV-PRE-02 / GOV-PRE-03

**GOV-PRE-02 status:** founder-wallet enrollment, proof verification and claim infrastructure merged to `main` in PR #1317, but the real three independently controlled wallet identities, signed V4 and three finalized claims are deliberately **deferred to testnet**. These pending inputs do not grant Treasury authority.

**GOV-PRE-03 status: FINANCIAL-AUTHORITY CODE AND GENUINE LOCAL SETTLEMENT QUALIFIED; LIVE FUNDING / DEPLOYMENT REMAINS BLOCKED.** [Retained GOV-PRE-03 qualification](GOV-PRE-03-QUALIFICATION.md) and [founding Treasury exact-head run #44974695911](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44974695911), **18/18 focused Foundry tests passed** on implementation source `6b38a248a61cc542754d0772af3dc493658f53d4`.

GOV-PRE-03 enforces the three approved native $420 authority levels, 48-hour public evidence notice, 105K routine amount/recipient, 420K exceptional payment, 210K aggregate case/incident, 840K Operations and 420K Contingency rolling caps. The noncustodial founding controller may select only one independently reviewed, Genesis-configurator-bound executable codehash. Both exact Treasury and Vault capability grants are required, and a founding Treasury record cannot be marked settled outside the exact active approved Vault release; genuinely executed local transfers update both registries and cannot replay. Additional audited checks reject unauthorized direct Civic budget scheduling or fragmenting one case across recipients. No frozen system addresses, emission schedule, Genesis tokens or reserved beneficiaries were modified.

The testnet acceptance requirements still include independently controlled founder wallets and on-chain claims, approved Genesis V4, deployed exact runtime and authorized payout executor, actually funded Operations/Contingency Vaults, capability grants, actual canonical destination transfers and independently reconciled receipts. No local Foundry test substitutes for these external release proofs. This preparatory step does **not** complete GOV-AUDIT-9 or GOV-AUDIT-10. The following separate founding task, **GOV-PRE-04**, is now implemented and locally qualified below; the real testnet release remains gated.

---


## GOV-PRE-04 — full-credit validator identity and native community-reward settlement

**Status: CODE-QUALIFIED LOCAL CONSENSUS / EXECUTION / INDEXER CANDIDATE; LIVE GENESIS AND TESTNET SETTLEMENT UNQUALIFIED.** [Retained GOV-PRE-04 qualification](GOV-PRE-04-QUALIFICATION.md) binds the source changes and focused proof runs. Previous accepted GOV-PRE-01 through GOV-PRE-03 financial, wallet and reserved-address policy remains unchanged, with real founder identities expressly deferred to testnet.

- ValidatorRegistry permits exactly 42K self-funded, 21K personal / 21K protocol matched, and separately authenticated 42K fully protocol-owned initial bonds. Matching and sponsorship draw one CommunityValidatorReserve 6.3M pool; the fixed 0x0425 reserve owns and recovers principal, including replacement and permitted slash/exit. No extra Genesis issuance or 2K/40K arbitrary mix is allowed.
- Full founding 42K sponsorship requires a real claimed founding Administrator wallet, canonical active 420Identity beneficiary/issuer-trusted VERIFIED economic-owner credential, one-time immutable reserve sponsorship binding, unique validator/beneficiary/economic-owner group and chain/contract/validator/beneficiary/purpose-bound 42K authorization. False aliases sharing an identity group and unsupported old three-argument sponsor selector fail closed.
- Geth's native node420 system-call processor independently validates the frozen reward schedule and consensus-endorsed, exact ABI/payload/identity/block before issuing *only the realized rewards* into RewardController. The same block immediately delivers a 90% operator / 10% 0x0426 CommunityRewardReserve share for full-sponsor-origin validators **until all remaining protocol credit is repaid**, plus actual ordinary validator, Attention and Development payouts. A separate manual funding or double-settlement route is forbidden. Existing forced native balance cannot inflate rewards or deny consensus.
- The consensus/Indexer reconciliation now requires canonical native reward payout logs and source/recipient/actual-balance equality, pinned Geth state getters, reward-supply conservation, exact validator accrual net-versus-gross and explicit community backing/settlement equality. The retained V3 ABI files and full Stake Audit-6 verifier bind exact candidate source blob identities; frozen historical V2 archives remain intact.
- **Scoped evidence:** [Founding validator #44979206601](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44979206601) passed the 28-Test Solidity positive/adversarial lifecycle; [Go native accounting #44979206327](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44979206327) passed certified issuance/consensus/accounting/Indexer API regressions; [Stake Audit-6 #44979206629](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44979206629) passed retained source/ABI, Indexer descriptor/Explorer/SDK verification; and [node420 release gate #44982950603](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44982950603) passed pinned upstream Geth, recovery and consensus build; **[real native Geth payout #44982950548](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44982950548) passed actual state-backed 90% sponsored operator and 10% 0x0426 Community native payouts, exact supply increase, five native movement events and authenticated system-call archive, with pre-existing forced native balance remaining inert.**
- **Release blockers:** 3 real independently verified founder wallets/claims (deferred to testnet), independently attested real 420Identity sponsorship owner groups, approved signed Genesis V4, exact new validator/reward predeploy runtime/storage, actual collateral and native-reward funding/deployment, final canonical testnet reward receipts and supply/reorg/Indexer reconstruction, and independent security/governance qualification. Neither an all-green local suite nor a GitHub merge proves live payment or unlocks Genesis.

GOV-PRE-04 completes local code/qualification delivery **only**, not GOV-AUDIT-9 production-equivalent testnet qualification or GOV-AUDIT-10 final Genesis/production closeout. The subsequent founding workstream GOV-PRE-05 is recorded below; the existing next actual release stage remains **GOV-AUDIT-9**.

---


## GOV-PRE-05 — founder vesting and developer compensation remain distinct

**Status: LOCAL CONTRACT AND 42M GENESIS DISTRIBUTION CODE QUALIFIED; THREE REAL FOUNDER WALLETS, SIGNED V4 AND LIVE FUNDING/DEPLOYMENT NOT QUALIFIED.** [Retained GOV-PRE-05 qualification](GOV-PRE-05-QUALIFICATION.md), [27/27 exact-head Foundry lifecycle/revenue tests #44991438877](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44991438877), [vesting suite #44991438933](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44991438933), [canonical 42M supply #44991439028](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44991439028) and [repaired existing Vault core/hardening/Slither #44991438871](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44991438871) all **SUCCESS** at source head `191fc3952b2b619107b8c0dee80c02b44e9b1093`, with zero high-severity Slither findings. The independent founder wallet enrollment suite [#44991439005](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44991439005) had not yet concluded when this evidence was captured. The Vault audit repaired formatting and excluded unrelated LayerZero fixture imports by byte-preserving dependency isolation, without weakening old security gates.

- **Genesis:** Exactly **1,000,000 $420** founder allocation within the existing **42,000,000** supply, with **500,000** at immutable FounderVestingRegistry predeploy **0x0427** (Administrator 250,000; Andrew 125,000; Janet 125,000), released in **13** irrevocable cumulative steps **14 days apart** over **182 days**. The other **500,000** must be liquid and funded **directly at Genesis** to those *same three verified wallets*, respectively 250,000/125,000/125,000. No added Genesis grant, owner substitution, early withdrawal, double claim, runtime third-party revenue deposit or 14th installment. The strict release checker now also requires authenticated on-chain block-zero account balances and independently verified founder signatures.
- **Ongoing application revenue (entirely separate):** The existing, capability-gated DevelopmentCompensationVault420 must be **deployed with an immutable beneficiary equal to the new FoundingDeveloperCompensationSplitter420**. A one-shot authorized deployment handshake binds the authentic Vault to the splitter, after which the three founder payees cannot be changed. Only exact authenticated native Vault revenue and atomic ERC-20 Vault transfer + real receipt acknowledgments accumulate eligible **50%/25%/25%** compensation. Pull claims are asset-isolated, cumulative and double-claim-resistant; arbitrary direct/forced native and token transfers, including misrouted Genesis funds, never become compensation.
- **Actually implemented:** `contracts/src/system/FounderVestingRegistry.sol`, `contracts/src/revenue/FoundingDeveloperCompensationSplitter420.sol`, `contracts/src/revenue/DevelopmentCompensationVault420.sol`, affected vesting, founder and Vault tests; fail-closed V4 deployment intent `scripts/prepare-founder-financial-deployment.py`, signed-Genesis/live block-zero funding verification, focused CI, and developer release documentation. No frozen system address, token supply, validator reward emission or independent Treasury authority changed.
- **Verified blockers (never bypassed):** all three founder wallet slots and signature records are still `NULL/UNCLAIMED`; the existing Genesis commitment is `FROZEN_V3`, not an approved V4; 0x0427 has no proven deployment or actual network funding; direct liquid Genesis balances are unverified; the DevelopmentCompensationVault and splitter lack actual canonical finalized deployment and bound-codehash receipts; actual native/ERC20 revenue forwarding and signed founder claims remain external testnet requirements. The test-only 500K vesting balance and Vault payment simulations do not count as Genesis/Testnet transactions.

**GOV-PRE-05 local implementation/qualification exit satisfied; live Genesis V4 and actual compensation settlement intentionally fail closed.** The next pre-existing canonical release stage is **GOV-AUDIT-9 — production-equivalent testnet deployment qualification**. Do not begin it here.

---

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

**Status: COMPLETE — qualified at implementation/closeout SHA `330388bbd0c819e2ac331f060da856de5bf12e80`; final repository Level 3 phase-closeout evidence: `docs/audit/GOV-AUDIT-8-QUALIFICATION.md`.**

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
