# 420Governance complete repository-grounded audit — 2026-10-01

## Audit basis

Repository: `abvhiael/420-integrated-v0.1`  
Authoritative baseline: `main` at `e8d9096c4029c3c0218113afc1cbd3b8d0005878`  
Audit branch: `audit/420governance-complete-20261001`

This audit treats repository state, frozen Genesis records, architecture, tests and qualification evidence as authoritative. The audit request contained stale 420Registry/420Stake copy text; those references are interpreted as 420Governance only where the surrounding section clearly describes the audited application.

## Canonical application definition

420 Governance is the public Genesis application. Its canonical production implementation is the 420 Civic contract family:

- `CivicConstitution420`
- `CivicProposalRegistry420`
- `CivicElectorateRegistry420`
- `CivicVoting420`
- `CivicGovernor420`
- `GovernanceTimelock`

`Governance420` at frozen address `0x0000000000000000000000000000000000000437` is compatibility-only. It must not become a second proposal, voting or execution authority. `GovernanceTimelock` is frozen at `0x0000000000000000000000000000000000000429`.

The canonical trust model is frozen-rule, frozen-electorate governance: each proposal commits metadata and an exact action batch, freezes the applicable constitutional revision and electorate snapshot, accepts one immutable ballot per voter/house, finalizes deterministic quorum/approval results, then executes only the committed action batch through the timelock.

## Canonical sources reviewed

- `config/genesis-applications.json`
- `contracts/config/genesis-dapp-contract-map.json`
- `contracts/config/system-addresses.json`
- `contracts/config/genesis-address-namespace.json`
- `contracts/config/genesis-canonical-addresses.json`
- `contracts/config/interfaces/dependency-matrix.json`
- `contracts/config/predeploy/predeploy-plan.json`
- `contracts/config/deployment-manifest.json`
- `contracts/src/governance/**`
- `contracts/test/CivicFoundation420.t.sol`
- `contracts/test/CivicElectorateRegistry420.t.sol`
- `contracts/test/CivicVoting420.t.sol`
- `contracts/test/CivicGovernor420.t.sol`
- `contracts/test/CivicTimelockExecution420.t.sol`
- `contracts/test/Governance420Retirement.t.sol`
- `docs/apps/governance/**`
- `docs/architecture/protocols/stake-governance-treasury-grants.md`
- `docs/architecture/genesis-architecture.md`
- `420-indexer/src/abi-manifest.ts`
- `420-indexer/src/lifecycle-reducer.ts`

## Repository state at audit start

| Field | Value |
|---|---|
| Repository | `abvhiael/420-integrated-v0.1` |
| Baseline branch | `main` |
| Baseline SHA | `e8d9096c4029c3c0218113afc1cbd3b8d0005878` |
| Audit branch | `audit/420governance-complete-20261001` |
| Existing Governance-specific remediation PR | none found |
| Compiler | Solidity 0.8.24 |
| EVM target | Cancun |
| Contract build system | Foundry |
| Canonical timelock | `0x...0429` |
| Frozen compatibility surface | `Governance420 @ 0x...0437` |

## Architecture discovered

### Canonical state authority

- Constitution stores versioned proposal-class rules and immutable delay floors.
- Proposal Registry stores proposal identity, commitments, voting windows and lifecycle.
- Electorate Registry stores governed house adapters and proposal-bound snapshots.
- Voting stores immutable ballots and tallies against proposal snapshots.
- Governor creates proposals, freezes rules, finalizes results, queues exact committed batches and performs atomic timelocked execution.
- Timelock owns scheduling/execution delay enforcement.
- `Governance420` exposes no live legacy mutation path and only permits a one-time governance-bound pointer to the Civic governor.

### Derived/non-authoritative surfaces

420Indexer, Explorer, Search, Wallet and other frontends may display governance state but cannot establish proposal validity, electorate weight, vote outcome, queue validity or execution authority.

## File/component inventory

| Component | Baseline | Audit result |
|---|---|---|
| Civic contract family | present | COMPLETE |
| GovernanceTimelock | present | COMPLETE |
| Governance420 retirement surface | present | COMPLETE |
| Focused Civic unit/integration tests | present | PARTIAL |
| Civic module graph validation | absent | repaired on audit branch |
| Indexer lifecycle rules for Civic events | present | PARTIAL |
| Indexer ABI protocol mapping for canonical Civic contracts | absent | repaired on audit branch |
| Dedicated Governance audit CI | absent | added on audit branch |
| Wallet/user-facing Governance implementation | not found | MISSING |
| Governance-specific deployment/Registry discovery model for Civic suite | not found | MISSING |
| Final Civic compiler/runtime artifacts | not found | MISSING |
| Deterministic Genesis/predeploy state for Civic suite | not found | MISSING |
| Production-equivalent testnet evidence | not found | BLOCKED |
| Governance-specific operator/deployment runbook | not found | MISSING |
| Governance exact-head closeout evidence | not found | MISSING |

## Smart-contract audit

### Verified safe behavior

