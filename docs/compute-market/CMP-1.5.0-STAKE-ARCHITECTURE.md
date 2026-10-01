# CMP-1.5.0 — Stake architecture

Status: **IMPLEMENTED. LEVEL 1 QUALIFICATION PENDING. NO LIVE COLLATERAL/DEPLOYMENT CLAIM.**

## Canonical definition

The controlling Compute Market roadmap defines CMP-1.5.0 exactly as:

> Reuse canonical $420 custody/accounting. Do not create an unrelated collateral treasury.

Parent CMP-1.5 is the **ComputeStake** phase and canonically owns `stake()`, `unstake()`, `requestExit()`, `slash()`, and `reward()`.

CMP-1.5.0 is an architecture/reconciliation gate. It freezes custody, accounting and authority boundaries before worker or verifier collateral mutation is implemented. It does not implement the runtime functions owned by later CMP-1.5.x steps.

## Repository baseline

Baseline `main`:

`f6c4d082f60d2ac706a941c9289ed7a7309cf3ab`

Relevant existing repository truth:

- `IComputeStakeSource420` is a narrow worker-collateral read interface for the future CMP-1.5 source.
- `ComputeWorkerStake420` is a fail-closed admission/snapshot consumer and explicitly owns no custody or slash authority.
- `VaultRegistry420`, `AssetVault420`, `VaultAccounting420`, and `VaultIds420` are the canonical 420Vault custody/accounting family.
- `VaultIds420.VAULT_COLLATERAL` already defines the canonical collateral Vault type.
- CMP-1.2 already uses the 420Vault family for payer funding and explicitly requires slash redistribution to come from separately backed CMP-1.5 collateral rather than payer deposits.
- `Stake420` is the validator-economic read facade and is not a ComputeStake implementation or acceptable Compute collateral source.
- CMP-1.4 challenge/appeal output is evidence only. It cannot itself authorize a slash.

## Gap analysis

### Already satisfied

The repository already provides the primitives needed to avoid inventing another custody stack:

1. canonical Vault registration and lifecycle;
2. canonical native-$420 custody through `AssetVault420`;
3. canonical balance/obligation accounting through `VaultAccounting420`;
4. a collateral Vault type;
5. narrow worker admission reads for a future ComputeStake source;
6. payer-escrow separation rules;
7. objective-evidence requirements for future slashing.

### Missing before CMP-1.5.0

No durable ComputeStake architecture freeze specified:

- which canonical custody family must hold Compute collateral;
- whether Compute collateral may share payer escrow liabilities;
- whether validator stake or wallet balance can substitute;
- how position backing relates to Vault obligations/accounting;
- which authority owns stake lifecycle semantics versus custody/release;
- how later worker/verifier/policy/exit/slash/reward steps divide responsibility;
- which invariant set must survive the phase.

CMP-1.5.0 closes exactly those architecture gaps. No staking runtime contract is required by this step.

## Canonical custody model

Machine-readable authority:

`contracts/config/compute-market/cmp-1.5.0-stake-architecture.json`

### One custody/accounting family

Compute collateral must use the existing **420Vault** family:

- `VaultRegistry420` — registered Vault identity and lifecycle;
- `AssetVault420` — actual native-$420 custody/release;
- `VaultAccounting420` — recorded balance, reserved, claimable and obligation accounting;
- `VaultIds420.VAULT_COLLATERAL` — collateral Vault classification.

The architecture selects a **dedicated Compute collateral Vault instance** inside that family. A separate instance isolates collateral liabilities from payer escrow obligations, but it is not a second treasury, second accounting ledger or free-standing staking wallet.

No future `ComputeStake420` implementation may keep the authoritative collateral balance only in its own mapping or contract balance.

### Native $420

The canonical collateral asset is native `$420`, represented by the Vault native-asset path (`address(0)`). Later implementation must prove actual Vault balance/accounting parity for every admitted position.

### Payer escrow separation

Compute payer funding and Compute collateral are distinct liability domains:

- payer funds remain backed by the CMP escrow Vault path;
- worker/verifier collateral remains backed by the Compute collateral Vault;
- neither may be silently reclassified, netted or used to cover the other;
- slash redistribution must originate from actually forfeited collateral, never payer deposits.

### Position backing

Every active/slashable collateral position must be backed by canonical Vault state and a unique position-bound obligation/accounting identity.

A future position identity must bind, at minimum:

- participant class;
- worker or verifier identity;
- policy ID/revision;
- position serial/revision;
- Vault identity;
- asset;
- owner/beneficiary;
- active amount;
- slashable amount;
- exit/withdrawal state.

One position may not consume, withdraw or slash another participant's backing.

## Authority boundary

The future ComputeStake layer owns **collateral lifecycle semantics**. 420Vault owns **custody/release/accounting**.

ComputeStake may eventually instruct narrowly authorized Vault operations, but must not gain:

- arbitrary withdrawal;
- arbitrary recipient substitution;
- generic Vault transfer;
- Treasury budget/disbursement authority;
- payer-escrow spending;
- validator admission/consensus authority;
- Civic voting authority;
- bridge or arbitrary-wallet authority.

