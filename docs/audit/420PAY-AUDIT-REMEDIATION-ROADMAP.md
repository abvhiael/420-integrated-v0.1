# 420Pay audit remediation roadmap

Authority: `docs/audit/420PAY-COMPLETE-AUDIT-20261001.md`.

Requirement numbering is stable. Do not renumber closed or blocked items.

## PAY-AUDIT-1 — canonical definition and dependency reconciliation

**Status: COMPLETE.**

Durable qualification basis: source head `79e3bc85f3f2de1778e0200b7eb5dc7895e699f8` passed 420Pay audit qualification run #59 (`36965952679`) and Solidity Contracts run #4003 (`36965952612`). This bookkeeping state is valid only while the commit carrying it also passes the dedicated exact-head 420Pay audit workflow.

Freeze the repository-grounded scope, classify the generic shared-interface dependency row, and preserve the contradiction between the frozen Genesis user-application catalogue (which omits 420Pay) and the Genesis contract/interface records (which include it).

Deliverables:
- machine-readable runtime dependency reconciliation;
- no invented fixed Pay address;
- Registry-resolved Pay deployment model retained;
- explicit standalone-UI requirement left unresolved until catalogue authority is reconciled.

## PAY-AUDIT-2 — settlement authority and replay hardening

**Status: COMPLETE.**

Durable qualification basis: source head `79e3bc85f3f2de1778e0200b7eb5dc7895e699f8` passed 420Pay audit qualification run #59 (`36965952679`) and Solidity Contracts run #4003 (`36965952612`). The caller-boundary, replay, build, focused Solidity, forbidden-primitive and Indexer checks all passed. This bookkeeping state is valid only while the commit carrying it also passes the dedicated exact-head 420Pay audit workflow.

Requirements:
- `PaymentRouter420` remains the payer/governance authorization boundary;
- `CanonicalSettlementAdapter420` accepts execution only from its configured canonical payment router;
- `CanonicalSwapExecutor420` trusts the exact settlement adapter only by governance configuration;
- Pay replay domain binds to the exact payment router at deployment;
- direct adapter-call bypass is adversarially tested.

Live deployment binding remains a PAY-AUDIT-7 requirement.

## PAY-AUDIT-3 — invoice/offline authorization and payment lifecycle completion

**Status: COMPLETE.**

Durable Level 1 qualification: implementation SHA `452bfd2f4214cf0e01d7564944aaaa9f9a70f4e8` passed 420Pay audit qualification run #91 (`37043694408`, job `110959749763`) and Solidity Contracts run #4128 (`37043694394`). The dedicated run passed exact-head verification, static Pay verification, formatting, the Pay/settlement-boundary build, PAY-AUDIT-3 focused Solidity qualification, forbidden-primitive scan, and 420Indexer Pay reconciliation. This completion record is evidence-only and therefore does not recursively require requalification.

Canonical resolution:
1. Decision #4's `offline_invoice_creation: true` and `online_acceptance_required: true` are treated together. Offline invoice signing is a presentation/integrity commitment; it does not create a second canonical state-mutation authority. Canonical invoice creation remains an online transaction from the bound merchant through `InvoiceRegistry420.createInvoice`.
2. No EOA-signature, ERC-1271, relayer, delegate, or generic signed-envelope acceptance path is introduced in V1 because the frozen decision does not grant that authority or freeze its replay/chain/delegation semantics.
3. Payment lifecycle transitions are now explicit and governed: `SUBMITTED -> INCLUDED -> CERTIFIED`; retained direct finalization may occur from `SUBMITTED`, `INCLUDED`, or `CERTIFIED`; `FINALIZED -> SETTLED`; and pre-final states may transition to `FAILED`. Refund states remain bounded by the existing refund path.
4. Invalid predecessor transitions, terminal-state resurrection, non-governance lifecycle mutation, and third-party invoice creation are covered by PAY-AUDIT-3 regressions.

Implementation:
- `PaymentRegistry420.recordIncluded`;
- `PaymentRegistry420.recordCertified`;
- `PaymentRegistry420.recordSettled`;
- `PaymentRegistry420.recordFailed`;
- `contracts/test/PayAudit3Lifecycle420.t.sol`;
- protocol architecture clarification preserving merchant-only online canonical acceptance.

Exit criteria:
- every modeled V1 payment lifecycle state is reachable through an explicit canonical path or is a refund state already covered by `applyRefund`;
- invalid lifecycle transitions fail closed;
- failure cannot resurrect into a finalized/settled path;
- lifecycle mutation remains Genesis-governed;
- offline invoice roots cannot manufacture canonical invoice state;
- exact-head Level 1 Pay qualification passes.

## PAY-AUDIT-4 — settlement splits, refunds, sponsorship and accounting completion

**Status: COMPLETE.**

Durable Level 1 qualification: implementation SHA `3378b3b9efcc2fd2f70124daa7eb520d96aad6f6` passed 420Pay audit qualification run #157 (`37050677411`, job `110983005816`) and Solidity Contracts run #4172 (`37050677237`). The dedicated Pay run passed exact-head verification, static Pay verification, Solidity formatting, the Pay/settlement-boundary build, PAY-AUDIT-4 focused Solidity qualification, forbidden-primitive scan, and 420Indexer Pay reconciliation. This completion record is evidence-only and therefore does not recursively require requalification.

