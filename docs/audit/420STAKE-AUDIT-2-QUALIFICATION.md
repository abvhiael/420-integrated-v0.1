# 420Stake STAKE-AUDIT-2 qualification evidence

## Step

**STAKE-AUDIT-2 — fourtwentyd validator/reward/slash system-call derivation.**

Canonical requirement:

> Implement deterministic production construction of validator-state, exit, rotation, slash and reward calls from finalized consensus outcomes, including sequence persistence/recovery and exact ABI payload vectors.

## Completion state

**COMPLETE**

Qualified implementation SHA:

`cd6e19328e77e1bb19bc198c48fb5154b60a88a0`

Qualification model:

- Level 1: **PASS**
- Level 2 app integration milestone: **PASS**
- Level 3 complete app-phase closeout: **intentionally deferred**

## Repository state at qualification

- repository: `abvhiael/420-integrated-v0.1`
- audit branch: `feature/420stake-audit-remediation`
- PR: #443, `420Stake audit remediation: STAKE-AUDIT-1/2`
- implementation head: `cd6e19328e77e1bb19bc198c48fb5154b60a88a0`
- current `main` observed during closeout: `e8d9096c4029c3c0218113afc1cbd3b8d0005878`
- retained merge base: `cbff831984df5d57540a26c879663cf95bcf61c9`
- branch divergence at closeout: 38 commits ahead / 24 commits behind current `main`

The current-main-only file set inspected at closeout is limited to Compute Market work and the 420Names deployment-operations document. No current-main-only Stake or consensus system-call derivation file conflicts with this implementation. Full reconciliation with current `main` remains the Level 3 app-phase closeout responsibility.

## Implementation summary

STAKE-AUDIT-2 closes the audit finding that the repository had authenticated consensus-system-call transport and execution routing but no production fourtwentyd constructor for the finalized Stake outcomes that those routes are intended to carry.

### Deterministic finalized-outcome derivation

Added `consensus/systemcall/stake_derivation.go`.

It constructs canonical `systemcall.Batch` objects from finalized consensus outcomes for exactly the five frozen routes:

1. `420/SYSCALL/ROTATION_SNAPSHOT/V1` -> ValidatorRegistry `0x...0423`
2. `420/SYSCALL/VALIDATOR_EXIT_NOTICE/V1` -> ValidatorRegistry `0x...0423`
3. `420/SYSCALL/VALIDATOR_SLASH/V1` -> ValidatorRegistry `0x...0423`
4. `420/SYSCALL/VALIDATOR_STATE/V1` -> ValidatorRegistry `0x...0423`
5. `420/SYSCALL/REWARD/V1` -> RewardController `0x...0420`

The builder binds every call to execution block, parent hash, chain ID and strict chain-global sequence.

Deterministic dependency-aware ordering is:

- rotation snapshot first;
- exit notices sorted by validator ID;
- slash outcomes sorted by finalized consensus ordinal then evidence hash;
- validator-state outcomes sorted by validator ID;
- reward settlement last.

Duplicate/ambiguous finalized mutations fail closed.

### Reward derivation

Production integer-only reward arithmetic now exists in fourtwentyd consensus code.

Implemented anchors:

- initial gross issuance: 4.2 native 420 in 18-decimal base units;
- reduction interval: 420,000 blocks;
- 0.420% decay factor expressed as exact integer ratio `995800 / 1000000`;
- direct-from-genesis integer exponentiation with floor division;
- 0.420 native-420 tail floor;
- frozen modeled floor era 340;
- dynamic Security allocation from actual active validator count 15 through 30, including transitional committee counts;
- Attention and Development split the non-Security remainder deterministically;
- proposer receives floor(Security / 2);
- per-participant amount is floor(participant pool / (activeCount - 1));
- missed participation and deterministic division remainder remain unissued;
- participant addresses are canonicalized before ABI encoding.

No floating-point arithmetic is used in consensus reward settlement.

### Slash derivation

Consensus-side slash settlement mirrors the execution constitutional ceilings and collateral arithmetic:

- inactivity: zero principal slash;
- invalid consensus message: 2.5% / 5% / 7.5%;
- double proposal: 5% / 10% / 15%;
- double vote: 10% / 20% / 30%;
- surround vote: 10% / 20% / 30%;
- finality equivocation: 100%.

