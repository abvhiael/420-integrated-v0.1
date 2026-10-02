# CMP-1.5.9 — WorkerRegistry stake-source integration

Status: **IMPLEMENTED. LEVEL 1 + LEVEL 2 QUALIFICATION PENDING.**

## Canonical definition

> WorkerRegistry stake-source integration

CMP-1.3.5 deliberately implemented only the **consumer side** of the future ComputeStake boundary:

- `IComputeStakeSource420`;
- `ComputeWorkerStake420`;
- fail-closed worker admission;
- versioned stake policies;
- historical stake references.

At that time, CMP-1.5 collateral custody did not yet exist.

CMP-1.5.9 closes that deferred boundary by binding WorkerRegistry admission to the actual Vault-backed `ComputeStakeWorkerCollateral420`.

## Gap analysis

Before this step, a governance-bound source needed only to:

1. have contract code; and
2. return the expected `computeStakeSourceId()` marker.

That was sufficient while CMP-1.3 was defining a future integration contract, but it is not sufficient now that the canonical CMP-1.5 source exists.

A marker-compatible contract wired to another WorkerRegistry could otherwise present unrelated worker IDs or fabricated position state.

The old source binding also did not freeze runtime code identity.

CMP-1.5.9 therefore strengthens the binding without changing the already-qualified worker admission semantics.

## Canonical source identity

`IComputeStakeSource420` now exposes:

`workerRegistry()`

`ComputeStakeWorkerCollateral420` returns the exact immutable `ComputeWorkerRegistry420` supplied at construction.

`ComputeWorkerStake420.bindSource(...)` now requires:

- expected ComputeStake source ID;
- source contract code;
- source-reported WorkerRegistry equal to its own immutable WorkerRegistry;
- nonzero source runtime code hash.

Each source-binding revision freezes:

- source address;
- canonical WorkerRegistry address;
- source runtime code hash;
- revision;
- active state.

A marker-compatible source attached to another WorkerRegistry fails closed.

## Runtime revalidation

The worker admission adapter does not assume a previously valid binding remains valid forever.

Before live reads, reference capture, or eligibility evaluation it revalidates:

- binding exists and is active;
- source still has code;
- current runtime code hash equals the frozen code hash;
- frozen WorkerRegistry equals the adapter's canonical WorkerRegistry;
- live `workerRegistry()` still reports the same registry;
- live `computeStakeSourceId()` still reports the expected CMP source ID.

If any condition fails:

- direct live reads revert; and
- admission returns false.

## Historical stake references

A `StakeReference` now additionally freezes the source runtime code hash.

Its snapshot commitment binds:

- worker ID/revision;
- stake policy ID/revision;
- source binding revision;
- source address;
- source code hash;
- position ID/revision;
- active and slashable amounts;
- active/exiting state;
- withdrawal timestamp.

New admission still rechecks the live position.

Historical references remain immutable even if the live position later exits, is reduced, slashed, becomes inactive, or the source/policy binding changes.

## Real CMP-1.5 source integration

Focused integration tests instantiate the actual:

- `ComputeWorkerRegistry420`;
- canonical collateral `AssetVault420`;
- `ComputeStakeExitPolicy420`;
- `ComputeStakeSlashPolicy420`;
- `ComputeStakeWorkerCollateral420`;
- `ComputeWorkerStake420`.

The test proves:

1. the real collateral source binds to the exact WorkerRegistry and frozen code hash;
2. a worker with no collateral fails stake-required admission;
3. a real native-$420 Vault-backed collateral position qualifies admission once thresholds are met;
4. the worker can capture an immutable historical reference to that real position;
5. the same reference remains valid while the live position qualifies;
6. `requestExit()` immediately removes the worker from new admission under a reject-exiting policy;
7. the historical reference is not rewritten by that later exit transition;
8. reads through `ComputeWorkerStake420` match the canonical position read directly from `ComputeStakeWorkerCollateral420`.

## Authority boundaries

CMP-1.5.9 does not give WorkerRegistry or `ComputeWorkerStake420`:

- custody authority;
- stake/unstake authority;
- exit authority;
- slash authority;
- slash-distribution authority;
- reward authority;
- payer-escrow authority;
- validator stake authority;
- arbitrary balance admission authority.

The integration remains a read/admission boundary.

Collateral lifecycle remains owned by CMP-1.5 and canonical 420Vault.

## Qualification

Focused Level 1 coverage includes:

- source marker validation;
- canonical WorkerRegistry identity validation;
- cross-wired source rejection;
- runtime code-hash freeze;
- real Vault-backed collateral admission;
- real position historical reference;
- exit-state live admission rejection;
- historical reference preservation;
- Worker read-model regression;
- CMP-1.5.9 mechanical verifier.

CMP-1.5.9 is treated as a **Level 2 Compute milestone** because it closes the cross-phase WorkerRegistry/ComputeStake authority boundary with the real collateral implementation.

The retained `Compute*.t.sol` suite must pass on the same exact implementation SHA.

Repository-wide Level 3 remains deferred to **CMP-1.5.13 — Phase closeout**.

## Exit criteria

CMP-1.5.9 is COMPLETE only when:

- the canonical worker collateral source exposes its WorkerRegistry;
- the worker admission adapter rejects a source wired to another WorkerRegistry;
- runtime code hash is frozen and revalidated;
- historical references bind source code identity;
- real Vault-backed worker collateral drives WorkerRegistry admission;
- missing/below-threshold/inactive/exiting collateral fails closed as applicable;
- live position change does not rewrite historical references;
- WorkerRegistry/WorkerStake gain no collateral mutation authority;
- focused Level 1 qualification passes;
- retained Compute Level 2 qualification passes on the same exact implementation SHA;
- durable evidence records that SHA.

Next canonical step:

**CMP-1.5.10 — ComputeEscrow slash-redistribution integration**
