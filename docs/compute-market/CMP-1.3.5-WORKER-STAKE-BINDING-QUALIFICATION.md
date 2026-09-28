# CMP-1.3.5 — compute-stake source binding and fail-closed worker collateral admission

Status: **IMPLEMENTATION COMPLETE; exact-head repository qualification required before COMPLETE.**

CMP-1.3.5 implements the worker-registry side of the frozen CMP-1.5 integration boundary. It does **not** implement collateral custody, staking, unstaking, exit requests, rewards, or slashing. Those remain CMP-1.5.

## Source inventory result

The existing `Stake420` contract is a read-oriented Genesis **validator-staking** facade. Its authority and data model are validator-specific and therefore cannot satisfy worker collateral requirements.

CMP-1.3.5 explicitly prevents:

- validator bond state from substituting for ComputeMarket worker collateral;
- arbitrary wallet/token balances from becoming collateral;
- CMP-1.2 payer deposits/reservations from becoming worker stake;
- worker-registry status from fabricating a slash result.

## Scope

This step adds:

- `IComputeStakeSource420`, the narrow read interface expected from the future qualified CMP-1.5 source;
- `ComputeWorkerStake420`, a fail-closed worker admission adapter;
- an explicit `computeStakeSourceId()` compatibility marker;
- versioned governance source bindings;
- a default unbound state that rejects every stake-required admission;
- versioned stake-admission policies with minimum active and slashable amounts;
- optional rejection of exiting positions;
- exact live reads of worker/policy-specific collateral state;
- immutable historical stake references bound to:
  - worker ID and exact worker revision;
  - stake policy ID and policy revision;
  - source binding revision and source address;
  - position ID and position revision;
  - active/slashable amounts and exit state;
  - a domain-separated snapshot commitment;
- live revalidation so later slash/exit/inactivation affects new admission without rewriting historical references.

## Authority boundary

`ComputeWorkerStake420` never custodies stake.

It grants no:

- deposit/withdraw authority;
- reward authority;
- slash authority;
- Vault/custody authority;
- correctness or verifier authority;
- match acceptance authority;
- settlement authority;
- governance, bridge, validator, or wallet authority.

Only the bound CMP-1.5 source may ultimately own compute collateral lifecycle and slashing semantics.

## Fail-closed behavior

Stake-required admission rejects when:

- CMP-1.5 source is unbound;
- source binding is inactive;
- source fails the explicit ComputeStake compatibility marker;
- worker exact revision is not otherwise eligible;
- policy is missing or closed to new work;
- position is missing or inactive;
- active amount is below threshold;
- slashable amount is below threshold;
- policy rejects exiting positions and position is exiting;
- a required historical reference is missing or belongs to another worker/revision/policy/source binding.

## Qualification tests

`contracts/test/ComputeWorkerStake420.t.sol` covers:

1. unbound CMP-1.5 source rejects stake-required work;
2. validator-stake-like surfaces cannot bind as compute collateral;
3. compatible compute stake source and thresholds qualify;
4. active amount threshold enforcement;
5. slashable amount threshold enforcement;
6. inactive position rejection;
7. exiting position rejection;
8. exact worker/policy/source/position snapshot binding;
9. live slash/position reduction removes future admission without rewriting history;
10. policy revision invalidates old references;
11. source binding revision invalidates old references;
12. worker revision invalidates old references;
13. parent/resource suspension overrides otherwise sufficient stake;
14. unauthorized source binding, policy publication, and reference capture fail.

## Invariant mapping

CMP-1.3.5 advances:

- CMP-INV-002/003 — stake references bind stable worker identity and exact revision;
- CMP-INV-005 — stake references grant no unrelated authority;
- CMP-INV-019 — one worker/revision cannot consume another stake reference;
- CMP-INV-020 — live admission changes do not rewrite prior earned settlement or historical references;
- CMP-INV-021 — stake is recognized only through the explicit compute-stake source path;
- CMP-INV-022 — slashing remains owned by CMP-1.5 and cannot be fabricated here;
- CMP-INV-026 — historical collateral admission state remains reconstructable;
- CMP-INV-028/029 — policy/source/worker changes cannot silently preserve old admission semantics;
- CMP-INV-030 — compute collateral remains provider-neutral.

## Deferred boundaries

CMP-1.3.5 does not implement:

- CMP-1.5 `stake()`, `unstake()`, `requestExit()`, `slash()`, or `reward()`;
- accepted-job worker snapshot integration;
- deployment and ProtocolRegistry publication.

Until an independently qualified CMP-1.5 source is deployed and bound, production stake-required admission remains fail closed.

## Completion gate

CMP-1.3.5 is complete only after the exact candidate head passes:

- Solidity Contracts qualification, all required shards;
- 420 Integrated Qualification;
- 420Docs Qualification.

The exact candidate SHA and run evidence must then be recorded, followed by retained exact-head qualification of the evidence-recording head before final closeout.
