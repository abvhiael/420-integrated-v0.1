# STAKE-AUDIT-2 — fourtwentyd validator/reward/slash system-call derivation

Status: implemented for exact-head qualification  
Scope: 420Stake audit remediation  
Canonical roadmap step: **STAKE-AUDIT-2 — fourtwentyd validator/reward/slash system-call derivation. Implement deterministic production construction of validator-state, exit, rotation, slash and reward calls from finalized consensus outcomes, including sequence persistence/recovery and exact ABI payload vectors.**

## Repository authority and retained boundaries

This increment implements the missing consensus-side construction layer without changing the frozen execution authority model.

- `fourtwentyd` remains authoritative for finalized validator, committee, reward and slash outcomes.
- `ConsensusSystemCall420` remains the only execution gateway for these consensus-owned mutations.
- `ValidatorRegistry` remains the validator lifecycle/collateral receiver.
- `RewardController` remains the execution accounting receiver and does not become reward-policy authority.
- native bond composition remains custody-driven; no synthetic bond setter was added.
- the existing authenticated `engine420_submitSystemCallsV1` transport, batch commitment, execution placement, gateway sequence checks and failure-atomic execution remain unchanged.

The production derivation implementation is in:

- `consensus/systemcall/stake_derivation.go`
- `consensus/systemcall/sequence_state.go`
- `consensus/engine/stake_systemcalls.go`

## Frozen routes and exact selectors

The derivation layer emits only the five routes frozen by `docs/CONSENSUS-SYSTEM-CALL-v1.md` and `contracts/config/consensus-system-call.json`.

| Action | Target | Solidity entrypoint | selector |
| --- | --- | --- | --- |
| `420/SYSCALL/VALIDATOR_STATE/V1` | ValidatorRegistry `0x...0423` | `applyConsensusState(bytes32,uint8,uint64,uint64,uint64,uint64)` | `0x17e619d8` |
| `420/SYSCALL/VALIDATOR_EXIT_NOTICE/V1` | ValidatorRegistry `0x...0423` | `applyExitNotice(bytes32,uint64)` | `0x3dc84ed0` |
| `420/SYSCALL/VALIDATOR_SLASH/V1` | ValidatorRegistry `0x...0423` | `applySlash(bytes32,uint8,uint8,uint256,uint256,bytes32,uint8)` | `0x0c6c5204` |
| `420/SYSCALL/ROTATION_SNAPSHOT/V1` | ValidatorRegistry `0x...0423` | `applyRotationSnapshot(uint64,uint256)` | `0x6594414c` |
| `420/SYSCALL/REWARD/V1` | RewardController `0x...0420` | `applyConsensusReward(uint64,address,address[],uint256,uint256,uint256,uint256)` | `0xac11b5e1` |

Exact full calldata vectors are qualified independently in both:

- `consensus/systemcall/stake_derivation_test.go`
- `contracts/test/StakeSystemCallABIVectors420.t.sol`

The Go test proves fourtwentyd emits the retained byte vectors. The Solidity test independently recreates the same calls using Solidity's ABI encoder and canonical contract selectors.

## Deterministic call ordering

A finalized outcome set is converted to one ordered batch using dependency-aware deterministic ordering:

1. rotation snapshot, when present;
2. exit notices sorted by validator ID;
3. slash outcomes sorted by finalized consensus ordinal, then evidence hash;
4. validator-state outcomes sorted by validator ID;
5. reward settlement, when present.

The rotation snapshot is intentionally first. `ValidatorRegistry` requires the finalized rotation boundary to be materialized before an `ACTIVE -> NORMAL_COOLDOWN` transition can pass its scheduled-exit check. Eligibility-changing transitions in that execution block therefore affect the next rotation snapshot rather than rewriting the snapshot that triggered the boundary.

Exit notices precede lifecycle-state application so a finalized notice can exist before a later transition that depends on exit timing.

A slash and a generic validator-state mutation for the same validator in the same batch are rejected as ambiguous. The slash outcome already carries its resulting lifecycle status and must be the single finalized status mutation for that validator in that execution block.

## Sequence persistence and recovery

The chain-global gateway sequence remains canonical execution state. Local fourtwentyd persistence is a recovery aid, not an authority that may override the chain.

`FileSequenceStore` persists:

- chain ID;
- canonical execution block;
- canonical execution block hash;
- last applied system-call sequence.

Writes use a same-directory temporary file, restrictive permissions, fsync, atomic rename and best-effort directory sync.

`SequenceManager` enforces these rules:

- a new batch may be built only when the locally persisted anchor exactly matches the separately supplied canonical parent anchor;
- a missing or mismatched local anchor fails closed with `ErrSequenceRecoveryRequired`;
- recovery is explicit through `RecoverCanonicalParent`, whose input must already have been independently verified against canonical execution/gateway state;
- durable sequence state advances only through `CommitCanonicalChild` after the caller accepts the child as canonical/finalized;
- a staged, rejected or abandoned payload does not advance durable sequence state;
- reorganization recovery may move the local cursor backward only through explicit canonical-parent recovery;
- the next batch always begins at `parent.LastSequence + 1`, preserving the gateway's no-gap/no-replay rule.

