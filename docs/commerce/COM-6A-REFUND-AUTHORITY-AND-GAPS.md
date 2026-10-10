# COM-6A — Governed Pay refund workflow

**Status: REPOSITORY-SIDE PROPOSAL IMPLEMENTED; CANONICAL EXECUTION BLOCKED.**
This is a proposed subpackage of canonical COM-6 Merchant operations; it does **not** change canonical roadmap numbering.

## Source of authority

Verified directly against `contracts/src/pay/PaymentRegistry420.sol` and `contracts/src/pay/RefundManager420.sol`:

- `PaymentRegistry420.applyRefund(paymentId,amount,complete)` requires Genesis governance for Pay refund action. It updates the canonical cumulative authorization ledger, not an ordinary merchant-accessible transfer.
- `RefundManager420.recordRefund(refundId,paymentId,settlementAsset,recipient,amount,refundableMaximum,reasonHash)` also requires Genesis governance. It requires payer recipient and settlement asset to match Pay, checks `refundedByPayment + amount <= authorizedRefunded` and <= canonical maximum, and records canonical refund evidence; it **does not custody or release assets**.
- No permissionless or merchant-signature refund execution call was found in these exact two canonical contracts. Commerce must not misrepresent a proposed refund as paid or assert a token transfer.

## Implemented safeguards

`commerce/src/refund.mjs` derives an explicit and **non-executable** refund proposal from Pay payment evidence, verifies settlementAsset and payer, permits only payable/finalized, settled or partially refunded status 4/5/7, checks nonnegative cumulative accounting, cumulative maximum = settlementAmount + tipAmount, and rejects zero, overflow or excessive requests. Requires caller-supplied amount and reasonHash. The merchant-only `commerce/src/service.mjs` remedy handler checks original order/receipt/invoice correlation, approved merchant controller, and canonical payment before returning a proposal; does not persist an authorization, create an on-chain transfer, or generate a fake `RefundRecorded`. The signed HTTP route, SDK and merchant dashboard accept the explicit amount and reason commitment.

Tests: `commerce/test/com6a-refund.test.mjs` covers full remaining refund, partial outstanding balance, wrong payer/asset, invalid state/amount, accounting corruption, missing reason and pure repeat evaluation; existing COM-6 tests verify access boundary and no mutation.

## Unfinished exit criteria

1. **Governed submission/approval**: verify a real approved governance/refund routing service and establish exactly who can request and approve each refund, with a durable, replay-proof, audit-logged request lifecycle and permission boundary. No authority currently exists for an ordinary Commerce merchant to invoke Pay governance directly.
2. **Actual fund return**: identify the canonical transfer/execution authority and reconcile recipient, asset, transaction hash, included/finalized status and paid/refunded state. `recordRefund` is accounting only and does not prove transfer.
3. **Partial/full lifecycle**: distinguish requested/authorized/transferred/recorded/finalized and Market refund reporting, prevent duplicate use across retries, reorgs and concurrent reviewers, and test rollbacks/adversarial races.
4. **Targeted exact-SHA qualification**: run affected Commerce service/SDK, browser and relevant upstream contract checks. Do not count running/queued/cancelled runs as PASS.
5. **Live acceptance**: preserve genuine testnet/governance deployment and transaction evidence for COM-8. Do not call a mock ledger real funds.

Level 2 retained app milestone only after authority and execution boundaries converge. Level 3 reserved for COM-7 app-phase closeout; no duplicated full Foundry inventory. **COM-6A is NOT COMPLETE until the first three repository-side requirements are implemented and qualified.**

## Follow-on governed request outbox (not money movement)

Commerce migration `003-refund-requests.sql` introduces an immutable, owner-scoped refund request ledger with a unique `payment_id + reason_hash + amount` constraint and an audit event. A signed merchant proposal now persists `PENDING_GOVERNANCE`, returns a stable request ID on idempotent retry, and refuses competing pending amounts that would exceed Pay's remaining refundable balance. This records seller intent **only**; it is not governance approval and must never be treated as a Pay authorization or a transfer receipt.

### Critical actual-fund-return gap

The canonical `SettlementRouter420` distributes money directly to split recipients and retains no newly received custody balance. The existing `PaymentRegistry420.applyRefund` updates Pay's authorized refund accounting. The existing `RefundManager420.recordRefund` records evidence under Genesis governance and **does not transfer ERC-20 or native tokens**. Thus neither a signed Commerce request nor those two governance calls can prove that the payer received their funds. To implement a genuine return requires an explicitly approved source of money (e.g., a merchant-funded refund vault or authorized merchant transfer), its actual transfer authority, atomic/replay-safe funding and payout semantics, and separate finalized transfer plus canonical Pay/Market reconciliation. No unapproved custody or authority change is introduced by this Commerce-only change. **Execution and complete reconciliation remain BLOCKED** until the owning Pay protocol authorizes and qualifies that mechanism. Do not display `refunded` from a request or accounting record alone.

