# CMP-1.5.1 — Worker collateral

Status: **COMPLETE. LEVEL 1 EXACT-HEAD QUALIFIED.**

## Canonical definition

The controlling roadmap defines CMP-1.5.1 exactly as:

> Worker collateral

CMP-1.5.1 implements the worker-owned collateral position and deposit/read surface only. It does not collapse verifier collateral, collateral-policy minimums, exit/withdrawal, slash authorization/distribution, rewards, dispute integration, final WorkerRegistry integration, escrow redistribution, hostile qualification, release-candidate or closeout work.

## Implementation

Canonical runtime:

`contracts/src/compute/ComputeStakeWorkerCollateral420.sol`

The contract:

- implements `IComputeStakeSource420`;
- accepts native $420 only from the current canonical worker operator;
- rejects retired workers;
- derives a domain-separated position per worker and stake-policy reference;
- deposits every stake amount into the registered canonical `VAULT_COLLATERAL` `AssetVault420`;
- creates one immutable Vault obligation per deposit tranche;
- aggregates `activeAmount` and `slashableAmount` without moving custody into a parallel staking treasury;
- exposes current worker position reads compatible with the existing `ComputeWorkerStake420` consumer;
- retains exact tranche/obligation provenance for later exit/slash steps.

At CMP-1.5.1, `activeAmount == slashableAmount` because no exit or slash transition exists yet. Those reductions are deliberately owned by later roadmap steps.

## Authority and accounting boundaries

- Only the worker's current canonical operator may add collateral for that worker.
- WorkerRegistry identity/lifecycle remains independent from collateral custody.
- 420Vault remains the custody/accounting authority.
- The Compute stake source records lifecycle/position metadata only; its own ETH balance is never canonical collateral.
- A successful stake requires both the native Vault deposit and creation of the exact worker-collateral obligation in the same transaction.
- Missing Vault authorization reverts the entire operation, including the deposit.
- Each worker/policy position is isolated and each top-up creates a distinct backing tranche.
- No withdrawal, exit, slash, reward, recipient redirection or payer-escrow path is introduced here.

## Focused qualification

`contracts/test/ComputeStakeWorkerCollateral420.t.sol` covers:

- canonical Vault obligation backing;
- accounting/balance parity;
- top-up tranche isolation and position revisions;
- stake-policy position isolation;
- unauthorized operator rejection;
- retired-worker rejection;
- missing Vault-create grant atomic rollback;
- direct-ETH rejection.

Machine-readable step evidence:

`contracts/config/compute-market/cmp-1.5.1-worker-collateral.json`

Mechanical verifier:

`scripts/verify-cmp-1-5-1-worker-collateral.py`

## Exit criteria

CMP-1.5.1 is COMPLETE only when:

- worker deposits are canonically Vault-backed;
- only the canonical worker operator can add collateral;
- position/tranche identities are isolated and reconstructable;
- failed authorization leaves no Vault or position mutation;
- the source satisfies the existing ComputeStake read interface;
- focused and retained Compute qualification is green on one exact implementation SHA;
- durable evidence records that SHA.

Next canonical step:

**CMP-1.5.2 — Verifier collateral**


## Completion evidence

CMP-1.5.1 is **COMPLETE** at Level 1.

Qualified implementation SHA:

`98a8f71b28048e81a3475e421aca06661eb94217`

Stacked/reconciled CMP-1.5.0 base SHA:

`9a487ebeb24c28ceebfe2f0d794463939956ad9e`

Current `main` observed at closeout:

`cdd5f58f20a3673bb9a81c6210be2a3019e22380`

The current-main delta after the Compute reconciliation was limited to 420Status/Cloudflare files and did not modify Compute, Vault, Compute CI, roadmap, or shared authority dependencies.

Exact-head qualification:

- Compute Market Qualification #86 — run `36927006502` — **PASS**;
- retained Compute Solidity suite — **331 passed, 0 failed, 0 skipped**;
- CMP-1.5.1 worker-collateral verifier — **PASS**;
- Solidity Contracts #3730 — run `36927006455` — **PASS** on the Compute fast path; full repository shards intentionally skipped by Level 1 classification;
- 420Docs Qualification #3939 — run `36927006410` — **PASS**;
- Genesis Address Authority #532 — run `36927006458` — **PASS**;
- 420Registry REG-AUDIT-4 #367 — run `36927006636` — **PASS**;
- 420Indexer #1347 — run `36927006761` — **PASS**.

A superseded earlier head failed only because a Foundry `vm.prank(OPERATOR)` was consumed by the `resources.CPU_GENERAL()` getter in test setup. The corrected test stores that getter result before the prank; protocol behavior and assertions were not weakened.

Durable machine-readable evidence:

`docs/compute-market/CMP-1.5.1-QUALIFICATION-EVIDENCE.json`

This closeout is evidence-only relative to the qualified implementation SHA. It changes no executable source, tests, workflows, dependencies, runtime configuration, interfaces, or deployment state.

Level 2 is not required for this ordinary worker-collateral step. Level 3 remains deferred to **CMP-1.5.13 — Phase closeout**, unless a later shared change independently requires broader qualification.

Next canonical step:

**CMP-1.5.2 — Verifier collateral**