Non-terminal slash amounts are apportioned proportionally between participant-owned collateral and protocol credit using the same integer-floor rule validated by `ValidatorRegistry.applySlash`.

Finality equivocation requires the full 10,000-bps penalty and consumes all remaining collateral.

### Sequence persistence and recovery

Added `consensus/systemcall/sequence_state.go`.

The durable sequence journal records:

- chain ID;
- canonical execution block;
- canonical execution block hash;
- last applied system-call sequence.

Persistence uses restrictive permissions, a same-directory temporary file, fsync and atomic rename.

The local sequence journal is explicitly subordinate to canonical execution state:

- a new batch can be derived only when the persisted anchor exactly matches the separately verified canonical parent;
- missing/stale state fails closed with recovery required;
- reorg/restart recovery is explicit through a verified canonical-parent anchor;
- staged/rejected/abandoned payloads do not advance durable sequence state;
- the durable cursor advances only after the child is accepted as canonical/finalized;
- replacement branches resume from the canonical parent sequence.

### Engine production wiring

Added `consensus/engine/stake_systemcalls.go`:

- `ForkchoiceUpdatedV3WithFinalizedStakeOutcomes`
- `NewPayloadV3WithFinalizedStakeOutcomes`

Both paths reconstruct the same deterministic batch from finalized outcomes before invoking the previously-qualified authenticated system-call staging/build/import path.

### Exact ABI vectors

Added independent cross-language vector qualification:

- Go: `consensus/systemcall/stake_derivation_test.go`
- Solidity: `contracts/test/StakeSystemCallABIVectors420.t.sol`

The vectors cover all five frozen routes and prove fourtwentyd-produced calldata agrees with Solidity's canonical ABI encoding and the live contract selectors.

### Documentation and verification

Added/updated:

- `docs/architecture/decisions/STAKE-AUDIT-2-SYSTEM-CALL-DERIVATION.md`
- `docs/architecture/infrastructure/fourtwentyd.md`
- `scripts/verify-stake-audit-2-systemcalls.py`
- `.github/workflows/stake-audit-2.yml`

## Files changed for STAKE-AUDIT-2

- `consensus/systemcall/stake_derivation.go`
- `consensus/systemcall/sequence_state.go`
- `consensus/systemcall/stake_derivation_test.go`
- `consensus/engine/stake_systemcalls.go`
- `consensus/engine/stake_systemcalls_test.go`
- `contracts/test/StakeSystemCallABIVectors420.t.sol`
- `docs/architecture/decisions/STAKE-AUDIT-2-SYSTEM-CALL-DERIVATION.md`
- `docs/architecture/infrastructure/fourtwentyd.md`
- `scripts/verify-stake-audit-2-systemcalls.py`
- `.github/workflows/stake-audit-2.yml`

## Level 1 qualification

Dedicated workflow:

- workflow: **420Stake STAKE-AUDIT-2**
- run: **#1**
- run ID: `36883182627`
- job: `level-1`
- job ID: `110439825811`
- exact implementation SHA: `cd6e19328e77e1bb19bc198c48fb5154b60a88a0`
- result: **PASS**

Passed steps:

- exact-head checkout and SHA verification;
- `python scripts/verify-stake-audit-2-systemcalls.py`;
- `go test ./consensus/systemcall ./consensus/engine`;
- `go build ./consensus/cmd/fourtwentyd`;
- `forge test --match-path 'test/StakeSystemCallABIVectors420.t.sol' -vvv`.

This directly qualifies:

- frozen action/target reconciliation;
- deterministic call ordering;
- negative/duplicate/ambiguous outcome handling;
- reward arithmetic and issuance conservation;
- slash ceilings and proportional settlement;
- sequence restart/reorg persistence behavior;
- production Engine staging wrapper;
- exact Go/Solidity ABI compatibility.

## Level 2 app integration milestone qualification

STAKE-AUDIT-2 is a material consensus/execution integration milestone because it introduces the missing production construction layer at the fourtwentyd -> Engine -> execution authority boundary.

Dedicated workflow:

- workflow: **420Stake STAKE-AUDIT-2**
- run: **#1**
- run ID: `36883182627`
- job: `level-2-stake-consensus-integration`
- job ID: `110439826283`
- exact implementation SHA: `cd6e19328e77e1bb19bc198c48fb5154b60a88a0`
- result: **PASS**

Passed retained integration checks:

