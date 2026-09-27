# CMP-1.2.8 — Real end-to-end escrow lifecycle qualification

Status: **COMPLETE within repository-level scope**.

Exact qualified implementation/test head: `4e803611a6b10e69878c16e1c471287310ba4820` on PR #374.

## Scope closed

CMP-1.2.8 proves the already-implemented CMP escrow, settlement, refund and dispute stack as integrated real-contract flows over the dedicated CMP Vault topology.

The qualified transcripts exercise:

- signed owner/payer authorization;
- real native payer funding into the registered CMP Vault;
- funded -> matched -> accepted -> running -> result committed -> verified lifecycle;
- immutable accepted provider beneficiary and accepted price;
- verified entitlement creation;
- provider claim creation with provider/payer liability split;
- challenge finality and provider payout;
- under-budget residual refund to the original payer without reopening SETTLED;
- negative verification -> FAILED -> full original-payer refund -> REFUNDED;
- accepted pre-execution cancellation -> full original-payer refund;
- disputed provider claim -> independent adjudication -> payer win -> exact liability reallocation -> original-payer refund;
- terminal replay rejection and exact final Vault/accounting conservation.

These fixtures use the actual request authority, job registry, funding adapter, accepted-price match, worker evidence, verifier, dispute resolver, settlement adapter, AssetVault420 and VaultAccounting420. They are not mock-custody substitutes.

## Exact-head executable evidence

Exact implementation/test head: `4e803611a6b10e69878c16e1c471287310ba4820`.

- Solidity Contracts run `36289652122` — **success**, all 16 PR shards green.
- 420 Integrated Qualification run `36289652114` — **success**.
- 420Docs Qualification run `36289652117` — **success**.
- CMP integrated shard 1 job `108539068671` — **success**.

`ComputeVerifiedEntitlement420Test` executed **42 passed / 0 failed / 0 skipped**.

CMP-1.2.8-specific end-to-end transcripts:

- `testE2ERealFundedVerifiedSettledAndResidualRefundTranscript`
- `testE2ERealNegativeVerificationToFullOriginalPayerRefundTranscript`
- `testE2ERealAcceptedCancellationToOriginalPayerRefundTranscript`
- `testE2ERealDisputedProviderClaimPayerWinAndRefundTranscript`

All prior CMP-1.2.3 through CMP-1.2.7 entitlement, payout, refund, dispute and hostile-accounting tests remained green on the same exact head.

## Qualification boundary

CMP-1.2.8 is **COMPLETE within repository-level scope** for the current native-$420, fixed-price, single-assignment path.

Excluded from this closeout:

- live testnet deployment, address/code-hash and registry-publication evidence — CMP-1.2.9;
- final phase reconciliation and release closeout — CMP-1.2.10;
- generalized multi-unit, replica, retry or partial-entitlement economics beyond this fixed-price path.
