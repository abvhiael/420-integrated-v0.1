# CMP-1.2.2 — Accepted-price reservation and spending-limit qualification

Status: **COMPLETE within repository-level scope**.

Exact qualified implementation/test head: `4933beb6284dfbf93aea8e827719b2960d0226f4` on PR #371.

## Scope closed

CMP-1.2.2 establishes the repository-level canonical accepted-price boundary for paid ComputeMarket admission. A job may reach priced acceptance only when the immutable fixed-price offer is bound to the exact provider/resource revision and the accepted amount is simultaneously bounded by:

1. the payer's signed `maxSpend`;
2. the actual job-specific Vault-backed `ComputeEscrowFunding420` credit;
3. the amount limit of the scoped `ACTION_ACCEPT_MATCH` capability.

The accepted record freezes the payer, provider, resource revision, provider-derived beneficiary, pricing policy/version, accepted amount, funded amount, and payer maximum. This step creates **no provider earnings and performs no payout**. Conversion of an accepted reservation into verified earnings remains CMP-1.2.3.

## Qualified implementation

- `contracts/src/compute/ComputeOfferRegistry420.sol`
  - immutable fixed native-$420 offer publication for this increment;
  - binds provider, node, concrete resource, provider/resource revisions, operator, settlement beneficiary, pricing policy/version, fixed price, and expiry;
  - later provider/resource drift or cancellation prevents new acceptance.

- `contracts/src/compute/ComputeAcceptedPriceMatch420.sol`
  - binds job/request/manifest to an exact offer/resource;
  - requires the real `ComputeEscrowFunding420` adapter and exact bound job registry;
  - checks accepted price against both signed payer maximum and actual funded job credit;
  - passes accepted amount into the scoped `ACTION_ACCEPT_MATCH` authorization check;
  - writes one unique price reservation per job before `recordAcceptance`;
  - freezes provider-derived beneficiary and accepted economic terms;
  - does not release Vault funds or create provider entitlement.

## Exact-head executable evidence

Solidity Contracts run `36197680782` completed successfully for exact head `4933beb6284dfbf93aea8e827719b2960d0226f4`; all 16 PR shards completed successfully.

### New CMP-1.2.2 suite

`contracts/test/ComputeAcceptedPriceMatch420.t.sol:ComputeAcceptedPriceMatch420Test` — shard 2, job `108279547002`:

**7 passed; 0 failed; 0 skipped**

- `testAcceptanceCapabilityAmountLimitFailsClosedThenExactLimitSucceeds`
- `testAcceptedBeneficiaryAndPriceRemainFrozenAfterProviderRevision`
- `testCancelledOfferAndStaleResourceCannotConsumePriceReservation`
- `testExactQuoteReservesOnlyWithinSignedAndActuallyFundedCredit`
- `testQuoteAboveActualJobCreditFailsEvenWithDonorSurplus`
- `testQuoteAboveSignedMaximumFailsWithoutReservation`
- `testWrongOfferResourceAndCrossJobEvidenceFailClosed`

### Funding and Vault regressions on the same exact head

- `ComputeEscrowFunding420Test` — shard 5, job `108279546978`: **9 passed; 0 failed; 0 skipped**.
- `ComputeEscrowFencedCapability420Test` — shard 4, job `108279547063`: **6 passed; 0 failed; 0 skipped**.

### Exact-head workflows

- Solidity Contracts: https://github.com/abvhiael/420-integrated-v0.1/actions/runs/36197680782 — **success**
- 420 Integrated Qualification: https://github.com/abvhiael/420-integrated-v0.1/actions/runs/36197680589 — **success**
- 420Docs Qualification: https://github.com/abvhiael/420-integrated-v0.1/actions/runs/36197680701 — **success**
- CMP-1.2.2 shard: https://github.com/abvhiael/420-integrated-v0.1/actions/runs/36197680782/job/108279547002
- Funding regression shard: https://github.com/abvhiael/420-integrated-v0.1/actions/runs/36197680782/job/108279546978
- Fenced-Vault regression shard: https://github.com/abvhiael/420-integrated-v0.1/actions/runs/36197680782/job/108279547063

## Security properties demonstrated

- A quote cannot exceed the payer's signed maximum.
- A quote cannot exceed that job's actual Vault-backed payer credit.
- Unsolicited Vault free balance/donor surplus cannot make another payer's underfunded job acceptable.
- Capability-grant amount limits are checked against the accepted price.
- A cancelled offer cannot consume a price reservation.
- A stale resource revision cannot consume a price reservation.
- A later provider revision cannot rewrite the already accepted beneficiary or price.
- Wrong resource/offer bindings fail closed.
- Accepted match/price evidence cannot be replayed across jobs.
- Acceptance does not move Vault funds or fabricate provider earnings.

## Qualification boundary

CMP-1.2.2 is **COMPLETE within repository-level scope**. The repository now contains executable, deployment-realistic fixed-price admission logic and exact-head adversarial evidence for accepted-price reservation and spending limits.

This does **not** qualify:

- verified provider earnings or unique entitlement conversion — CMP-1.2.3;
- provider claim/payout — CMP-1.2.4;
- matched cancellation/failure/refund economics — CMP-1.2.5;
- dispute/challenge/slash economics — CMP-1.2.6;
- live deployment, addresses, runtime hashes, live grants, testnet transactions, or ProtocolRegistry publication — CMP-1.2.9.

Foundry emitted non-failing lint warnings including timestamp comparisons, event-after-external-call diagnostics, the one-time jobs binding lacking a dedicated event, and the explicit `uint64(block.timestamp)` cast. These did not fail Solidity qualification and do not alter the executable evidence above.
