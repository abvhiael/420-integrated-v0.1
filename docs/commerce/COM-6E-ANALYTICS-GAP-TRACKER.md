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

## Paginated accounting revision — implementation candidate

Replaces the earlier all-at-once 5,000-order bound with `GET .../operations/analytics?offset=N&limit=M` (M 1–100) and SDK `merchantAnalytics(storeId, offset, limit)`. Every response includes `totalCount`, `offset`, `nextOffset`, `partial` and finalized-block provenance. Financial amounts are scoped **only to the returned page**, so aggregating across pages requires an externally reconciled stable source/dataset snapshot; the service must not claim page sums as complete business revenue.

The underlying Pay payment record's `refundedAmount` is validated as a nonnegative decimal within the original settlement amount. The page produces gross paid, refunded, and net base units per asset; pending refund proposals are not booked as transfers. New regression cases include partial refund, invalid refund amount, bad pagination/tenant, >100 attempts, offset after 5,000, and finalized-block mutation.

Implementation candidate `2e55a3dee45b5243934fd5a1e47db1014343100d` (source, SDK, HTTP, browser, tests). **Not Level 1 certified until CI successfully completes at that exact SHA.** Snapshot consistency across separate HTTP pagination requests remains an explicit caveat, not a claim of full historical aggregate. No COM-6 Level 2 or Level 3 claim.

## COM-6E scoped Level 1 exact-SHA qualification — October 9, 2026

**Implementation SHA:** `3e463d8a07c5e8e370d2e0fcfccfd9a0d97ce61c`. Branch `audit/420commerce-com-2-upstream-adaptations`, draft PR #594. This supersedes earlier candidate SHAs.

Applicable GitHub Actions workflow conclusions checked as **completed/success** at the exact SHA:

- Commerce service fast qualification: https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37997698625 — PASS.
- Commerce merchant builder fast qualification: https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37997698683 — PASS.
- Commerce upstream contracts: https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37997698541 — PASS.
- Commerce governed Pay refund qualification: https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37997698616 — PASS.
- Solidity Contracts workflow: https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37997698724 — overall SUCCESS for PR classification; full Foundry shards skipped, **not** counted as passing full Solidity inventory.

Service CI on previous SHA `69aeb4a86d6676ae215044017f6e7a56e98112e7` failed two stale test assertions, 122/124 passing. The exact failed job and logs were inspected; assertions were updated to match page-local semantics and boolean error-code predicate, without bypassing safety checks. Final SHA reran successfully.

**COM-6E paginated-analytics repository-side Level 1: PASS.** Scope is bounded per-page finalized projections, with optional offsets beyond 5,000 and source-refund gross/refunded/net base units. Whole-history snapshot-stable aggregation across independent pages, durable external 420Analytics publication and live chain acceptance have **not** been demonstrated; no all-time financial authority is claimed. COM-6 accumulated Level 2 and COM-7 Phase Level 3 remain separate milestones. PR is not merge-ready.

## COM-6 accumulated Level 2 app-integration milestone — PASS (2026-10-09)

**Exact tested implementation SHA:** `37887e89f613a6a48e3738a39362e8e731ea6f9a`. The new app-scoped workflow is `.github/workflows/commerce-com6-level2.yml`. Single exact-SHA milestone run: https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37999332517 (job 114053294688), **completed/success**. Steps independently checked successful:

1. Exact SHA checkout, locked dependencies and scoped dependency audits.
2. Retained Market/Pay settlement, funded-refund fuzz and Arbitration Foundry integration (`scripts/commerce/qualify-contracts.py`).
3. Commerce service, SDK, Indexer, consumed ABI build and application integration/adversarial tests (`scripts/commerce/qualify-service.py`).
4. Merchant browser, Wallet, responsive/accessibility tests (`npm run qualify --prefix commerce/web`).
5. Pay implementation/hardening/audit and Genesis interface parameter/safety verifiers, without Genesis duplicating Foundry inventory.
6. App patch whitespace verification.

**Disposition: COM-6 repository-side accumulated Level 2 PASS.** The app's canonical COM-6 merchant operations milestone is qualified at repo test/fixture and targeted protocol-integration level; it does not prove live service delivery, production-equivalent Identity/Names/Notifications/Arbitration, governance deployment or funded external acceptance. COM-6E analytics remains deliberately paginated per response: multiple pages do not automatically constitute a snapshot-consistent all-time report. No global Foundry, Genesis full address-authority, 420 Integrated or Docs Level 3 claims. PR #594 remains draft/unmerged pending COM-7 security/ops and one reconciled Level 3 closeout against current main. Canonical next top-level step: **COM-7 — Security/ops**.
