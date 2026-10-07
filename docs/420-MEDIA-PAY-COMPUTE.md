# 420Media — Pay and Compute integration

Roadmap step: **MEDIA-AUDIT-7 — Pay and Compute integration**

## Purpose

MEDIA-AUDIT-7 replaces the Phase-1 opaque/legacy settlement and compute assumptions with explicit canonical protocol boundaries.

420Media remains non-custodial and non-authoritative for both protocols:

- 420Pay owns canonical payment and refund state.
- Compute Market owns canonical request/job/match/provider/funding/entitlement/settlement/refund state.
- Media owns only its application lifecycle and mirrors canonical external evidence into that lifecycle.
- No Media component can manufacture a payment, provider entitlement, refund, Compute match, or Compute worker/provider identity.

## Canonical integration contract

`MediaPayComputeAdapter420` is the single Media-facing canonical integration boundary for repository scope.

It is intended to be bound as both the Media settlement vault adapter and payout adapter for canonical Pay/Compute-backed operation.

The adapter:

- never receives or retains native/token value;
- never calls Pay to spend a user wallet;
- never mutates Compute Market;
- reads canonical state, verifies exact Media parties/ceilings, and calls the existing Media settlement coordinator;
- is replay protected at the Media binding layer;
- rechecks canonical evidence at terminal settlement/refund observation.

## Media settlement accounting

The original Phase-1 `MediaSettlement420.amount` remains the funded/reserved ceiling.

MEDIA-AUDIT-7 adds explicit canonical terminal evidence:

- `settledAmounts[jobId]`
- `canonicalSettlementRefs[jobId]`
- `canonicalRefundRefs[jobId]`

`releaseCanonical` records an exact observed settled amount that must be nonzero and no greater than the funded ceiling.

This distinction is required for Compute Market because a funded/accepted ceiling can exceed the ultimately earned provider amount. Media must never report the entire funded ceiling as provider payout when canonical Compute entitlement proves a smaller earned amount.

`refundCanonical` requires canonical refund evidence covering at least the Media funded ceiling.

The existing legacy `release` and `refund` entry points are retained for compatibility with previously-qualified Phase-1 tests and deployments, but the canonical Pay/Compute adapter uses only the exact-evidence paths.

## 420Pay boundary

For a Pay-backed Media job, `bindPayFunding(mediaJobId, paymentId)` requires:

1. Media job status is ACCEPTED.
2. Canonical Media payer is nonzero.
3. Canonical Media operator beneficiary is nonzero.
4. The PaymentRegistry payment exists through a nonzero invoice ID.
5. Payment status is SETTLED.
6. Payment payer exactly equals the Media requester/payer.
7. Payment merchant exactly equals the Media operator settlement beneficiary.
8. Payment settlement amount is nonzero and no greater than Media `maxSpend`.
9. Payment has a nonzero canonical receipt hash.
10. No refund has already been applied.
11. The payment ID has not already funded another Media job.

The Pay payment ID becomes the Media funding reference.

The adapter derives a domain-separated Media vault/evidence reference from the canonical payment ID and receipt. No Pay asset movement is repeated by Media.

### Pay settlement observation

After the Media job becomes claimable, `observePaySettlement` re-reads canonical Pay state and requires the same payer, merchant, amount, settled status, receipt, and zero-refund state before closing Media settlement.

This is an observation of an already-canonical Pay settlement, not a second transfer.

### Pay refund observation

After Media becomes refundable, `observePayRefund` requires canonical Pay status REFUNDED or PARTIALLY_REFUNDED with:

- the same payer;
- the same merchant;
- the same settlement amount;
- canonical refunded amount at least equal to the Media funded ceiling.

Only then may the Media job become REFUNDED.

## Compute Market boundary

The old `MediaOperatorRegistry420.computeProviderRef` is retained only as a compatibility datum.

MEDIA-AUDIT-7 adds the read-only `computeProviderRefOf(operatorId)` view and makes the value authoritative **only when cross-checked against canonical Compute Market state**.

A nonzero opaque value by itself remains insufficient.

### Compute funding binding

`bindComputeFunding(mediaJobId, computeJobId, expectedGraphHash)` requires:

