# CMP-1.2.7 — Solvency, reentrancy and privilege hardening qualification

Status: **COMPLETE within repository-level scope**.

Exact qualified implementation/test head: `618c461df376294440239d1b0ce7d5e236871bd4` on PR #374.

## Scope closed

CMP-1.2.7 hardens the fixed-price, single-assignment CMP settlement stack against hostile accounting and privilege expansion across the real dedicated CMP Vault topology.

The qualified implementation and tests prove:

- native Vault solvency: recorded native balance equals actual Vault balance and reserved + claimable never exceeds recorded balance;
- two-payer isolation across mixed provider-payment and payer-refund terminal paths;
- donor/free-balance surplus cannot enlarge authenticated job credit or back another payer's liability;
- sealed CMP Vault policy rejects hostile post-seal CREATE, RELEASE, CANCEL, CLAIM and WITHDRAW grant expansion, including route withdrawal;
- provider and payer claims cannot bypass pending-obligation/dispute gates through direct Vault access;
- failed native provider transfer rolls back the entire settlement transaction and leaves job, obligation, accounting and balances unchanged;
- malicious beneficiary callback cannot reenter direct Vault claim or settlement payout and cannot double-pay;
- frozen Vault blocks settlement without mutating held liability and lawful payout resumes after unfreeze;
- WINDING_DOWN permits resolution of already-existing liabilities while close remains blocked until all canonical balance/liability is cleared;
- payout/refund replay, wrong-beneficiary, wrong-payer and cross-job entitlement reuse continue to fail closed;
- failed/unauthorized hostile operations do not consume unrelated payer backing.

## Exact-head executable evidence

Exact implementation/test head: `618c461df376294440239d1b0ce7d5e236871bd4`.

- Solidity Contracts run `36282026678` — **success**, all 16 PR shards green.
- 420 Integrated Qualification run `36282026679` — **success**.
- 420Docs Qualification run `36282026669` — **success**.
- CMP entitlement/refund/dispute/hostile-accounting shard 1 job `108515562827` — **success**.

`ComputeVerifiedEntitlement420Test` executed **38 passed / 0 failed / 0 skipped**.

CMP-1.2.7-specific hostile cases include:

- `testHostileGrantsCannotExpandSealedCMPVaultAuthority`
- `testDonorSurplusCannotBackOrIncreaseJobSpecificLiability`
- `testFrozenVaultBlocksPayoutWithoutMutatingHeldLiabilityThenRecovers`
- `testWindingDownAllowsExistingSettlementButCannotCloseWithLiability`
- `testReentrantBeneficiaryCannotDoubleClaimOrReenterSettlement`
- `testRejectedNativeProviderTransferRollsBackSettlementAndAccounting`
- `testTwoPayerMixedSettlementAndRefundRemainExactlySolvent`

All prior CMP-1.2.3 through CMP-1.2.6 entitlement, payout, refund and dispute cases remained green on the same exact head.

## Qualification boundary

CMP-1.2.7 is **COMPLETE within repository-level scope** for the fixed-price, single-assignment path.

Excluded from this closeout:

- generalized multi-unit, replica, retry or partial-entitlement economics;
- live hostile token assets beyond the current native-$420 fixed-price path;
- full real end-to-end fixture closeout — CMP-1.2.8;
- deployment/testnet/registry publication — CMP-1.2.9;
- final phase reconciliation and release closeout — CMP-1.2.10.