- `go test ./consensus/...`;
- `forge test --match-path 'test/ConsensusSystemCall420.t.sol' -vvv`;
- `forge test --match-path 'test/StakeValidatorGenesis420.t.sol' -vvv`.

## Supplementary automatically-triggered evidence

The following broad/repository workflows also completed successfully on the same implementation SHA. They are useful corroborating evidence but were not promoted to STAKE-AUDIT-2 exit criteria under the phase model:

- **420 Integrated Qualification** run `36883181972`: **PASS**
  - included repository `go test ./...`;
  - fourtwentyd and node420 builds;
  - production dependency checks;
  - fault/soak matrix;
  - Geth/Engine qualification.
- **node420 Release Gate** run `36883182348`: **PASS**.
- **420Stake STAKE-AUDIT-1** rerun `36883182516`: **PASS**.
- **420Docs Qualification** run `36883182421`: **PASS**.
- **420Indexer** runs `36883182252` and `36883182434`: **PASS**.
- **Genesis Address Authority** run `36883182300`: **PASS**.
- applicable Registry and Wallet collateral checks observed at closeout: **PASS**.

The general Solidity workflow classified the PR such that its full contract shard matrix was not applicable to this change because production Solidity contract code was not modified. The required contract-side ABI check was instead run explicitly in the dedicated Level 1 workflow and passed.

## Exit-criterion reconciliation

| Canonical STAKE-AUDIT-2 requirement | Evidence | Result |
| --- | --- | --- |
| deterministic production validator-state construction | finalized-outcome builder + ABI vector | PASS |
| deterministic production exit construction | finalized-outcome builder + ABI vector | PASS |
| deterministic production rotation construction | finalized-outcome builder + ABI vector | PASS |
| deterministic production slash construction | slash arithmetic + ordering + ABI vector | PASS |
| deterministic production reward construction | integer reward engine + participant canonicalization + ABI vector | PASS |
| source from finalized consensus outcomes | `FinalizedStakeOutcomes` production Engine wrappers | PASS |
| strict sequence assignment | batch builder begins at canonical parent sequence + 1 | PASS |
| sequence persistence | atomic `FileSequenceStore` | PASS |
| restart recovery | exact canonical-parent matching | PASS |
| reorg recovery | explicit verified-parent recovery and replacement sequence tests | PASS |
| exact ABI payload vectors | independent Go and Solidity fixtures for all five routes | PASS |
| production Engine path integration | build/import wrappers + Engine integration test | PASS |
| affected consensus regression coverage | Level 1 + retained Level 2 consensus suite | PASS |
| affected execution gateway regression | retained `ConsensusSystemCall420.t.sol` | PASS |
| Stake lifecycle/settlement regression | retained `StakeValidatorGenesis420.t.sol` | PASS |
| durable architecture/operator documentation | ADR + fourtwentyd docs | PASS |

Every original STAKE-AUDIT-2 step-specific exit criterion is satisfied.

## Level 3 intentionally deferred

The following remain deferred to the complete 420Stake app-phase closeout or their later canonical roadmap owner:

- final reconciliation/merge with then-current `main`;
- complete repository/Genesis inventory and final monolithic qualification;
- final predeploy artifact/storage reconciliation;
- public testnet deployment evidence;
- user-facing 420Stake application qualification;
- final Indexer/Explorer/SDK release qualification;
- final invariant/security suite closeout;
- external security review;
- final Genesis readiness/security-suite status.

The automatically-triggered broad qualification that happened to run successfully on this SHA does not replace the required future exact merge-candidate Level 3 closeout.

## Known limitations / non-claims

STAKE-AUDIT-2 does not claim:

- a live public-testnet Stake deployment;
- frozen Stake predeploy artifacts/storage;
- completion of the 420Stake user-facing Wallet/frontend;
- external audit completion;
- final `Validator_Stake` / `Rewards_Treasuries` security-suite closure.

Those are later roadmap responsibilities.

## Next canonical roadmap step

**STAKE-AUDIT-3 — Stake contract/indexer replay and ABI hardening.** Duplicate slash evidence, reward replay/block/participant guards, slash resulting-status event, current public interfaces and canonical Indexer lifecycle rules.

The repository audit records that much of STAKE-AUDIT-3 was implemented earlier on this remediation branch, but it must still be treated as its own canonical step and receive its required exact-head qualification before being marked complete.
