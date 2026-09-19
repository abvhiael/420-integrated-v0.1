# AI-RECOVERY-6.4 — Vault funding and payout reconciliation (partial)

## 6.4.1 — Pinned RPC evidence reader (implemented; qualification pending)

`420-ai-provider/src/vault-rpc-evidence.ts` implements the existing read-only `VaultEvidenceReader420` using the ABI of the deployed `AIJobEscrow`, `VaultAccounting420` and `AssetVault420` contracts. At creation, it checks the configured chain ID, confirmation depth, the pinned block hash, exact deployed runtime bytecode hashes from an independently approved manifest, the Vault ID and its linked accounting address. Each read is pinned to that block and rechecks its hash and minimum depth; reorgs fail closed. The indexer's operation lookup scans `Withdrawal` logs for the operation ID from a bounded configured deployment block. A successful receipt must contain exactly one matching Vault withdrawal and exactly one accounting `ObligationClaimed`; it must match the claimed obligation's asset, recipient, amount and Vault ID, and the Vault must report that operation executed. Plain `withdraw()` emissions without an obligation claim do not prove settlement.

**Trust boundaries:** The approved addresses, runtime code hashes, RPC, deployment block and chain-finality policy are still external security-critical inputs. A confirmation count and matching RPC block hash are **not** independent consensus/finality proofs or protection against a malicious RPC. This reader does not verify the governance adapters, independently establish user consent or prove that a funding deposit was made by the specified payer; neither an escrow record nor a reserved obligation supplies that provenance by itself. The per-reader immutable block must contain both the escrow transition and the payout before `verifyPaid` is used. Do not mark 6.4 production-qualified or enable paid AI requests on this adapter alone.

## Funding gate

`420-ai-provider/src/vault-reconciliation.ts` checks a consented job/payer/provider/beneficiary/vault/asset/amount/funding reference and explicit Vault obligation ID against a canonical escrow and reserved, claimable or claimed obligation. `AIJobEscrow.fund()` is disabled. Only a governance-bound Vault adapter may call `confirmVaultFunding` after independently proving the user's authorization, confirmed deposit, sufficient asset balance, per-job reservation and immutable identity bindings. Neither TypeScript evidence reader is that adapter.

## Payout gate

A CLOSED escrow does not prove funds moved. `verifyPaid` requires the same settlement reference, a claimed funding obligation and a corresponding canonical withdrawal and claim. `AssetVault420.claim` emits `Withdrawal`, `VaultAccounting420` emits `ObligationClaimed`, and the operation ID is anti-replay protected. This read-only **post-payment** check is not authorization to call escrow `release`.

**Refund limitation:** A payer refund cannot claim a provider-beneficiary obligation. It needs a separately authorized cancellation/return route and proof of payment to the payer, including the precise amount and asset. Partial provider payout and unused-balance return need separate obligations and accounting; this gate models only exact full-amount payment. Keep those paths disabled.

## Exit criteria still open

Qualify the RPC reader against adversarial receipts, fake emitters, duplicate events, wrong chain/address/code, cross-job references, reverted transactions and reorgs, then verify it on a pinned testnet deployment with independent finality and registry evidence. Implement Wallet-approved deposit and a governance-bound custody adapter, funding provenance, idempotent settlement, exact provider claim, separate refunds and partial payout accounting. Test both happy paths and failure/retry/reorg paths before enabling paid AI requests.
