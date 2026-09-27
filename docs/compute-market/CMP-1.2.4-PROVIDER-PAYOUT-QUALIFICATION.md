# CMP-1.2.4 — Provider claim / actual payout qualification

Status: **COMPLETE within repository-level scope**.

Exact qualified implementation/test head: `a7b9ab20cb7e108cf0b85d95cd3bbc707ccdc0e3` on PR #374.

## Scope closed

CMP-1.2.4 closes the provider-claim and actual external payout boundary for the current fixed-price, single-assignment ComputeMarket path.

A CMP-1.2.3 verified entitlement is converted into real Vault liabilities without reusing the original whole-deposit payer-safety obligation. The funding adapter atomically cancels the original safety obligation and recreates:

1. one provider obligation for the exact verified earned amount; and
2. when the deposit exceeds the earned amount, one separate payer-residual obligation for the unused balance.

The provider obligation is then released to claimable state and may be externally claimed only to the immutable beneficiary frozen at accepted matching. The canonical job is marked `SETTLED` only after the provider claim has actually transferred from the Vault and the settlement evidence verifies the exact payout reference.

The payer residual remains a separate pending payer-beneficiary obligation. CMP-1.2.4 does not make that residual refundable; that is CMP-1.2.5.

## Qualified implementation

- `contracts/src/compute/ComputeVerifiedEntitlement420.sol`
  - records provider claim state separately from the verified entitlement;
  - creates claimability only from the exact existing entitlement;
  - revalidates actionable objective verification/profile/independence state at claim creation and payout;
  - releases the exact provider obligation into claimable state;
  - pays only the frozen beneficiary through `AssetVault420.claim`;
  - records a domain-separated payout reference;
  - exposes settlement evidence only after real external payment;
  - advances the canonical job to `SETTLED` only after successful Vault transfer and accounting reconciliation.

- `contracts/src/compute/ComputeEscrowFunding420.sol`
  - adds a one-time settlement-adapter binding tied to the job registry;
  - atomically splits the whole payer-safety obligation into the exact provider obligation and optional payer residual;
  - proves unchanged Vault balance and total reserved liability during the split;
  - prevents replay or a second allocation from the same payer credit.

- `contracts/src/compute/CMPVaultAuthorization420.sol`
  - adds an optional pre-seal settlement-adapter binding;
  - requires that binding to match the settlement adapter already bound in `ComputeEscrowFunding420`;
  - limits that adapter to provider release/claim actions while preserving the funding adapter as the only constructor of payer-backed obligations;
  - keeps route withdrawal disabled and beneficiary substitution impossible.

## Exact-head executable evidence

Solidity Contracts run `36261381017` completed successfully for exact head `a7b9ab20cb7e108cf0b85d95cd3bbc707ccdc0e3`; **all 16 PR shards completed successfully**.

### CMP-1.2.3 / CMP-1.2.4 combined qualification suite

`contracts/test/ComputeVerifiedEntitlement420.t.sol:ComputeVerifiedEntitlement420Test` — shard 0, job `108458859438`:

**15 passed; 0 failed; 0 skipped**

The seven CMP-1.2.4-specific cases are:

- `testProviderClaimSplitsSafetyIntoClaimableProviderAndPendingPayerResidual`
- `testProviderClaimPaysExactBeneficiaryAndSettlesJob`
- `testWrongBeneficiaryAndReplayCannotDoublePay`
- `testRevokedProfileBlocksClaimCreationAndPayout`
- `testTwoPayerPayoutIsolationPreservesOtherBacking`
- `testMissingSettlementReleaseGrantRollsBackSafetySplit`
- `testExactFundedPayoutCreatesNoResidual`

The original eight CMP-1.2.3 entitlement cases also remained green on the same exact head.

### Exact-head workflows

- Solidity Contracts run `36261381017` — **success**
- 420 Integrated Qualification run `36261380960` — **success**
- 420Docs Qualification run `36261380906` — **success**
- CMP entitlement/payout shard job `108458859438` — **success**

## Security and accounting properties demonstrated

- Provider claimability cannot exist without a previously verified immutable entitlement.
- The original whole-deposit payer-safety obligation cannot be partially released; it is atomically replaced by nonoverlapping provider and payer-residual obligations.
- Claim creation changes no Vault balance and preserves total liability exactly.
- The provider claim amount equals the verified fixed-price earning and cannot exceed the funded/payer-authorized amount.
- The payout recipient is the immutable accepted-match beneficiary.
- Wrong-beneficiary calls cannot consume a claim.
- Replay cannot pay the provider twice.
- Missing provider-release authority rolls back the entire liability split, leaving the original payer-safety obligation intact.
- Revoked verification-profile state blocks both claim creation and external payout.
- One payer's provider payout does not consume another payer's reserved backing.
- Exact-funded jobs produce no synthetic zero-value payer residual.
- A job reaches `SETTLED` only after the Vault external transfer and accounting deltas are proven.

## Qualification boundary

CMP-1.2.4 is **COMPLETE within repository-level scope** for the current fixed-price, single-assignment path.

This closeout does **not** qualify:

- payer residual release/claim after successful under-budget settlement — CMP-1.2.5;
- cancellation/expiry/failure refund economics for accepted or failed jobs — CMP-1.2.5;
- dispute/challenge holds, appeals or slash economics — CMP-1.2.6;
- generalized multi-unit, replica, retry or partial-unit payout allocation;
- live deployment, addresses, runtime hashes, live grants, testnet transactions or ProtocolRegistry publication — CMP-1.2.9.

The exact-head evidence applies to `a7b9ab20cb7e108cf0b85d95cd3bbc707ccdc0e3`. Later documentation or CMP-1.2.5 commits do not alter that qualified implementation boundary.