## Governed Pay-funded payout implementation (additive source extension)

This phase subsequently added a **new, explicitly pre-funded payout route** to the existing `RefundManager420` canonical Pay owner, leaving the original accounting-only `recordRefund` method in place for compatibility. Earlier sections describe the original V1 behaviour; those statements must not be applied to the new entrypoints.

1. `PaymentRegistry420.applyRefund(paymentId,amount,complete)` is called **only by authorized Genesis governance** and authorizes cumulative Pay refund accounting. It does **not** return funds.
2. Governance explicitly funds the already-approved obligation using `RefundManager420.fundAuthorizedRefund(paymentId,asset,amount)`. It accepts canonical settlement assets only, checks status, remaining approved accounting headroom, exact ERC-20 transfer-in balance delta or exact native `msg.value`, and isolates funding per payment ID. No merchant collateral is seized or diverted.
3. Governance calls `RefundManager420.executeFundedRefund(refundId,paymentId,asset,recipient,amount,maximum,reasonHash)`. It verifies payer/asset/maximum against PaymentRegistry, cumulative approval and dedicated escrow, atomically marks the immutable refund ID executed and returns exactly that asset amount to the **original payer**. False ERC-20 transfer, unexpected fee-on-transfer, failed native send, replay, reentrancy, wrong recipient or bad accounting all revert the entire execution. The new `FundedRefundPaid` event and `fundedRefundExecuted(refundId)` proof distinguish *actually transferred* money from legacy accounting-only evidence.
4. The signed Commerce outbox exposes `refundId = 0x + requestId` to governance. The optional approved `RefundManager420` binding in Commerce's private RPC manifest is validated for code hash, component identity, version and finalized Registry provenance. `merchantRefunds(storeId)` displays `FUNDED_REFUND_FINALIZED` **only** when that deployed manager affirms `fundedRefundExecuted`, its refund record matches payment ID/asset/original payer/amount/reason, and Pay cumulative refunded accounting covers the amount. Missing or inconsistent proofs fail closed.

**Deployment condition:** existing deployed RefundManager bytecode cannot magically gain these entrypoints. A governed Pay upgrade/redeployment and new approved manifests (code hash, service address, version, matching Registry binding), funded treasury approval, transaction evidence and live transfer verification are necessary at COM-8 before any actual user refund can be claimed. This implementation does **not** run transactions against a live network. Distinguish committed executable source and targeted tests from live execution.

**Known operations/recovery gate:** governance-funded escrow has no general-purpose operator withdrawal path in this additive design. Only deposit approved amounts that will be returned by governance; retain incident handling and, before a production rollout, qualify a separately authorized stuck-escrow recovery or governance-controlled cancel path. No insecure arbitrary-recipient drain path may be added as a shortcut.

**Legacy status:** the old `recordRefund` method remains accounting-only and is not treated by Commerce as proof of a transfer. Its allowance accounting now also considers escrowed authorized amounts, preventing those records from stealing budget from funded payouts.

**Qualification:** directly affected canonical Pay/Solidity suite and Commerce service, SDK, browser and integration checks must pass against the same executable implementation SHA; any skipped workflow does not count as success. Application-level Level 2 is required at this shared Pay authority milestone; repository-wide Level 3 remains deferred.

## Finalization phases and Market V1 caveat

The request ID is the canonical Pay `refundId = 0x + Commerce request_id`. Intended governed sequence: (1) merchant signs and stores a request; (2) Genesis governance evaluates and authorizes exactly the amount in `PaymentRegistry420.applyRefund`; (3) Genesis governance supplies the approved asset into `RefundManager420.fundAuthorizedRefund`; (4) governance invokes `executeFundedRefund`, which atomically pays the original payer and records its immutable funded payout proof; (5) for a **fully** refunded payment, the existing permissionless `MarketPaySettlementAdapter420.reportRefund(orderId)` submits canonical Market reporting; for partial payment refunds Market remains in its prior status.

The merchant status endpoint classifies:
- `PENDING_GOVERNANCE_OR_UNVERIFIED`: durable request, but no verified transfer.
- `PARTIAL_FUNDED_REFUND_FINALIZED`: exact transferred partial amount proved by the approved on-chain RefundManager.
- `FUNDS_RETURNED_MARKET_REPORT_PENDING`: fully returned funds with no finalized Market reporter proof yet.
- `FUNDED_REFUND_MARKET_RECONCILED`: both real funded payout and Market `REFUNDED` with canonical `refundReported(orderId)` at the finalized same source.

