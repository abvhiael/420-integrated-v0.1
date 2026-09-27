# CMP-1.2.6 — Dispute holds, adjudication and contested-liability qualification

Status: **COMPLETE within repository-level scope**.

Exact qualified implementation/test head: `5175a9c3293fd0e7959c0d5747c3d56b35b7e4c2` on PR #374.

## Scope closed

CMP-1.2.6 closes the current fixed-price, single-assignment challenge/dispute path:

- immutable versioned dispute policy frozen at match acceptance;
- finite challenge, response, decision and appeal windows;
- one bounded dispute case per contested job;
- canonical `VERIFIED -> DISPUTED -> VERIFIED|FAILED` lifecycle branch;
- provider obligation remains pending through challenge finality;
- direct Vault claim cannot bypass the dispute gate;
- independent, scoped adjudicator authority;
- separately authorized appeal adjudicator;
- provider-win resumption to the same pending earning;
- payer-win reallocation of only the contested job's pending provider/residual liabilities to the original payer;
- fail-closed timeout to payer rather than automatic provider payout;
- withdrawn challenge restores the same provider entitlement without duplication;
- cross-payer liability isolation.

No slash redistribution is implemented in this fixed-price policy because no preaccepted stake/bond penalty schedule exists. The implementation therefore fails closed instead of inventing an economic penalty recipient.

## Exact-head executable evidence

Exact head: `5175a9c3293fd0e7959c0d5747c3d56b35b7e4c2`.

- Solidity Contracts run `36273468230` — **success**, all 16 PR shards green.
- 420 Integrated Qualification run `36273468271` — **success**.
- 420Docs Qualification run `36273468412` — **success**.
- CMP entitlement/payout/refund/dispute shard 1 job `108491645128` — **success**.

`ComputeVerifiedEntitlement420Test` executed **31 passed / 0 failed / 0 skipped**.

CMP-1.2.6-specific cases include:

- `testTimelyPayerChallengeHoldsSpecificProviderLiabilityUntilProviderWinFinality`
- `testProviderCannotBypassChallengeGateThroughDirectVaultClaim`
- `testPayerWinReallocatesOnlyContestedJobToFullOriginalPayerRefund`
- `testAppealUsesDifferentIndependentAdjudicatorAndOverturnsUnreleasedDecision`
- `testUnauthorizedOrInterestedAdjudicatorCannotResolveHeldCase`
- `testExpiredChallengeCannotReopenAndUnchallengedClaimSettlesAfterWindow`
- `testDisputeTimeoutFailsClosedToPayerInsteadOfAutomaticProviderPayment`
- `testWithdrawnChallengeReleasesSamePendingProviderEntitlementWithoutDuplication`
- `testDisputeAndPayerWinRemainIsolatedAcrossTwoPayers`

All prior CMP-1.2.3 through CMP-1.2.5 entitlement, provider-payout, cancellation, expiry and payer-refund cases remained green on the same exact head.

## Qualification boundary

CMP-1.2.6 is **COMPLETE within repository-level scope** for the fixed-price, single-assignment path.

Excluded from this closeout:

- generalized multi-unit, replica, retry or partial-entitlement disputes;
- stake slash/bond redistribution without a separately accepted slash policy;
- hostile solvency/reentrancy/privilege hardening — CMP-1.2.7;
- full real E2E fixtures — CMP-1.2.8;
- live deployment/testnet/registry publication — CMP-1.2.9.
