# DOOBr R05.4 — Fees, payment finality/rollback and external authority conservation

**Canonical step:** R05.4 Fees, payment finality/rollback and external authority conservation checks (R05 roadmap). **Level:** 1, app-scoped; PR #601 remains open/unmerged. Inspected base main SHA `bc0faa5dafecda3de0620a9581f9953b89cd95fb` (branch ahead 386/behind 1110 before R05.4 changes).

**Implementation SHA:** `34e3258227a91dbb9e2f76744cbd2fe2c7f0e53b`. Retained `doobr/pay_receipt_adapter.py` and `doobr/payment_conservation.py` continue to require an independently verified canonical 420Pay `SETTLED` non-reversed receipt, matching retailer amount/currency/order, integer-minor-unit exact conservation across retailer/delivery/Dev Compensation Vault/platform/refund buckets, approved canonical vault route, verified refunds and atomic callback deduplication. DOOBr does not create fees, custody, mint, charge or itself refund.

**Added:** `doobr/storage/tests/test_r05_4_financial_finality.py` negative/adversarial matrix for unsettled/reversed/failed/reimbursed payments, mismatched amount/currency/seller/order/issuer, future-dated receipts, every individual fee/refund bucket +/-1 unit, wrong vault, denied/unknown/unavailable refund and vault authorities, malformed accounting, duplicate callbacks and full cancellation refund conservation. A rejected external-authority or amount check must never invoke callback ledger recording. Workflow `.github/workflows/doobr-r05-4-level1.yml` runs exact-SHA guards, new finance tests, retained 420Pay/payment/Wallet/security regressions, and frozen Genesis/Travel verifier.

**CI result:** pending exact-SHA targeted workflow result inspection. Do not claim queued/cancelled/skipped/untriggered checks as passing.

**Limits:** canonical 420Pay payment-finality proof, production escrow/rollback, PostgreSQL durable concurrent exactly-once callbacks and external issuer service credentials still require production-equivalent testnet, independent settlement and legal acceptance. 420Pay/Dev Compensation Vault remain the exclusive financial authorities. No operational delivery/checkout or public Travel transaction is enabled. R04.11 previously passed Level 2 on its own SHA; R05.10 will own once-only Level 3 qualification against reconciled main, with Foundry solely owned by Solidity Contracts, separate Genesis authority, Integrated and Docs.

**Next canonical step:** R05.5 Expired licences, policy changes mid-order, emergency stop and revoke.
