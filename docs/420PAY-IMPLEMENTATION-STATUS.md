# 420Pay — Genesis implementation and qualification status

420Pay is a registry-resolved Genesis economic protocol. Genesis Decisions #1–#4 and the parameter profile in `contracts/config/pay/420pay-parameters.json` are frozen.

## Implemented protocol components

- `PayIds420`
- `MerchantRegistry420`
- `InvoiceRegistry420`
- `PaymentRegistry420`
- `PaymentRouter420`
- `SettlementRouter420`
- `RefundManager420`
- `GasSponsor420`
- `AccountingCommitment420`
- `CanonicalSwapHealthAdapter420`
- `CanonicalSettlementAdapter420`
- shared replay consumption through `ReplayProtectionConsumer420` / `IReplayConsumer420`

The canonical settlement path is `PaymentRouter420 -> CanonicalSettlementAdapter420 -> CanonicalSwapExecutor420`. The adapter is source-bound to the configured `PaymentRouter420`; the swap executor trusts only explicitly governed callers. The Pay replay domain is bound to the canonical payment router through the shared replay consumer.

## PAY-AUDIT-3 implementation state

Decision #4's `offline_invoice_creation: true` and `online_acceptance_required: true` are applied together. Offline invoice construction/signing is retained as a presentation/integrity commitment over the canonical invoice signing root; it does not create an alternate canonical mutation authority. Canonical invoice state remains accepted online only when the bound merchant calls `InvoiceRegistry420.createInvoice`. No unversioned relayer, delegated signer, EOA-signature or ERC-1271 acceptance path is introduced.

`PaymentRegistry420` now exposes explicit Genesis-governed lifecycle transitions for `INCLUDED`, `CERTIFIED`, `SETTLED` and `FAILED`. Inclusion requires `SUBMITTED`; certification requires `INCLUDED`; settlement requires `FINALIZED`; failure is limited to pre-final `SUBMITTED`, `INCLUDED` or `CERTIFIED` states. Existing finalization and bounded refund behavior is retained. PAY-AUDIT-3 regression coverage verifies valid progression, invalid-predecessor rejection, terminal failure non-resurrection, governance-only lifecycle mutation, and the rule that an offline invoice root does not authorize third-party canonical creation.

## PAY-AUDIT-4 implementation state

Settlement split execution is now implemented without creating a new general-purpose custody authority. `PaymentRouter420` remains the authorization/replay boundary, `CanonicalSettlementAdapter420` remains the swap boundary, and `SettlementRouter420` performs only atomic distribution. Direct token/native splits require the payer itself; swap-backed splits route canonical settlement output into the split router and distribute it atomically. ERC-20 ingress/egress deltas and zero-residue postconditions fail closed on fee-on-transfer, false-return, under-delivery, or residual accounting mismatches.

Refund evidence is now bound to `PaymentRegistry420` canonical refund authorization rather than a caller-selected maximum. `RefundManager420` verifies payer/recipient, settlement asset, refundable maximum, and cumulative authorized refund while retaining no transfer/custody authority.

`GasSponsor420` now supports explicit governed relayer authorization and exact post-operation reimbursement. The sponsor never executes the user transaction and cannot choose an arbitrary reimbursement target; only the calling authorized relayer can receive reimbursement, subject to the frozen allowlists/caps and reserve floor.

The frozen accounting export is implemented as `contracts/config/pay/accounting-export-schema.json` plus the Indexer `PayAccountingExport420` DTO and replaceable sink/service. All 15 Genesis fields are preserved and refund totals are reconciled against settlement amount plus tip without placing sensitive purchase detail on-chain.

## Qualification already demonstrated in repository history

Prior 420Pay implementation/hardening PRs compiled under Solidity 0.8.24 and executed Foundry, fuzz/property, Genesis and integrated qualification successfully. Those historical results are not used as exact-head evidence for later commits.

## Current release gates

Repository-side implementation can be qualified independently, but live Genesis/testnet deployment is still required to prove the exact deployed router/adapter/executor/replay instances, registry lifecycle/code hashes, trusted-caller relation, replay-domain relation, ownership/timelock configuration and smoke transactions.

The repository security policy also retains an external independent security review as a mainnet/production release gate. No such third-party audit is claimed here.

420Pay has no canonical standalone frontend in the current repository. User signing and payment presentation are expected to be provided through Wallet/application clients, while canonical authority remains in the Pay contracts and Registry-discovered dependencies.
