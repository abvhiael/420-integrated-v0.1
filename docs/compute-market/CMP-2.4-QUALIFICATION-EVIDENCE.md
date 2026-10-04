# CMP-2.4 — Qualification evidence

Status: **COMPLETE — Level 1 exact-head qualified.**

## Canonical definition

Support fixed-price, work-unit, CPU-time, GPU-time and verified-result pricing.

## Qualified implementation

- Implementation SHA: `880aee2edd699f54467145d7cf99cbde3871a6cc`
- Branch: `cmp-2.1-worker-offers-20261002`
- PR: #490
- Qualification level: **Level 1**
- Repository main observed immediately after qualification: `d37d751dfa232b20c8158d55c20c13cc1d7a10ef`
- Original branch merge base: `c3fbda60247e76f26a7e183069dd6782ed0da038`

## Implementation summary

CMP-2.4 introduced deterministic integer-only pricing for fixed-price, work-unit, CPU-time, GPU-time and
verified-result models; bounded unit-rate/scale/minimum/maximum terms; upward rounding; immutable pricing
commitments; priced offer publication/update; accepted billable-unit/maximum snapshots; and matching-side
budget enforcement. Legacy fixed-price paths remain supported.

Retained verifier compatibility defects discovered during qualification were repaired without weakening
authorization or protocol semantics. The final SDK regression was a stale error-message regex and was
updated to accept the evolved pricing validation wording.

## Exact-head CI evidence

- Compute Market Qualification **#193** — run ID `37100429096` — **SUCCESS**.
- Solidity Contracts **#4530** — run ID `37100429107` — **SUCCESS**.
  - PR classification: success.
  - app-scoped `compute-fast`: success.
  - full repository Foundry and unrelated PR shards: intentionally skipped under Level 1 policy.

All retained CMP verifiers reached the SDK surface on the preceding head; on the final exact head all
required Level 1 gates passed.

## Milestone / deferral

CMP-2.3 already completed the offers/requests/matching Level 2 integration milestone. No additional Level 2
was required for CMP-2.4. Expensive repository-wide Level 3 qualification remains intentionally deferred to
CMP-2.8.

## Completion

**CMP-2.4 COMPLETE.** Next canonical step: **CMP-2.5 — Capacity-aware assignment**.
