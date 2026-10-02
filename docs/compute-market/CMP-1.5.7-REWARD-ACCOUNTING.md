# CMP-1.5.7 — Reward accounting

Status: **IMPLEMENTED. LEVEL 1 + LEVEL 2 QUALIFICATION PENDING.**

## Canonical definition

> Reward accounting

The parent CMP-1.5 architecture requires `reward()` and freezes the governing rule:

> Reward accounting must use a separately authorized reward source and canonical backing. It cannot mint through ComputeStake, seize payer escrow or fabricate Vault balance.

CMP-1.5.7 implements that rule without redefining job settlement, consensus issuance, or later useful-computation reward pools.

## Authority model

CMP-1.5.7 separates four authorities:

1. **reward policy** — `ComputeStakeRewardPolicy420` governance-publishes which typed reward source may attest rewards for one stake policy and worker/verifier subject kind;
2. **reward evidence** — `IComputeStakeRewardSource420` supplies the exact final earned amount, beneficiary, collateral position and evidence commitment;
3. **collateral identity** — the existing worker/verifier collateral source proves that the reward subject, beneficiary and stake policy correspond to a real ComputeStake position;
4. **canonical backing/custody** — a separately funded `AssetVault420` must have enough free native-$420 balance to create the reward obligation.

No one of these authorities alone can manufacture a payable reward.

## Reward-source policy

`ComputeStakeRewardPolicy420` is append-only and independently keyed by:

- `stakePolicyId`;
- subject kind: worker or verifier.

Each revision freezes:

- exact reward source;
- reward source runtime code hash;
- maximum reward amount;
- publication timestamp and revision;
- chain and policy-contract domain in the commitment.

A later policy revision does not rewrite an earlier revision.

The policy does not move value or create a reward.

## Typed final reward evidence

A reward source returns an exact `RewardEvidence` tuple containing:

- collateral `positionId`;
- subject kind;
- subject reference;
- immutable beneficiary;
- `stakePolicyId`;
- exact amount;
- earned timestamp;
- evidence commitment;
- final-earned flag.

The accounting contract does not accept beneficiary or amount from the relayer.

Rewards fail closed when evidence is non-final, zero, over the frozen cap, missing an evidence commitment, bound to the wrong worker/verifier identity, bound to the wrong beneficiary or stake policy, or predates the collateral position.

## Historical entitlement

Reward verification intentionally checks immutable collateral identity without requiring the position to remain active at credit time.

This preserves already-earned entitlement if the worker or verifier later exits, while still requiring that the reward evidence bind to a real historical ComputeStake position and that the earned timestamp not predate the position.

CMP-1.5.7 therefore does not turn later suspension/exit into confiscation of a previously valid reward.

## Canonical Vault backing

`ComputeStakeRewardAccounting420.reward(...)` is permissionless to relay but is not permissionless reward authority.

For each accepted reward it:

1. loads the exact frozen reward-source policy revision;
2. verifies the reward source runtime code hash;
3. loads final typed reward evidence;
4. verifies the exact historical worker/verifier collateral identity;
5. consumes the source/reward reference exactly once;
6. records beneficiary and position cumulative accounting;
7. creates one native-$420 reward obligation in the separately funded reward Vault;
8. immediately releases that exact obligation to claimable state.

The beneficiary then claims through ordinary canonical `AssetVault420.claim` semantics.

If the reward Vault lacks enough unencumbered backing, obligation creation reverts and the entire reward transaction rolls back. The reward reference remains unconsumed and cumulative accounting remains unchanged.

## Economic separation

CMP-1.5.7 does **not**:

- mint native $420;
- call or substitute for consensus `RewardController`;
- debit job-owner payer escrow;
- convert ComputeEscrow provider settlement into stake reward;
- compound reward into collateral automatically;
- change worker/verifier collateral balances;
- choose a reward beneficiary supplied by an arbitrary caller;
- authorize useful-computation sponsor/research reward pools from later CMP-6.

This step is the ComputeStake `reward()` accounting primitive only.

## Replay and isolation

Reward consumption is keyed by the exact authorized reward source and reward reference.

The immutable reward ID additionally commits to:

- chain;
- accounting contract;
- reward source/reference;
- collateral position;
- subject kind/reference;
- beneficiary;
- stake policy;
- amount;
- earned timestamp;
- evidence commitment;
- frozen reward-policy revision and commitment.

Independent rewards therefore cannot collide, and one source/reference cannot be credited twice.

## Qualification

Focused coverage includes:

- governance-only reward policy publication;
- worker/verifier subject-kind isolation;
- append-only revisions and commitments;
- reward-source code requirement and bounded maximum;
- exact worker reward credit;
- exact verifier reward credit;
- canonical Vault obligation creation/release/claim;
- cumulative beneficiary/position accounting;
- duplicate reward replay rejection;
- non-final and over-cap reward rejection;
- beneficiary/subject/stake-policy mismatch rejection;
- pre-collateral reward rejection;
- historical earned reward after later position inactivity;
- insufficient backing atomic rollback.

CMP-1.5.7 is treated as a **Level 2 app milestone** because it introduces a new economic authority that crosses reward-source policy, worker/verifier collateral identity and canonical Vault-backed claimability.

Level 1 remains focused on changed contracts/tests/verifier.

Level 2 is the retained `Compute*.t.sol` application suite on the same exact implementation SHA.

Repository-wide Level 3 remains deferred to **CMP-1.5.13 — Phase closeout**.

## Exit criteria

CMP-1.5.7 is COMPLETE only when:

- reward authority is explicit and versioned;
- reward-source code identity is frozen;
- exact worker/verifier collateral identity is verified;
- caller cannot choose beneficiary or amount;
- rewards are final, bounded and exactly-once;
- historical earned entitlement survives later position inactivity;
- every successful credit is canonically Vault-backed;
- insufficient backing fails atomically;
- reward credit does not mint, debit payer escrow or mutate collateral;
- focused Level 1 qualification passes;
- retained Compute Level 2 qualification passes on the same exact implementation SHA;
- durable evidence records that SHA.

Next canonical step:

**CMP-1.5.8 — Dispute/stake integration**