- Legacy `Governance420` proposal/vote/result mutation selectors revert permanently.
- `Governance420.bindCivicGovernor` is governance-only and one-time.
- Constitution rule updates are governance-only and cannot reduce class delay floors.
- Proposal rules are frozen by revision when proposals are created.
- Electorate source upgrades are prospective; proposal snapshots preserve source/root/revision/total weight.
- One ballot per voter/house is enforced.
- Zero-weight voters are rejected.
- Abstentions count toward quorum but not decisive approval denominator.
- Dual-house proposals require both houses.
- Queue binds to the exact action hash committed by the proposal.
- Timelock cannot execute before the frozen delay.
- Execution is atomic and single-use.
- Governor batch execution is callable only by the timelock.

### Baseline defect repaired: inconsistent module graph could be constructed

Before this audit, `CivicGovernor420` verified that module addresses contained code but did not prove that all supplied modules belonged to the same governance authority graph. A governor could be constructed with:

- Constitution bound to one timelock while Proposal Registry used another;
- Electorate Registry bound to a different timelock;
- Voting bound to a different Proposal Registry or Electorate Registry than the Governor used.

That creates a configuration-level authority split capable of producing incoherent proposal/vote/execution behavior.

Audit remediation makes the constructor fail closed unless:

1. Constitution, Proposal Registry and Electorate Registry share the same GovernanceTimelock; and
2. Voting points to the exact Proposal Registry and Electorate Registry supplied to the Governor.

`GovernanceAudit420.t.sol` adds negative qualification for each mismatch.

### Unresolved lifecycle ambiguity: cancellation

The repository contains cancellation semantics in three places:

- `CivicProposalRegistry420` permits ACTIVE/PASSED/QUEUED -> CANCELLED transitions;
- `GovernanceTimelock` has scheduler-only `cancel`;
- 420Indexer expects `ProposalCancelled` / `CivicProposalCancelled`.

But `CivicGovernor420` exposes no cancellation path or cancellation event, and canonical docs do not define who may cancel a Civic proposal after authority activation. Inventing an emergency canceller would create new governance authority. This is therefore **BLOCKED on a governance/architecture decision**, not silently repaired.

### Security review

| Finding | Classification |
|---|---|
| Legacy 0x0437 mutation paths retired | verified safe behavior |
| Exact action commitment and atomic execution | verified safe behavior |
| Timelock floor enforcement | verified safe behavior |
| Frozen rules/electorates | verified safe behavior |
| Duplicate ballot/replay | verified safe behavior |
| Module authority graph mismatch | mitigated on audit branch |
| Arbitrary external calls | accepted design risk only inside an approved committed governance batch |
| Reentrancy during batch targets | bounded by atomic execution/proposal state; target contracts remain responsible for their own reentrancy safety |
| Cancellation authority/lifecycle | unresolved architecture decision |
| Civic deployment/discovery absence | unresolved release blocker |
| Missing user-facing app | unresolved application blocker |

No token allowance path, ERC custody ledger, signature scheme or off-chain nonce authorization exists in the current Civic core, so those classes are not directly applicable to the audited contracts.

## Integration audit

### 420Indexer

Baseline `abi-manifest.ts` classified only `Governance420` and `GovernanceTimelock` as `420Governance`. The canonical Civic contracts were absent even though lifecycle reduction already recognizes Civic events.

Audit remediation maps all five canonical Civic modules to `420Governance` and adds a regression in `abi-manifest.test.ts`.

This fixes protocol classification but does **not** create missing deployment artifacts or addresses.

### Registry/discovery

The canonical Civic suite is listed in the Genesis contract map, but no Governance-specific Registry publication/discovery plan was found for the Civic modules. The frozen address namespace contains the timelock and compatibility `Governance420`, not fixed addresses for the Civic modules.

A production design must therefore explicitly choose and qualify how Civic modules are deployed and discovered without pretending the compatibility address is canonical proposal authority.

### Wallet/application layer

No Wallet governance client, route, proposal browser, vote flow, transaction state handling or canonical action-batch review surface was found. Because `config/genesis-applications.json` classifies Governance as `GENESIS_PROTOCOL_AND_USER_APP`, this is a release blocker, not optional polish.

### Treasury/Stake and other protocols

Architecture correctly separates validator stake from Civic voting weight and keeps Treasury/Vault custody separate from Civic decisions. Those boundaries are documented, but full runtime integration cannot qualify until the Civic deployment/discovery model is frozen.

## Deployment/Genesis audit

Current repository evidence is insufficient for Genesis deployment of canonical Civic governance:

- `GovernanceTimelock` has a frozen address.
- `Governance420` has a frozen compatibility address and remains `SOURCE_READY` in the predeploy plan rather than final artifact-ready.
- No final compiler/runtime artifact set was found for the Civic authority modules.
- No deterministic Civic constructor/deployment graph and initialization sequence is retained.
- No Registry discovery/publication record for Civic modules was found.
- No exact production-equivalent testnet deployment evidence exists.
- No Wallet production binding exists for canonical Civic endpoints.