1. exact current `ICompute420.componentGraphHash()` equals the caller-supplied nonzero expected graph hash;
2. Media job is ACCEPTED;
3. Compute job is canonically ACCEPTED;
4. Compute job owner equals Media payer/requester;
5. Compute request, funding and match references are nonzero;
6. canonical Compute funding credit exists, is not refunded/allocated, and belongs to the same owner/payer;
7. canonical funding evidence reports the Compute job funded;
8. canonical accepted match and price reservation agree on job/request/provider/resource;
9. accepted price is nonzero and within both Media max spend and Compute funded credit;
10. Compute payer maximum/funded amount remain within the Media maximum;
11. Compute beneficiary exactly equals the Media operator settlement account;
12. Media operator account exactly equals the canonical Compute match operator;
13. Media `computeProviderRef` exactly equals the canonical Compute provider ID;
14. canonical Compute provider is ACTIVE;
15. canonical Compute provider operator and settlement account agree with the accepted match and Media beneficiary.

The adapter then records Media funding using:

- Compute funding obligation ID as the Media vault reference;
- Compute job ID as the Media funding reference;
- accepted Compute price as the Media funded ceiling.

Media does not reserve or transfer Compute funds itself.

### Compute graph drift

Every terminal Compute settlement/refund observation rechecks the stored canonical Compute graph hash.

If the component graph changes after binding, Media fails closed rather than silently trusting stale component addresses or a historical opaque reference.

### Compute settlement observation

`observeComputeSettlement` requires canonical Compute job status SETTLED plus a canonical verified entitlement whose:

- job/request/match identity matches the binding;
- payer matches Media payer;
- provider/resource match the accepted Media binding;
- beneficiary matches the Media settlement beneficiary;
- accepted amount equals the Media funded ceiling;
- earned amount is nonzero and no greater than the funded ceiling;
- verification reference matches the Compute job;
- canonical settlement adapter reports the settlement reference as settled.

Media records the **earned amount**, not the funded ceiling.

### Compute refund observation

`observeComputeRefund` requires:

- Compute job status REFUNDED;
- canonical Compute refund evidence for the job settlement reference;
- a claimable and paid non-residual payer refund;
- exact Media payer;
- exact payout reference;
- refund amount at least equal to the Media funded ceiling.

Residual refunds after a successful Compute settlement are intentionally not treated as Media job failure/refund.

## Idempotency and replay

- one canonical Pay payment ID may fund at most one Media job;
- one Media job may have only one Pay/Compute binding;
- terminal observation marks the Media binding closed before the external Media callback; EVM rollback preserves retryability if that callback fails;
- MediaSettlement itself rejects duplicate canonical settlement/refund refs;
- canonical Pay and Compute protocols retain their own replay and accounting protections.

## Security invariants

- **MEDIA-ECON-INV-001:** Media never directly custodies Pay/Compute value.
- **MEDIA-ECON-INV-002:** Pay payer and merchant must exactly match Media payer and bound beneficiary.
- **MEDIA-ECON-INV-003:** a Pay payment ID cannot fund two Media jobs.
- **MEDIA-ECON-INV-004:** Pay refund observation requires canonical payer refund coverage.
- **MEDIA-ECON-INV-005:** opaque `computeProviderRef` alone never proves Compute eligibility.
- **MEDIA-ECON-INV-006:** Compute binding requires current canonical graph, accepted match, funding, provider and beneficiary evidence.
- **MEDIA-ECON-INV-007:** Media operator account must equal canonical Compute match operator.
- **MEDIA-ECON-INV-008:** Media beneficiary must equal canonical Compute provider settlement account.
- **MEDIA-ECON-INV-009:** Compute accepted price cannot exceed the Media maximum spend.
- **MEDIA-ECON-INV-010:** final Media settled amount equals canonical earned amount, not automatically the funding ceiling.
- **MEDIA-ECON-INV-011:** terminal Compute refund must be an actual paid payer refund, not merely a cancelled/failed job state.
- **MEDIA-ECON-INV-012:** Compute graph drift fails closed.
- **MEDIA-ECON-INV-013:** terminal callbacks are idempotent and rollback-safe.
- **MEDIA-ECON-INV-014:** Media cannot mutate Pay or Compute canonical state.

## Qualification level

MEDIA-AUDIT-7 is an ordinary roadmap step and is qualified at **Level 1 app-scoped fast qualification**.

No new Level 2 milestone is documented here. The previous MEDIA-AUDIT-5 Level 2 milestone remains the latest retained Media integration milestone.

Level 3 repository-wide closeout remains deferred to MEDIA-AUDIT-11.

## Deferred boundaries

- live Pay/Compute deployment addresses, Registry records, runtime hashes and public-testnet evidence — MEDIA-AUDIT-12;
- final production/Genesis release binding — MEDIA-AUDIT-13;
- public API/SDK transaction preparation — MEDIA-AUDIT-9;
- user-facing wallet/payment/compute UX — MEDIA-AUDIT-10.
