# 420Stake STAKE-AUDIT-3 qualification evidence

## Step

**STAKE-AUDIT-3 — Stake contract/indexer replay and ABI hardening.**

Canonical requirement:

> Duplicate slash evidence, reward replay/block/participant guards, slash resulting-status event, current public interfaces and canonical Indexer lifecycle rules.

## Completion state

**COMPLETE**

Qualified implementation SHA:

`7ad103e9d4fab91ec1fac8572d53a0b35bc914e2`

Qualification model:

- Level 1: **PASS**
- Level 2 app integration milestone: **PASS**
- Level 3 complete app-phase closeout: **intentionally deferred**

## Repository state at qualification

- repository: `abvhiael/420-integrated-v0.1`
- audit branch: `feature/420stake-audit-remediation`
- PR: #443
- implementation SHA: `7ad103e9d4fab91ec1fac8572d53a0b35bc914e2`
- current `main` observed at closeout: `e8d9096c4029c3c0218113afc1cbd3b8d0005878`
- retained merge base: `cbff831984df5d57540a26c879663cf95bcf61c9`
- branch divergence at closeout: 44 commits ahead / 24 commits behind current `main`

Current-main-only changes were checked for relevant Stake/validator/reward/Indexer/consensus overlap. No current-main-only file conflicts with the STAKE-AUDIT-3 implementation were identified. Full reconciliation with then-current `main` remains reserved for Level 3 app-phase closeout.

## Gap analysis and implementation

The original audit branch had already implemented the core STAKE-AUDIT-3 fixes before this step was formally qualified. This closeout preserved that valid work and closed the remaining qualification gaps.

### Duplicate slash evidence

`ValidatorRegistry` now:

- stores `slashEvidenceApplied[evidenceHash]`;
- rejects zero evidence;
- rejects already-applied evidence before collateral mutation;
- records evidence before slash state/value effects;
- exposes replay status through the public ABI.

Retained tests prove a duplicate finalized evidence hash cannot:

- change owned collateral;
- change protocol-credit collateral;
- increase total slash accounting;
- move additional owned collateral to ProtocolReserve;
- recycle protocol credit twice.

This closeout also added explicit zero-evidence/no-mutation coverage.

### Reward replay and execution-block binding

`RewardController` now:

- requires the reward block number to equal the current execution block;
- records `rewardApplied[blockNumber]`;
- rejects duplicate reward application for an already-settled block;
- records the replay marker before accounting mutation.

Retained tests prove:

- a reward applies once to the intended execution block;
- a replay cannot increase issuance/account balances;
- a wrong execution block fails and does not mark the reward applied.

### Reward participant guards

`RewardController` now rejects:

- zero proposer;
- zero participant;
- proposer repeated in the participant list;
- duplicate participants;
- participant sets whose proposer + participants exceed the 30-validator bounded-phase maximum.

This closeout added direct negative tests for every one of those malformed participant cases and verifies rejected calls do not change Security/Attention/Development issuance totals.

### Slash resulting-status event

Canonical `SlashApplied` includes:

`SlashApplied(validatorId, offense, correlationTier, ownedSlashed, creditSlashed, evidenceHash, resultingStatus)`

The resulting lifecycle status is emitted directly by the execution authority so derived consumers do not infer a post-slash state from unrelated data.

### Current public ABI interfaces

`IValidatorRegistry.sol` and `IRewardController.sol` were reconciled with the live canonical contracts.

This closeout additionally made the ValidatorRegistry interface explicitly expose the consensus-owned canonical mutation ABI:

- `applyExitNotice`;
- `applyConsensusState`;
- `applySlash`;
- `applyRotationSnapshot`.

The interface remains descriptive ABI surface only; the implementation still restricts those methods to the immutable consensus-system caller.

`IRewardController` exposes current replay/accounting reads and `applyConsensusReward`.

### Canonical Indexer lifecycle rules

The 420Indexer lifecycle reducer now consumes real ValidatorRegistry events:

- `ValidatorRegistered`;
- `ConsensusStateApplied`, using `newStatus`;
- `ExitNoticeApplied`;
- `SlashApplied`, using `resultingStatus`;
- `ValidatorBondWithdrawn`.

Obsolete synthetic events such as `StakeCreated`, `StakeActivated`, `UnstakeRequested`, `StakeWithdrawn` and `StakeSlashed` are not treated as canonical Stake lifecycle authority.

Retained tests prove:

- canonical lifecycle events reconstruct validator state;
- a slash maps the emitted resulting status without inventing terminality;
- obsolete synthetic events do not fabricate lifecycle state.

## Files materially involved

Previously implemented on the audit branch:

- `contracts/src/system/ValidatorRegistry.sol`
- `contracts/src/system/RewardController.sol`
- `contracts/src/IValidatorRegistry.sol`
- `contracts/src/IRewardController.sol`
- `contracts/test/StakeValidatorGenesis420.t.sol`
- `420-indexer/src/lifecycle-reducer.ts`
- `420-indexer/test/lifecycle-reducer.test.ts`
- `docs/apps/stake/developer/events.md`
- `docs/apps/stake/developer/errors.md`

Additional closeout changes for this step:

