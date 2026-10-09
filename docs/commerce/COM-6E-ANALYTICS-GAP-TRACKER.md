# COM-6E — Analytics and COM-6 phase requirements (gap and qualification tracker)

Date: 2026-10-09. Canonical parent: COM-6 Merchant operations in `docs/commerce/COM-1-ARCHITECTURE-AND-ROADMAP.md`. This document does not renumber the canonical roadmap. PR #594 remains draft and unmerged.

## Verified starting point

At audit HEAD `781c29f9f82b6bae93b85285383856887e956d4c`, `commerce/src/service.mjs` implements `merchantAnalytics` by calling `merchantOperations` with offset 0 and limit 100. The response correctly states `scope: first_100_attempts_only` and `partial` when more rows exist. `merchantOperations` already supports offset/limit internally, but HTTP does not expose those query parameters. No full historical merchant analytics is proven. `commerce/web/operations.js` explicitly displays the 100-attempt preview. The external 420Analytics binding is not verified.

## Repository-side exit criteria still to implement and qualify

1. Define a bounded, repeatable all-history traversal or snapshot-safe paginated reconciliation for merchant checkout attempts. Preserve tenant isolation and owner-only financial permissions. Never silently truncate at 100.
2. Reconcile paid, refunded and partially refunded amounts with canonical finalized Market and Pay evidence; do not infer funds transferred from a pending refund request or SQL state. Keep each settlement asset separate, with BigInt base-unit calculations; do not fabricate exchange-rate conversion or double count.
3. Guard mixed finalized-block reads, reorg/invalidation, changing merchant controller, dataset mutation during pagination, stale/halted projections and duplicate/replayed events. Fail closed or clearly return incomplete state.
4. Provide documented API/SDK/UI pagination or durable aggregation for larger histories, plus time-series only where source data supports trustworthy periods and provenance. Explicitly state coverage, snapshot/finality, and any unverifiable history gap.
5. Test empty/one/100/>100 records, multiple assets, partial/full refund, cancellation, fraud/IDOR, stale source, revoked controller, reorg, replay, offsets/cursors, arithmetic limits and integration regressions. Validate browser accessibility, SDK/type checks, security/lint/build, and exact-SHA app-scoped CI.
6. At completion of COM-6, retain scoped Level 2 cross-component merchant-operations evidence covering COM-6A through COM-6E; record honest live/testnet obligations separately. No app Level 3 before COM-7 phase closeout and main reconciliation.

## Existing safeguards to preserve

Payment and refund authority belongs to Pay/Market and approved governance, not the Commerce projection or 420Analytics. Existing COM-6A/B/C/D qualification evidence is retained. External Notifications, Arbitration and Identity/Names acceptance remains release/testnet-gated as recorded in their own step evidence.

## Qualification status

**INCOMPLETE — gap analysis recorded, not a qualified implementation or Level 1 PASS.** No new executable change is certified by this document. No workflow result, test SHA, milestone or full phase qualification is claimed. Next action is implementing the above on PR #594 and obtaining exact-SHA scoped CI evidence. Subsequent canonical top-level step is **COM-7 Security/ops**, only after COM-6 requirements and milestone requirements are met.

## Initial implementation candidate (not qualified)

Incremental source changes:
- `f5d7d78cc4b902b6d0e5ce9a32e2a4702da38a14`: traverse all attempts up to 5,000 using 100-item chunks; require consistent finalized block and unchanging local count; reject larger histories with explicit `analytics_history_requires_pagination` instead of returning misleading totals.
- `220205e8fddcc9e9ce97d7ee6a8a9e9b13b9b20a`: correct the merchant browser coverage label.
- `ca1d853bd3a01fc7bdad2336ffe8652a3edf49f1`: update existing COM-6 analytics-scope regression expectation.

These changes do **not** satisfy every exit criterion. Larger datasets still lack resumable paginated reconciliation; partial-refund amount handling, material cross-page mutation, additional negative/finality regressions and full COM-6 Level 2 need investigation. No passing CI results were observed at this candidate when this record was written. Do not call it Level 1 qualified or COM-6E complete.