Canonical resolution:
1. **Split execution ownership:** `SettlementRouter420` owns split distribution only. `PaymentRouter420` remains the payer authorization/replay boundary and `CanonicalSettlementAdapter420` remains the swap execution boundary. Direct native/token splits require the payer itself; swap-backed splits deliver canonical settlement assets into `SettlementRouter420` and distribute them atomically in the same transaction.
2. **No hidden custody:** successful split execution must leave zero new router residue. ERC-20 input/output deltas are checked exactly; fee-on-transfer/false-return behavior fails closed. Payment IDs are replay-protected locally and by the existing PaymentRouter shared replay path.
3. **Refund reconciliation:** `PaymentRegistry420` is the canonical refund-authorization ledger. `RefundManager420` records refund evidence only when recipient, settlement asset, refundable maximum and cumulative authorized refund match the bound canonical payment record. RefundManager does not gain asset custody or release authority.
4. **Gas sponsorship:** no canonical ERC-4337/paymaster runtime exists in the repository. V1 therefore binds reimbursement to governance-authorized relayer contracts. `GasSponsor420` never executes the user call and cannot choose an arbitrary reimbursement recipient; the calling authorized relayer is reimbursed only for an allowlisted/capped operation while preserving the reserve floor.
5. **Accounting export:** the frozen 15-field Genesis export is implemented as a derived Indexer DTO/schema plus replaceable sink interface. Export services receive no protocol mutation authority and sensitive purchase details are not moved on-chain.

Implementation:
- atomic native, direct-token and held-token split execution in `SettlementRouter420`;
- direct and swap-backed split authorization paths in `PaymentRouter420`;
- swap-backed split composition in `CanonicalSettlementAdapter420`;
- canonical refund accounting view in `PaymentRegistry420`;
- `RefundManager420 -> PaymentRegistry420` binding and authorized-refund reconciliation;
- governed GasSponsor relayer allowlist plus exact reimbursement and cumulative reimbursement accounting;
- `contracts/config/pay/accounting-export-schema.json`;
- `420-indexer/src/pay-accounting-export.ts` and regression coverage;
- Genesis wiring/check updates for all new source bindings;
- PAY-AUDIT-4 focused Solidity and Indexer regression suites.

Exit criteria:
- split recipient count, 10,000-bps total and primary-recipient rounding remain frozen;
- native, direct-token and swap-backed split paths conserve value atomically and leave no new SettlementRouter residue;
- a third party cannot spend a payer's standing token allowance through the direct split path;
- split/payment replay fails closed;
- refund evidence cannot exceed or contradict canonical PaymentRegistry refund authorization;
- RefundManager retains no arbitrary custody/release authority;
- only explicitly governed relayer contracts can receive GasSponsor reimbursement;
- sponsorship limits and reserve floor are enforced before reimbursement;
- all frozen accounting-export fields are present exactly once and refund totals reconcile to canonical refundable value;
- exact-head Level 1 Pay qualification passes.

## PAY-AUDIT-5 — Indexer/event-model integration

**Status: COMPLETE.**

Durable qualification basis: source head `79e3bc85f3f2de1778e0200b7eb5dc7895e699f8` originally passed 420Pay audit qualification run #59 (`36965952679`), including the 420Indexer Pay reconciliation build/regressions. The canonical PAY-AUDIT-5 implementation files remain byte-for-byte unchanged through current qualified implementation SHA `3378b3b9efcc2fd2f70124daa7eb520d96aad6f6`; that SHA re-ran the current app-specific workflow and passed 420Pay audit qualification run #157 (`37050677411`, job `110983005816`) plus Solidity Contracts #4172 (`37050677237`). Run #157 passed the 420Indexer Pay reconciliation build/tests under the current workflow, so PAY-AUDIT-5 remains COMPLETE without reopening implementation.

The baseline Indexer referenced nonexistent Pay lifecycle events. The audit:
- maps canonical Pay contract names to `420Pay`;
- removes fabricated lifecycle event semantics;
- derives Pay lifecycle from actual `PaymentSet(status)` and `PaymentAuthorized` events;
- adds regression coverage.

Remaining deployment work: publish exact deployed registry-resolved Pay contract descriptors/addresses before live indexing can qualify.

## PAY-AUDIT-6 — deterministic deployment package and Registry publication

**Status: MISSING.**

Create and qualify:
- exact compiler/runtime artifacts for every deployed Pay resident;
- constructor/immutable argument manifest including GovernanceTimelock, ProtocolRegistry, Genesis config hash and settlement executor dependencies;
- deployment order and initialization/wiring script;
- ProtocolRegistry component publication with runtime hashes/version/lifecycle;
- exact adapter->router, adapter->executor, executor trusted-caller and replay-domain bindings;
- ownership/governance handoff checks;
- reproducibility/drift verifier and smoke-test script;
- rollback/recovery and operator runbook.

Pay components are registry-resolved; do not assign frozen addresses unless the canonical address policy is deliberately versioned.

## PAY-AUDIT-7 — production-equivalent testnet qualification

**Status: BLOCKED until the approved live testnet candidate exists and PAY-AUDIT-6 repository work is complete.**

Retain exact release-SHA evidence for:
- chain/genesis identity;
- deployed runtime hashes and Registry lifecycle;
- governance/timelock bindings;
- Pay->SettlementAdapter->SwapExecutor and replay-domain wiring;
- canonical asset/fee/health dependencies;
- invoice/payment/refund paths;
- swap failure atomic rollback and replay rejection;
- split/sponsorship/export behavior after PAY-AUDIT-4 is implemented;
- Indexer reconstruction/reorg/restart behavior;
- Wallet/client transaction review if a canonical user surface is later required.

## PAY-AUDIT-8 — independent audit and Genesis/production closeout

**Status: BLOCKED.**

Run the security policy against one frozen candidate SHA. Critical/high findings must be fixed, remediation re-reviewed, deployed bytecode/code hashes must match the audited commit, release gates and operational monitoring/incident response must close, and the Genesis catalogue contradiction must be resolved.

Only then may 420Pay be declared Genesis-ready or production-ready.
