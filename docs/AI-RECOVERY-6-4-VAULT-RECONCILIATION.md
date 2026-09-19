# AI-RECOVERY-6.4 — Vault funding and payout reconciliation (partial)

`420-ai-provider/src/vault-reconciliation.ts` introduces a **read-only** evidence gate. It does not move assets, authorize a Wallet, bind governance adapters, call `AIJobEscrow`, or independently verify chain receipts. A deployed `VaultEvidenceReader420` is required and MUST read from chain-verified AssetVault420, VaultAccounting420 and AIJobEscrow at a canonical finalized block, checking contract code/addresses, transaction success, logs and reorg policy rather than trusting HTTP `canonical: true` flags. Do not use mocks in a paid deployment.

## Funding gate

The caller supplies a consented job/payer/provider/beneficiary/vault/asset/amount and funding reference plus an explicit funding obligation ID. `verifyFunding` requires matching canonical escrow and a matching reserved/claimable/claimed VaultAccounting420 obligation, including immutable beneficiary, amount and source reference. A Wallet approval, token transfer, or escrow event alone does not establish a dedicated reserved Vault obligation. On-chain AIJobEscrow `fund()` is disabled; only the governance-bound Vault adapter can call `confirmVaultFunding` after independently proving source authorization, confirmed deposit, sufficient balance, per-job reservation, and immutable identity bindings. This TS gate is **not** that adapter.

## Payout gate

A CLOSED escrow does not prove funds moved. `verifyPaid` requires matching settlement ref and a claimed Vault obligation plus independently proven canonical withdrawal+claim evidence for the same operation, asset, recipient and exact amount. AssetVault420 `claim` emits `Withdrawal`, VaultAccounting420 emits `ObligationClaimed`, and the operation ID has anti-replay semantics. The external evidence reader must verify logs, emitter addresses, receipt success and finality; this interface cannot establish those facts by itself. This is a read-only *post-payment* reconciliation gate; it must not be used as a precondition to disburse funds or as the only authorization to call escrow `release`.

**Important refund limitation:** AI refunds are not interchangeable with provider funding obligations. A refund requires a separately authorized cancellation/return route and proof of disbursement to the payer; never claim a provider-beneficiary obligation as a refund. The initial gate's `refund` recipient check fails closed for an existing provider-beneficiary obligation. An explicit refund obligation/cancellation schema, custody-bound adapter, and dedicated tests are required before enabling or reporting refunds. Likewise partial provider payout/unused balance must use separately accounted amounts and obligations; this gate only models exact full-amount payment.

## Exit criteria still open

Deploy and authenticate a source-of-truth Vault evidence reader; verify chain ID, contract code, operation/obligation IDs and canonical receipts with finality/reorg checks; implement Wallet-approved funding and a custody-bound governance Vault adapter; reconcile escrow transitions without double-spend across retries; implement actual provider payment and separate refund/partial payout accounting; test failed/duplicate/cross-job/recipient-substitution/reorg and mixed asset flows end to end. Until then keep writes and paid AI requests disabled.
