# CMP-1.2.1.3 — Funding lifecycle integrity and provenance closeout

Status: **qualification candidate** on draft PR #371. This substep closes the remaining repository-level evidence for CMP-1.2.1 canonical payer funding without introducing CMP-1.2.2 accepted-price reservation or later settlement economics.

## Scope

CMP-1.2.1.3 proves that the funding evidence created by `ComputeEscrowFunding420` remains attributable to one canonical payer/job credit throughout its permitted lifecycle. It specifically covers evidence reuse, refund invalidation, unsolicited Vault surplus, and historical custody separation.

The step does **not** add or qualify provider payout, accepted quote reservation, matched-job cancellation, dispute economics, slashing, or production deployment. Those remain CMP-1.2.2+ and CMP-1.2.9.

## Required invariants

1. A live payer credit is valid only for its own job, owner, and funding reference.
2. A different job, different owner, zero reference, or foreign funding reference cannot reuse that credit.
3. `ComputeJobRegistry420.recordFunding` must reject a funding reference that belongs to another job.
4. Once an expired unmatched payer credit is lawfully released for refund, `funded()` must immediately become false and the same refund cannot be replayed.
5. Refund release must preserve the exact original payer, amount, and obligation identity.
6. Unsolicited native balance deposited directly into the Vault must remain free/unattributed balance and cannot fabricate a CMP payer credit or satisfy `recordFunding`.
7. Historical/native balance held by the legacy `ComputeJobPayerCustody420` contract must remain economically and evidentially separate from the new Vault-backed `ComputeEscrowFunding420` credits; no implicit migration or synthetic credit is allowed.
8. Existing CMP-1.2.1.1/1.2.1.2 funding, payer isolation, dedicated authorization, hostile-grant, and lifecycle behavior must remain green.

## Executable evidence

The existing named suite `contracts/test/ComputeEscrowFunding420.t.sol:ComputeEscrowFunding420Test` is extended with four lifecycle/provenance cases:

- `testRefundInvalidatesFundingEvidenceAndReplayFailsClosed`
- `testWrongOwnerJobAndFundingReferenceCannotReuseCredit`
- `testUnsolicitedVaultSurplusCannotFabricateJobCredit`
- `testLegacyCustodyBalanceIsNeverImportedAsVaultFunding`

These are in addition to the five pre-existing funding cases already qualified under CMP-1.2.1.1.

The exact-head qualification gate requires the named suite log with explicit pass/fail/skip counts, plus successful Solidity Contracts, 420 Integrated Qualification, and 420Docs Qualification workflows for the implementation head. Source presence or queued workflow status is not sufficient.

## Qualification boundary

CMP-1.2.1.3 may be marked COMPLETE only after exact-head CI confirms the expanded funding suite and the existing CMP escrow regression suites remain green.

Actual deployed addresses, transaction hashes, runtime code hashes, live grant inventory, network funding, and ProtocolRegistry publication are intentionally outside this step and remain CMP-1.2.9.