## Requirement matrix

| Requirement | Canonical source | Current implementation | Tests | Documentation | Status | Required remediation |
|---|---|---|---|---|---|---|
| Public Genesis Governance app | genesis applications | declared | catalogue verification | present | COMPLETE | none |
| Civic is canonical implementation family | Governance docs/contract map | implemented | Civic suites | present | COMPLETE | none |
| Governance420 cannot be alternate authority | Governance420 + docs | retired mutation paths | retirement tests | present | COMPLETE | retain |
| Timelock authority at frozen 0x0429 | system address map | implemented | execution tests | present | COMPLETE | artifact/live verification later |
| Rule revisions and delay floors | constitution architecture | implemented | foundation/governor tests | present | COMPLETE | expand boundary tests |
| Frozen electorate source/root/revision | protocol architecture | implemented | electorate/voting tests | present | COMPLETE | expand hostile adapter tests |
| One immutable ballot | protocol architecture | implemented | voting tests | present | COMPLETE | none |
| Quorum/approval math | protocol architecture | implemented | governor tests | present | COMPLETE | add boundary/fuzz coverage |
| Dual-house semantics | protocol architecture | implemented | governor/voting tests | present | COMPLETE | none |
| Exact action commitment | protocol architecture | implemented | timelock execution tests | present | COMPLETE | none |
| Atomic queued execution | protocol architecture | implemented | execution failure rollback test | present | COMPLETE | none |
| Consistent Civic authority graph | implied by one canonical governance stack | baseline did not enforce | audit negatives added | architecture implied | COMPLETE | merged audit fix |
| Cancellation lifecycle | ProposalRegistry + Timelock + Indexer | no Governor path/event | no canonical cancel test | ambiguous | BLOCKED | governance decision, then implementation/tests/docs |
| Indexer canonical Civic ABI classification | Indexer architecture | baseline incomplete; audit fixed | audit regression added | implicit | COMPLETE | qualify exact head |
| Indexer canonical deployment descriptors | Indexer/Genesis requirements | no Civic deployment artifact/address set | none | absent | MISSING | after deployment model |
| Wallet proposal inspection | Genesis user-app requirement | absent | absent | user docs only | MISSING | implement Wallet governance client/UI |
| Wallet vote transaction flow | Genesis user-app requirement | absent | absent | user docs only | MISSING | implement guarded vote flow |
| Wallet action-batch review | Governance security docs | absent | absent | warning exists | MISSING | canonical decoded action review |
| Registry discovery of Civic suite | Registry integration requirement | not found | none | absent | MISSING | define service/component IDs and publication |
| Final Civic artifacts | Genesis deployment requirement | not found | none | absent | MISSING | reproducible compiler artifacts/code hashes |
| Deterministic initialization/order | Genesis deployment requirement | not found | none | absent | MISSING | deployment/predeploy graph |
| Dedicated audit CI | audit qualification requirement | absent baseline; audit adds | workflow | this report | COMPLETE | exact-head run required |
| Testnet deployment proof | release requirement | none | none | none | BLOCKED | official production-equivalent testnet |
| Production monitoring/runbook | production requirement | absent | n/a | absent | MISSING | operator docs after deployment model |

## Readiness state at audit branch construction

- CODE COMPLETE: **NO** — Wallet Governance application and deployment/discovery implementation remain.
- BUILD COMPLETE: **NO** — exact-head CI has not yet qualified this audit branch.
- CONTRACT COMPLETE: **NO** — cancellation authority is unresolved and deployment artifact work remains.
- TEST COMPLETE: **NO** — boundary/fuzz, cancellation decision coverage, Wallet, deployment and live integration tests remain.
- DOCUMENTATION COMPLETE: **NO** — deployment/operator/Registry discovery and cancellation semantics remain.
- INTEGRATION COMPLETE: **NO** — Wallet and deployable Civic discovery are absent.
- SECURITY QUALIFIED: **NO** — module graph defect is repaired, but exact-head static/CI qualification and unresolved cancellation/deployment boundaries remain.
- TESTNET READY: **NO** — no production-equivalent deployment package.
- GENESIS READY: **NO** — canonical Civic deployment/discovery + user app are incomplete.
- PRODUCTION READY: **NO** — testnet, monitoring, operational evidence and production deployment remain.

## Final determination

420 Governance has a substantial and coherent canonical on-chain core, but it is **not a complete Genesis user application** and is **not Genesis-ready** on the audited baseline.

The audit found and repaired two repository-local defects that do not require new governance policy:

1. Civic Governor module-authority graph validation.
2. 420Indexer protocol mapping for canonical Civic contracts.

The remaining gaps are material: cancellation semantics require an explicit governance decision; the canonical Civic suite lacks a retained deployment/discovery/artifact model; the required user-facing Wallet application is absent; and no production-equivalent live evidence exists.

The dependency-ordered remediation sequence is maintained in `docs/audit/420GOVERNANCE-AUDIT-REMEDIATION-ROADMAP.md`.