This matches the frozen rule that a replacement branch resumes from the canonical parent gateway sequence.

## Reward derivation

Reward arithmetic is now production code in the consensus derivation layer rather than a documentation-only responsibility.

### Gross issuance

Base units use 18 decimals.

- initial gross issuance: `4.2 * 10^18`;
- reduction interval: 420,000 execution blocks;
- reduction: 0.420% per era;
- exact decay factor: `995800 / 1000000`;
- arithmetic: direct-from-genesis integer exponentiation and floor division;
- tail floor: `0.420 * 10^18`;
- frozen modeled floor era: 340.

No floating-point arithmetic participates in the result.

### Dynamic top-level allocation

The implementation uses the same fixed-point constants already enforced by `ValidatorRegistry.rewardAllocation`:

- allocation scale: `1_000_000_000_000`;
- Security at 15 active: `283_446_712_018`;
- Security at 30 active: `500_000_000_000`;
- linear integer interpolation for every actual active count 15 through 30, including migration counts 16/17/19/etc.

Then:

1. `Security = floor(gross * securityScale / allocationScale)`;
2. `remaining = gross - Security`;
3. `Attention = floor(remaining / 2)`;
4. `Development = remaining - Attention`;
5. `proposer = floor(Security / 2)`;
6. `participantPool = Security - proposer`;
7. `perParticipant = floor(participantPool / (activeCount - 1))`.

The participant list contains only validators that finalized the required valid participation. Missing participant shares and integer division remainder are not redistributed or redirected.

Participant addresses are sorted lexicographically before ABI encoding so equivalent finalized participation sets cannot produce different batch roots because of map/input iteration order.

## Slash derivation

Consensus provides the finalized offense, correlation tier, evidence hash, resulting status, current collateral composition and selected penalty basis points.

The derivation layer mirrors the execution constitutional ceilings:

- inactivity: 0% principal;
- invalid consensus message: 2.5% / 5% / 7.5%;
- double proposal: 5% / 10% / 15%;
- double vote: 10% / 20% / 30%;
- surround vote: 10% / 20% / 30%;
- finality equivocation: 100%.

For non-terminal percentage slashes:

`totalPenalty = floor(effectiveCollateral * penaltyBps / 10000)`

`ownedSlashed = floor(totalPenalty * ownedBond / effectiveCollateral)`

`creditSlashed = totalPenalty - ownedSlashed`

This is byte-for-byte compatible with the proportional validation performed by `ValidatorRegistry.applySlash`.

Finality equivocation requires a 10,000-bps penalty and consumes all remaining participant-owned and protocol-credit collateral.

## Engine integration

The Engine client now exposes:

- `ForkchoiceUpdatedV3WithFinalizedStakeOutcomes`;
- `NewPayloadV3WithFinalizedStakeOutcomes`.

Both derive the canonical batch from the verified parent sequence anchor before using the already-qualified staging/import path. Local build and received-payload validation therefore use the same deterministic constructor.

The methods return the derived `systemcall.Batch` so the consensus block body/header commitment can retain exactly the calls that were staged.

## Failure behavior

The derivation layer fails closed for:

- zero/mismatched chain or parent context;
- sequence overflow;
- duplicate exit/state outcomes;
- duplicate slash evidence or slash ordinals;
- ambiguous slash + generic state mutation for the same validator;
- invalid status/offense/correlation values;
- slash penalty above the constitutional ceiling;
- malformed/duplicate/proposer-as-participant reward sets;
- reward block number different from the execution block;
- active-validator count outside the bounded 15–30 phase;
- local sequence persistence missing or disagreeing with the canonical parent.

No failure path falls back to an ordinary transaction, silently drops a required call, advances the local sequence cursor, or fabricates a replacement outcome.

## Qualification relationship

STAKE-AUDIT-2 is a material consensus/execution integration milestone.

Required Level 1 qualification covers:

- deterministic system-call builder unit/negative tests;
- reward/slash arithmetic;
- persistent sequence restart/reorg recovery;
- exact Go ABI vectors;
- independent Solidity ABI vectors;
- Engine derivation/staging integration;
- compile/build of directly affected consensus packages.

Level 2 for this milestone covers the retained consensus package suite plus the existing execution gateway regression.

Level 3 repository-wide/Genesis/Geth/fault/soak/security/deployment closeout remains intentionally deferred to final 420Stake app-phase closeout unless an automatically-triggered repository workflow exposes a real regression attributable to this change.

## Limitations intentionally not claimed by this step

This step does not claim:

- live public-testnet deployment;
- frozen Stake predeploy artifacts or materialized Genesis state;
- a completed user-facing 420Stake client;
- external security review;
- final Validator_Stake / Rewards_Treasuries hardening closeout;
- final repository-wide app-phase reconciliation.

Those remain owned by later canonical STAKE-AUDIT roadmap steps.