A separate bounded collateral authorization policy is expected in later implementation, but CMP-1.5.0 does not deploy it.

## Non-substitutes

The following do not satisfy Compute collateral:

- validator bond state from `Stake420` / `ValidatorRegistry`;
- current wallet balance;
- payer-funded ComputeEscrow credit;
- Treasury budgets;
- 420Trust/reputation;
- a verifier verdict or challenge record without independently qualified final slash authorization.

The existing `ComputeWorkerStake420` compatibility marker remains fail-closed and correctly rejects validator-stake-like surfaces.

## Lifecycle architecture

### stake()

Future staking must atomically move participant-origin native $420 into the registered collateral Vault and establish/increase the exact position backing. A successful call cannot leave an unbacked internal balance.

### requestExit()

Exit request freezes the applicable policy/revision and withdrawal timing. Collateral remains canonically backed and slashable to the extent defined by the accepted policy until the withdrawal boundary is satisfied.

### unstake()

Unstake may release only matured, non-forfeited collateral to the immutable position owner/beneficiary after required delay and dispute/slash locks. No administrator may substitute itself as recipient.

### slash()

Slash may consume only the exact subject's objectively proven, final, policy-bound slashable collateral. An allegation, active/nonfinal dispute, reputation score, arbitrary governance direction or verifier signature alone is insufficient.

### reward()

Reward accounting must use a separately authorized reward source and canonical backing. It cannot mint through ComputeStake, seize payer escrow or fabricate Vault balance.

## Canonical substep ownership

CMP-1.5.0 does not collapse later roadmap work:

| Step | Canonical owner |
| --- | --- |
| CMP-1.5.1 | Worker collateral |
| CMP-1.5.2 | Verifier collateral |
| CMP-1.5.3 | Policy-specific minimum collateral |
| CMP-1.5.4 | Exit queue / withdrawal delay |
| CMP-1.5.5 | Objective slash authorization |
| CMP-1.5.6 | Slash distribution |
| CMP-1.5.7 | Reward accounting |
| CMP-1.5.8 | Dispute/stake integration |
| CMP-1.5.9 | WorkerRegistry stake-source integration |
| CMP-1.5.10 | ComputeEscrow slash-redistribution integration |
| CMP-1.5.11 | Hostile economic qualification |
| CMP-1.5.12 | Release candidate |
| CMP-1.5.13 | Phase closeout |

## Frozen invariant mapping

CMP-1.5 architecture explicitly preserves:

- **CMP-INV-005** — stake identity/lifecycle grants no unrelated authority;
- **CMP-INV-009/010** — collateral cannot expand payer cap or change accepted settlement beneficiary;
- **CMP-INV-013/018/019** — terminal/entitlement isolation prevents duplicate or cross-party consumption;
- **CMP-INV-020** — suspension cannot confiscate already-valid historical entitlement;
- **CMP-INV-021** — provider stake moves only through defined stake/withdraw/slash paths;
- **CMP-INV-022** — slashing requires objective evidence under a bound versioned policy;
- **CMP-INV-023** — Trust remains evidence, not custody/slash authority;
- **CMP-INV-025** — emergency authority is non-confiscatory;
- **CMP-INV-026** — historical accepted state remains reconstructable;
- **CMP-INV-028/029** — later capability/identity changes cannot rewrite accepted semantics;
- **CMP-INV-030** — Compute collateral remains provider-neutral and non-AI workloads remain first-class.

## Security and deployment disposition

CMP-1.5.0 changes no production Solidity behavior and creates no:

- new fixed Genesis predeploy;
- live ComputeStake address;
- live collateral Vault address;
- ProtocolRegistry publication;
- Vault grant;
- stake balance;
- slash;
- reward credit.

Later implementation must add executable tests for solvency, isolation, exit races, slash finality, replay, duplicate withdrawal/slash/reward, hostile authorization, reentrancy and failure atomicity.

## Level 1 qualification

CMP-1.5.0 is an ordinary roadmap step. Required qualification is app-scoped:

1. affected Compute contracts compile;
2. retained `Compute*.t.sol` suite passes;
3. `verify-cmp-1-5-0-stake-architecture.py` passes;
4. relevant documentation qualification passes when triggered;
5. exact-head CI evidence is recorded.

Repository-wide Foundry inventory, Genesis closeout and 420 Integrated/global closeout are intentionally deferred to the CMP-1.5 phase closeout unless a later step materially changes those shared surfaces.

## Exit criteria

CMP-1.5.0 is COMPLETE only when:

- the exact canonical roadmap definition is preserved;
- 420Vault is frozen as the sole custody/accounting family for Compute collateral;
- the dedicated collateral Vault is explicitly separated from payer escrow without becoming a parallel treasury;
- validator stake, wallet balance, payer credit and reputation are explicit non-substitutes;
- later CMP-1.5.1–1.5.13 ownership is preserved;
- relevant invariants and authority boundaries are recorded;
- the architecture verifier and Level 1 exact-head qualification pass;
- durable evidence records the qualified implementation SHA.

Next canonical step after completion:

**CMP-1.5.1 — Worker collateral**