- `contracts/src/IValidatorRegistry.sol`
- `contracts/test/StakeValidatorGenesis420.t.sol`
- `scripts/verify-stake-audit-3-hardening.py`
- `.github/workflows/stake-audit-3.yml`

## Level 1 qualification

Dedicated workflow:

- workflow: **420Stake STAKE-AUDIT-3**
- run: **#1**
- run ID: `36885398670`
- job: `level-1`
- job ID: `110447307911`
- exact implementation SHA: `7ad103e9d4fab91ec1fac8572d53a0b35bc914e2`
- result: **PASS**

Passed checks:

- exact-head checkout and SHA verification;
- `python scripts/verify-stake-audit-3-hardening.py`;
- compile of ValidatorRegistry, RewardController and both public interfaces;
- `forge test --match-path 'test/StakeValidatorGenesis420.t.sol' -vvv`;
- TypeScript 420Indexer build;
- focused `lifecycle-reducer.test.js` execution.

These checks directly qualify replay, block-binding, participant validation, no-mutation failure paths, ABI surface reconciliation and canonical Indexer lifecycle behavior.

## Level 2 app integration milestone

STAKE-AUDIT-3 is treated as a meaningful app-specific integration milestone because contract replay semantics, public ABI compatibility and the derived Indexer lifecycle projection converge at this step.

Dedicated workflow:

- workflow: **420Stake STAKE-AUDIT-3**
- run: **#1**
- run ID: `36885398670`
- job: `level-2-stake-contract-indexer-integration`
- job ID: `110447308280`
- exact implementation SHA: `7ad103e9d4fab91ec1fac8572d53a0b35bc914e2`
- result: **PASS**

Passed retained integration checks:

- full TypeScript `420-indexer` test suite;
- retained `ConsensusSystemCall420.t.sol` gateway regression;
- retained `StakeSystemCallABIVectors420.t.sol` cross-language ABI-vector regression.

## Supplementary automatically-triggered evidence

On the same implementation SHA:

- **420Indexer** run `36885398407`: **PASS**;
- **420Indexer** run `36885398664`: **PASS**;
- **420 Integrated Qualification** run `36885398432`: **PASS**;
- **420Stake STAKE-AUDIT-1** run `36885398168`: **PASS**;
- **420Docs Qualification** run `36885398189`: **PASS**;
- **Genesis Address Authority** run `36885398285`: **PASS**;
- Wallet and applicable collateral checks observed during qualification: **PASS**.

Other repository workflows that were still running at evidence-write time were not required STAKE-AUDIT-3 gates and are not claimed here as completed evidence.

## Exit-criterion reconciliation

| Canonical requirement | Evidence | Result |
| --- | --- | --- |
| duplicate slash evidence rejected | contract guard + replay test | PASS |
| zero slash evidence rejected | contract guard + no-mutation test | PASS |
| reward replay rejected | `rewardApplied` + replay test | PASS |
| reward bound to execution block | block equality guard + wrong-block test | PASS |
| zero proposer rejected | direct negative test | PASS |
| zero participant rejected | direct negative test | PASS |
| proposer-as-participant rejected | direct negative test | PASS |
| duplicate participant rejected | direct negative test | PASS |
| participant set bounded to phase maximum | direct oversized-set test | PASS |
| rejected reward calls do not change issuance | explicit accounting assertions | PASS |
| slash event carries resulting status | canonical event declaration + docs + Indexer consumer | PASS |
| ValidatorRegistry public ABI current | compile + verifier + canonical mutation signatures | PASS |
| RewardController public ABI current | compile + verifier | PASS |
| Indexer uses canonical ValidatorRegistry events | reducer + tests | PASS |
| Indexer maps consensus/slash status fields | reducer + tests | PASS |
| obsolete synthetic Stake events ignored | reducer negative test | PASS |
| affected contract/indexer integration preserved | Level 2 retained suites | PASS |

Every original STAKE-AUDIT-3 step-specific exit criterion is satisfied.

## Level 3 intentionally deferred

The following remain intentionally deferred to their later roadmap owner or final 420Stake app-phase closeout:

- reconciliation/merge with then-current `main`;
- complete repository Solidity/Genesis inventory on the final merge candidate;
- final Geth/Engine/fault/soak qualification on the final merge candidate;
- full security/property/invariant closeout;
- generated predeploy/runtime/storage materialization;
- Explorer/SDK release completeness;
- user-facing 420Stake application;
- live production-equivalent testnet deployment;
- operational recovery/observability closeout;
- external security review and final Genesis readiness.

Automatically-triggered broad checks on this SHA are supplementary and do not replace the future exact Level 3 closeout.

## Known limitations / non-claims

STAKE-AUDIT-3 does not claim completion of:

- STAKE-AUDIT-4 invariant/security hardening;
- STAKE-AUDIT-5 user-facing application;
- STAKE-AUDIT-6 Explorer/SDK completeness;
- STAKE-AUDIT-7 predeploy materialization;
- testnet deployment or external audit.

## Next canonical roadmap step

**STAKE-AUDIT-4 — Security/property/invariant expansion.** Add focused fuzz/property/invariant suites for custody conservation, reserve accounting, transition graph, slash evidence uniqueness, reward at-most-once, bounded participants, external-call rollback and system-call atomicity; close `Validator_Stake` and `Rewards_Treasuries` hardening gates.
