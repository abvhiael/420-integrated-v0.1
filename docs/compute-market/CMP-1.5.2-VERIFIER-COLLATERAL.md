# CMP-1.5.2 — Verifier collateral

Status: **IMPLEMENTED. LEVEL 1 QUALIFICATION PENDING.**

## Canonical definition

The controlling roadmap defines CMP-1.5.2 exactly as:

> Verifier collateral

CMP-1.5.2 adds verifier-owned collateral positions and current-position reads only. It does not collapse policy-specific minimums, exit/withdrawal, slash authorization/distribution, rewards, dispute integration, WorkerRegistry stake-source integration, escrow redistribution, hostile qualification, release-candidate or phase-closeout work.

## Canonical implementation

Runtime:

`contracts/src/compute/ComputeStakeVerifierCollateral420.sol`

Read interface:

`contracts/src/interfaces/IComputeVerifierStakeSource420.sol`

The implementation:

- binds collateral to the canonical `ComputeVerifierRegistry420` verifier identity;
- accepts native $420 only from the verifier's current canonical authority;
- rejects retired verifier identities;
- deposits every amount into the registered canonical `VAULT_COLLATERAL` `AssetVault420`;
- creates one immutable Vault obligation per verifier-collateral tranche;
- keeps each verifier/stake-policy position isolated;
- preserves collateral across lifecycle revision changes when the authority is unchanged;
- creates a distinct position after verifier authority rotation so economic ownership is never silently transferred;
- exposes current-position reads for later collateral-policy and verification integration.

At this step, `activeAmount == slashableAmount`. Exit and slash transitions are deliberately owned by later CMP-1.5 steps.

## Rotation boundary

Verifier authority rotation is economically significant. The position identity binds:

- chain;
- verifier-collateral contract;
- verifier ID;
- current authority;
- stake-policy reference.

It intentionally does **not** bind every lifecycle revision, because activation/suspension/reactivation must not orphan otherwise valid collateral owned by the same authority.

When authority changes:

- the old position remains queryable and backed;
- its beneficiary remains the old authority;
- the new authority does not inherit the old active amount;
- the new authority may open a new separately backed position;
- later exit/slash logic must resolve old positions without rewriting history.

## Authority and accounting boundaries

- Verifier registration/lifecycle remains authoritative in `ComputeVerifierRegistry420`.
- Verifier capability/class/appointment remains independently authoritative and is not implied by collateral.
- 420Vault remains the custody/accounting authority.
- The verifier collateral source never treats its own ETH balance as canonical collateral.
- A stake succeeds only if native Vault deposit and exact obligation creation both succeed atomically.
- Missing Vault authorization reverts all state changes.
- No withdrawal, slash, reward, beneficiary redirection or payer-escrow authority is introduced.

## Focused qualification

`contracts/test/ComputeStakeVerifierCollateral420.t.sol` covers:

- canonical Vault obligation backing;
- recorded/reserved balance parity;
- top-up persistence across lifecycle revisions;
- authority-rotation isolation;
- policy-position isolation;
- unauthorized authority rejection;
- retired-verifier rejection;
- missing Vault-create grant atomic rollback;
- direct-ETH rejection.

Mechanical verifier:

`scripts/verify-cmp-1-5-2-verifier-collateral.py`

Machine-readable step record:

`contracts/config/compute-market/cmp-1.5.2-verifier-collateral.json`

## Exit criteria

CMP-1.5.2 is COMPLETE only when:

- verifier deposits are canonically Vault-backed;
- only the exact current verifier authority may add collateral;
- lifecycle revisions with the same authority preserve the position;
- authority rotation cannot transfer prior collateral;
- verifier/policy positions and tranches are reconstructable and isolated;
- failed authorization leaves no Vault or position mutation;
- exact-head Level 1 Compute qualification passes;
- durable evidence records the qualified implementation SHA.

Next canonical step:

**CMP-1.5.3 — Policy-specific minimum collateral**
