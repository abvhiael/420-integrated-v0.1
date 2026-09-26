# CMP-1.2.3 — Verified earnings / unique provider entitlement qualification

Status: **COMPLETE within repository-level scope**.

Exact qualified implementation/test head: `d5366cb06727f1c0f849b792bbfa1c0037066dfb` on PR #374.

## Scope closed

CMP-1.2.3 converts one canonically accepted fixed-price job into one immutable provider earning entitlement only after the real paid-compute path has reached objective, independently authorized `VERIFIED` state.

The qualified path binds the entitlement to the exact job, request, accepted match, accepted price reservation, payer, provider, resource, frozen beneficiary, pricing policy/version, result commitment, verifier and verification decision. The earned amount is the accepted fixed price and must remain bounded by both the job-specific funded credit and payer maximum.

Entitlement finalization revalidates the approved objective verification profile and current verifier-independence appointment/controller state. A historical `VERIFIED` status alone is therefore insufficient to create economic entitlement after profile revocation or controller withdrawal.

Exactly one entitlement may exist per job. Entitlement creation does not release, claim, withdraw or otherwise move Vault funds, and it deliberately does not satisfy the job registry's `SETTLED` transition.

## Qualified implementation

- `contracts/src/compute/ComputeVerifiedEntitlement420.sol`
  - creates one immutable entitlement per verified job;
  - binds exact verification, result, price reservation and provider-derived beneficiary;
  - checks earned amount against accepted/funded/payer ceilings;
  - requires scoped `ACTION_SETTLE` authority for the exact earned amount;
  - revalidates live objective profile and verifier-independence eligibility;
  - exposes queryable entitlement evidence;
  - leaves `settled()` false because payout is CMP-1.2.4.

- `contracts/src/compute/IComputeAcceptedMatchRuntime420.sol` plus compatibility changes in the worker/verifier stack
  - provide a minimal runtime ABI shared by legacy and priced accepted-match implementations;
  - allow the already-qualified worker/verification path to execute against `ComputeAcceptedPriceMatch420` without depending on either match contract's private struct layout.

## Exact-head executable evidence

Solidity Contracts run `36220578024` completed successfully for exact head `d5366cb06727f1c0f849b792bbfa1c0037066dfb`; **all 16 PR shards completed successfully**.

### CMP-1.2.3 suite

`contracts/test/ComputeVerifiedEntitlement420.t.sol:ComputeVerifiedEntitlement420Test` — shard 0, job `108344948354`:

**8 passed; 0 failed; 0 skipped**

- `testAcceptedBeneficiaryCannotBeRedirectedAfterVerification`
- `testMissingOrUnderLimitSettlementAuthorityCannotFinalize`
- `testNegativeVerificationCannotCreateProviderEarning`
- `testReplayAndCrossJobEntitlementReuseFailClosed`
- `testRevokedVerificationProfileBlocksEconomicFinalizationUntilRestored`
- `testTwoPayersRemainConservedWhileIndependentEarningsAccrue`
- `testVerifiedFixedPriceCreatesOneImmutableEntitlementWithoutVaultMovement`
- `testWithdrawnVerifierIdentityBlocksEconomicFinalization`

### Exact-head workflows

- Solidity Contracts run `36220578024` — **success**
- 420 Integrated Qualification run `36220577982` — **success**
- 420Docs Qualification run `36220577998` — **success**
- CMP-1.2.3 shard/job: `108344948354`

## Security properties demonstrated

- A failed objective verification cannot create provider earnings.
- A revoked verification profile cannot create economic entitlement.
- A withdrawn verifier identity/controller cannot create economic entitlement.
- Missing or under-limit settlement capability cannot finalize the accepted earning.
- One job creates at most one entitlement; replay cannot increase total verified earnings.
- Entitlement evidence cannot be reused across jobs.
- Two unrelated payer credits remain independently conserved while separate provider earnings are recorded.
- Provider account/beneficiary changes after acceptance cannot redirect the frozen accepted beneficiary.
- Entitlement creation leaves the real Vault balance and reserved payer-safety obligation unchanged.
- `VERIFIED` and `SETTLED` remain distinct states.

## Qualification boundary

CMP-1.2.3 is **COMPLETE within repository-level scope** for the current fixed-price, single-assignment job model.

This closeout does **not** qualify:

- provider claim creation, Vault liability split, claimability or actual external payout — CMP-1.2.4;
- payer residual refund/cancellation/failure/expiry economics — CMP-1.2.5;
- challenge/dispute holds, appeals or slash economics — CMP-1.2.6;
- generalized multi-unit, replica, retry or partial-unit earning formulas beyond the currently implemented single fixed-price entitlement model;
- live deployment, addresses, runtime hashes, live grants, network transactions or ProtocolRegistry publication — CMP-1.2.9.

The exact-head evidence applies to `d5366cb06727f1c0f849b792bbfa1c0037066dfb`. Documentation commits recording this evidence do not retroactively change the qualified implementation head.