**Important existing Market V1 limitation:** its permissionless `reportRefund(orderId)` checks full *Pay accounting state*, not `fundedRefundExecuted`. Consequently a third party could report Market `REFUNDED` after the accounting authorization but before actual return of funds. Commerce explicitly refuses to treat that Market status alone as a successful financial refund. Hardening the frozen immutable Market V1 adapter to require funded transfer proof is a separate governed upstream protocol/version decision; no silent constructor/identity or frozen-address changes are made here.

**Recovery**: The additive `cancelAuthorizedRefundFunding` returns unused, explicitly funded escrow only to the authenticated Genesis-governance caller, with exact native/ERC20 balance-delta checks. It does not reverse Pay authorization or claim a refund. The older note above about no recovery applied before this method was added.

**Pay audit barrier**: The dedicated 420Pay audit CI may fail its frozen PAY-AUDIT-6 materialization due a prior `InvoiceRegistry420 source_blob_sha1` divergence on the Commerce audit branch. This is not a reason to overwrite canonical frozen artifact fingerprints casually; it requires an approved reconciliation and new qualified deployment package. Existing deploys retain old RefundManager bytecode and therefore cannot execute the new entrypoints until governed upgrade/Registry/manifest qualification at COM-8.

## COM-6A repository-side Level 1 closeout — exact executable SHA (2026-10-09)

**Implementation SHA:** `8747c14878676c7adc9c4bb70c24f42f6be64869`.
**Qualification:** PASS for the scoped repository implementation; **not a live testnet/production acceptance claim**.

Completed exact-SHA jobs:

- Commerce service fast qualification: [37984811803](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37984811803) — SUCCESS; Commerce service, migration, API, authorization, financial reconciliation, SDK, Indexer and adversarial regressions.
- Commerce merchant builder fast qualification: [37984812093](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37984812093) — SUCCESS; responsive/accessibility browser and merchant refund UI.
- Commerce upstream contracts: [37984812119](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37984812119) — SUCCESS; retained Market/Pay and funded-refund Solidity test import closures; canonical upstream Foundry test owner.
- Solidity Contracts: [37984812163](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37984812163) — SUCCESS for affected inventory.
- Commerce governed Pay refund qualification: [37984811911](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37984811911) — SUCCESS; independent Pay governance, source-parameter and forbidden-primitive checks, without duplicating Foundry.

The dedicated historical 420Pay audit workflow is **SKIPPED by design on Commerce branches**; it remains unchanged for canonical Pay-audit branches. Earlier attempts against this audit branch failed a retained PAY-AUDIT-6 `InvoiceRegistry420 source_blob_sha1` identity mismatch. That frozen deployment-package drift has not been reconciled, rewritten or waived. Do **not** cite a skipped PAY-AUDIT-6 workflow as passing; it remains an explicit cross-protocol deployment/reconciliation gate.

### Implementation obligations met

- Idempotent merchant-scoped SQLite outbox with serialized pending-budget reservation and durable request/refund IDs, distinct from approval.
- Genesis-governance-only payment authorization, canonical refundable-maximum accounting, funded escrow, asset-return execution and restricted unused-funding cancellation.
- Atomic funded payout to original payer, strict ERC-20 native-delta checks, non-reentrancy, replay prevention, full/partial amount boundaries and transfer-failure rollback tested.
- Optional Registry/code/version/chain/finality-bound canonical refund proof in Commerce; mismatch fails closed.
- Separate pending, partial payout, paid-but-Market-unreported and fully Market-reconciled merchant status. Legacy accounting-only `recordRefund` is **not** transfer proof.
- Dedicated Market+Pay Foundry qualification; no repository-wide Level 3 and no duplicate Solidity/Genesis Foundry matrix.

### Explicit remaining release gates

1. Governed deployment approval and PAY-AUDIT-6 frozen identity reconciliation against current main and real release manifest, then upgrade/registration of new RefundManager bytecode.
2. Real treasury/merchant funding source approved and funded; independent reviewer governance/timelock decision and authority evidence for the specific refund request.
3. Real testnet transactions proving authorization, escrow funding, recipient balance transfer, finalized payout receipt and Market report (full refunds), including reorg/replay/failed transaction recovery drills. Record deployed addresses, transaction hashes and exact block finality. No live funds moved by repository tests.
4. Existing V1 permissionless Market `reportRefund` accepts fully refunded **Pay accounting** without requiring funded payout evidence. Commerce avoids false paid claims, but a future upstream Market version must close that protocol-level authority gap before production if the canonical Market status is to imply funds actually returned.
5. COM-6B through COM-6E (disputes, notifications, identity/names, analytics) are separate COM-6 exit items; qualification here does not close them.

**Disposition:** COM-6A **repository-side Level 1 COMPLETE / PASS**, live environment acceptance and cross-protocol release gates **DEFERRED TO TESTNET ROADMAP**, broader COM-6 **INCOMPLETE**. Level 2 milestone remains required for completed COM-6 integrated scope. No Level 3 performed.
