# CMP-1.5.4 — Exit queue / withdrawal delay

Status: **IMPLEMENTED. LEVEL 1 + LEVEL 2 QUALIFICATION PENDING.**

## Canonical definition

> Exit queue / withdrawal delay

CMP-1.5.4 implements the collateral exit lifecycle for both worker and verifier positions. It does not implement slash authorization/distribution, rewards, dispute integration, final WorkerRegistry integration, escrow redistribution, hostile qualification, release-candidate work or phase closeout.

## Exit-delay policy

`ComputeStakeExitPolicy420` is an append-only governance policy keyed by `stakePolicyId`.

Each revision defines a nonzero withdrawal delay and has an exact commitment binding chain, contract, policy ID, delay and revision.

An exit request snapshots:
- exact exit-policy revision;
- exact exit-policy commitment;
- immutable `withdrawableAt`.

Later policy revisions cannot accelerate or extend an already-requested exit.

## Position exit semantics

Worker and verifier collateral positions now support:
- `requestExit(positionId)`;
- batched `withdraw(positionId, maxTranches)`.

Only the immutable stored collateral beneficiary may request or withdraw that position:
- worker position: stored worker owner;
- verifier position: stored verifier authority.

Verifier authority rotation therefore cannot transfer old collateral and cannot strand the prior authority's exit right.

Once exit is requested:
- no further top-up is accepted for that position;
- `exiting = true`;
- active/slashable amounts remain unchanged until actual withdrawal;
- withdrawal before maturity reverts;
- future slash logic retains the full pre-maturity slashable surface.

## Batched withdrawal

Collateral is backed by one canonical Vault obligation per deposit tranche.

Withdrawal is batched to avoid an unbounded-loop gas lock for highly topped-up positions.

For each matured tranche processed:
1. the exact bound obligation is revalidated;
2. the obligation is released through `AssetVault420`;
3. the obligation is claimed through `AssetVault420`;
4. payment can only go to the immutable obligation beneficiary;
5. active/slashable position amounts decrease by exactly that tranche amount.

Unprocessed tranches remain reserved, active and slashable.

When the final tranche is withdrawn:
- `activeAmount = 0`;
- `slashableAmount = 0`;
- `active = false`;
- `exiting = false`.

No arbitrary recipient argument exists.

## Security boundaries

CMP-1.5.4 does not:
- authorize a slash;
- choose a slash recipient;
- create reward accounting;
- touch payer escrow;
- grant Treasury authority;
- change collateral-policy minima.

Vault release/claim operation IDs are domain-separated by chain, collateral source, position and tranche.

Withdrawal executes under the collateral source reentrancy guard. Exit requests are rejected while a withdrawal is executing.

## Tests

Focused coverage includes:
- governance-only nonzero exit-delay publication;
- append-only delay revisions and commitments;
- exact policy snapshot at exit request;
- later policy revisions unable to rewrite pending exits;
- premature withdrawal rejection;
- top-up rejection during exit;
- immutable worker/verifier beneficiary authorization;
- historical verifier authority exit after authority rotation;
- batched withdrawal accounting;
- remaining tranche slashability after partial withdrawal;
- canonical Vault release/claim accounting;
- final position deactivation.

## Qualification level

CMP-1.5.4 is treated as a **Level 2 app milestone** because a new shared lifecycle dependency changes both worker and verifier collateral sources and exercises canonical Vault release/claim behavior.

Level 1 remains step-specific: compile, focused tests, verifier.

Level 2 is the retained `Compute*.t.sol` app suite on the same exact implementation SHA.

Repository-wide Level 3 remains deferred to **CMP-1.5.13 — Phase closeout**.

## Exit criteria

CMP-1.5.4 is COMPLETE only when:
- exact delay-policy snapshots are durable and immutable;
- premature withdrawal fails;
- unwithdrawn collateral remains slashable until maturity/actual withdrawal;
- historical verifier authority retains its own exit right;
- batched withdrawals preserve tranche isolation and accounting parity;
- no arbitrary recipient or parallel custody path exists;
- focused qualification and the retained Compute app suite pass on one exact implementation SHA;
- durable evidence records that SHA.

Next canonical step:

**CMP-1.5.5 — Objective slash authorization**
