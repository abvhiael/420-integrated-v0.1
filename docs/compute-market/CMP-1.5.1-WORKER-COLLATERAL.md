# CMP-1.5.1 — Worker collateral

Status: **IMPLEMENTED. LEVEL 1 QUALIFICATION PENDING.**

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
