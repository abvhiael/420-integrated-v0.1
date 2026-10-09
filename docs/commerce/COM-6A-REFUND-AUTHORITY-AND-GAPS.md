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
