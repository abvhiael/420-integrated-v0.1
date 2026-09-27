# CMP-1.2.5 — Cancellation, expiry, failure and payer-refund qualification

Status: **COMPLETE within repository-level scope**.

Exact qualified implementation/test head: `9a9be3a55d824231cebf3f6d87ec08261c19f4a4` on PR #374.

## Scope closed

CMP-1.2.5 closes the payer-bound refund path for the current fixed-price, single-assignment ComputeMarket implementation:

- requester cancellation before irrevocable execution;
- permissionless deadline expiry before execution begins;
- objectively failed/negative verification with zero provider earning;
- full original-payer refund for unsuccessful terminal jobs; and
- separate under-budget residual refund after a successful `SETTLED` provider payout without reopening the job.

Refund evidence distinguishes payer claimability from actual external payment. `REFUNDED` is recorded only after the original payer actually claims the unsuccessful-job refund from the Vault. A successful `SETTLED` job remains `SETTLED` while its unused residual is refunded separately.

## Exact-head executable evidence

Exact head: `9a9be3a55d824231cebf3f6d87ec08261c19f4a4`.

- Solidity Contracts run `36264877005` — **success**, all 16 PR shards green.
- 420 Integrated Qualification run `36264876973` — **success**.
- 420Docs Qualification run `36264877087` — **success**.
- CMP entitlement/payout/refund shard 0 job `108467527776` — **success**.

`ComputeVerifiedEntitlement420Test` executed **22 passed / 0 failed / 0 skipped**.

CMP-1.2.5-specific cases:

- `testAcceptedExpiryIsPermissionlessDeadlineProvenAndRefundable`
- `testNegativeVerificationRefundsFullPayerAndTransitionsRefunded`
- `testRequesterCancellationBeforeRunningRefundsAndOutsiderCannotCancel`
- `testRunningJobCannotBeCancelledOrExpiredByRefundPath`
- `testSettledUnderBudgetResidualRefundPaysOriginalPayerWithoutReopeningJob`
- `testTwoPayerTerminalRefundIsolationPreservesOtherSafetyObligation`
- `testWrongPayerAndRefundReplayCannotDoublePay`

The prior CMP-1.2.3 entitlement and CMP-1.2.4 provider-payout cases remained green on the same exact head.

## Qualified behavior

- Only the canonical requester can cancel a funded/matched/accepted job before execution.
- Cancellation cannot erase a RUNNING or RESULT_COMMITTED execution path.
- Expiry requires the canonical deadline to have passed and is permissionless only before execution.
- Negative verification routes the job to `FAILED` and creates no provider entitlement.
- Unsuccessful terminal refunds are bound to the original authenticated payer and exact backed obligation.
- Wrong-payer claims fail without moving Vault funds.
- Refund replay cannot pay twice.
- A successful under-budget provider payout preserves `SETTLED`; only the separately reserved payer residual is released and paid.
- Two payer jobs remain economically isolated through terminal refunds.
- Actual Vault/native balance and obligation/accounting transitions are checked around refund payment.

## Qualification boundary

CMP-1.2.5 is **COMPLETE within repository-level scope** for the fixed-price, single-assignment path.

Excluded from this closeout:

- challenge/dispute holds and contested-liability resolution — CMP-1.2.6;
- hostile solvency/reentrancy/privilege hardening — CMP-1.2.7;
- generalized multi-unit, replica, retry or partial-entitlement economics;
- live deployment/testnet/registry publication — CMP-1.2.9.

The exact-head evidence applies to `9a9be3a55d824231cebf3f6d87ec08261c19f4a4`. Later CMP-1.2.6 commits do not alter this historical qualification boundary.
