# BNB-4.6 — Booking Orchestration and Economic Reconciliation — work in progress

**Disposition: INCOMPLETE / Level 1 NOT YET QUALIFIED. Do not advance to BNB-4.7.**

Canonical owner: `docs/bnb/BNB-PHASE4-ROADMAP.md` BNB-4.6.
Repository branch `audit/bnb-phase4-bnb-4-1-baseline-20261013`, draft unmerged PR #631; current implementation candidate `5318553d9f25e60c3ddb69eff3b5fa4247825473`. Baseline `main` observed `959288c8bd33b6da0325b6a5d060e00e7bcf0e48`, existing divergence approximately 408 behind. Refresh before reconciliation.

## Work implemented

- `services/420bnb/booking_saga.py`: deterministic noncustodial reconciliation projection; fail closed on unknown booking/Pay state, inconsistent confirmation, late Pay finality after cancellation/expiry, recovery-required source state, invalid settlement conservation, disbursement over-allocation, or invalid operation data.
- `services/420bnb/tests/test_bnb46_saga.py`: unit/negative tests for over-allocation, late payment, state mismatch, duplicate failed disbursement accounting, missing Pay evidence and unexpected transitions.
- `services/420bnb/api.py`: scoped GET `/v1/bnb/reservations/{reservation_id}/orchestration`; authenticated guest or property host only. Reads existing Pay-owned mirrors and returns nonbinding status. Neither confirms reservations nor transfers funds.
- Existing Pay/Wallet proof checks, frozen invoices, captured splits, idempotent incoming Pay events, prepayment cancellation and expiry are retained without modification.

## Required unfinished exit criteria

1. Validate full lifecycle including booking pending/confirm/expire/cancel/dispute/refund as independent canonical transitions and idempotent replay; do not use unapproved self-issued dispute authority.
2. Extend reconciliation for signed provider invoices, original payer, Pay disbursements and their reversal/reorg rules, and exact payout liabilities under concurrent/disputed events. Existing Pay-owned pathways must remain sole execution authority.
3. Add database-backed adversarial route/integration tests for cross-tenant IDOR, competing event order, duplicate receipts, Pay finality revocation/reorganizations, concurrent cancellation and failed/late payout.
4. Inspect all required exact-SHA BNB runtime and retained workflow terminal results. Required Runtime Slice run 38474192221 was pending at initial observation and is **not** counted as PASS.
5. Resolve failures without suppressing tests, record test totals and job IDs, update exact implementation SHA if changed, and issue a Level 1 certificate **only after** original exit criteria pass.
6. Keep external provider, legal and testnet approvals under `BNB-TESTNET-WORK-ROADMAP.md`; no live 420Pay/420Wallet/Identity/Compliance/Travel activation.

## Invariants and gates

`travel.bnb_booking=false`. All named T-BNB testnet gates unchanged. No BNB custody, self-issued payment/Wallet consent, provider finality, refund execution, outside messaging or live booking approval. Do not merge PR #631. BNB-4.7 Level 2 follows only a qualified BNB-4.6; BNB-4.12 Level 3 remains the sole full-repository qualification milestone.

## Continuation — Pay authority and recovery hardening (2026-10-13)

- The Pay disbursement refund pathway now additionally checks independently signed `original_payer_subject`, `original_pay_invoice_id`, `original_pay_payment_id`, and `original_payer_recipient_verified` against the persisted immutable Pay intent. Merely claiming `original_payer_refund=true` is insufficient.
- Canonically verified 420Pay `reorg`/`finality_revoked` failure events may move an already-confirmed reservation and Pay intent to `recovery_required` only if the external authority independently attests finality revocation and the invoice matches. Inventory remains fenced by the previously confirmed hold, rather than being silently offered again.
- App-local saga negative tests now cover recovery-required finality, refund overdraw and reserved (not finalized) payout liability.
- Latest executable SHA: `d10c48da832974b3567207ab2fd11c87f49bc0ad`. Latest observed Runtime Slice: [38474917611](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38474917611) **PENDING** at inspection, not PASS. Nine retained app checks were queued. Intentionally skipped Docs and unrelated global failures are not BNB Level 1 pass evidence.
- **Remaining before PASS:** verified full dispute/refund saga transitions and resolution, independent Pay reorganization recovery/compensation logic, database-backed concurrency/IDOR and signed-evidence integration tests, terminal exact-SHA workflow results and evidence certificate.
- Maintain **INCOMPLETE**, no M4-A advancement, no deployment and no PR merge.

## Verified predecessor evidence for BNB-4.7 entry review

**Executable SHA** `b76f055627416b98a67580c91ee93c95ce901502`; **main** `959288c8bd33b6da0325b6a5d060e00e7bcf0e48`; branch **75 ahead / 408 behind** at review. PR #631 remains draft/open/unmerged.

- [Runtime Slice 38475861481](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38475861481), job `115566256649`, terminal SUCCESS: **8 operations + 259 runtime/API/security tests = 267 PASS**, zero failures. This fixes the former 403/202 fixture mismatch by adding Pay-verified original-payer claims without relaxing the production refund guard.
- Nine BNB retained workflows terminal SUCCESS on this executable SHA: `38475861143`, `38475861270`, `38475861205`, `38475861488`, `38475861176`, `38475861284`, `38475861430`, `38475861325`, `38475861188`.
- Oracle `38475861500` SUCCESS, not substituted for BNB tests. Docs `38475861419` SKIPPED, not a Level 1 PASS. Other repository workflows failed; these are not silently credited.
- CI demonstrates all executed tests passed, **not** that unimplemented lifecycle/dispute/reorg exit criteria are complete. The saga is still a read-only projection with unresolved independent dispute/refund transitions, competing lifecycle event reconciliation and source-finality recovery evidence. PostgreSQL-specific BNB-4.6 coverage currently includes IDOR and recovery-state tests, not all required concurrent event-order/adversarial scenarios.
- **Entry decision for canonical BNB-4.7 M4-A: BLOCKED by BNB-4.6 functional exit criteria and missing unconditional Level 1 certificate.** Do not certify M4-A or proceed to BNB-4.8. No Level 2 global Foundry/Genesis/Integrated/Docs work is authorized. Preserve `travel.bnb_booking=false`, testnet work roadmap and all external acceptance deferrals.
