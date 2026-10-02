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

**Status: IMPLEMENTED — Level 1 exact-head qualification pending.**

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

**Status: PARTIAL / BLOCKED on semantic decisions.**

Current facts:
- `SettlementRouter420` validates split shape and calculates deterministic amounts, but exposes no transfer/execution function; its `NativeSettlement` and `SplitPaid` events are not emitted.
- refunds are canonical accounting/lifecycle records; no Pay contract has arbitrary custody-release authority, consistent with the authority map.
- `GasSponsor420` enforces allowlists/caps and records sponsored cost, but does not itself execute or reimburse an account-abstraction transaction.
- `AccountingCommitment420` hashes a tax summary, while the frozen Genesis accounting-export field set has no retained exporter/service/schema implementation.

Required remediation:
1. freeze whether split execution belongs in Pay, the canonical settlement adapter, Wallet/account execution, or another custody component; then implement atomically without creating hidden custody;
2. retain refund accounting/non-custody semantics unless a separately authorized custody integration is approved;
3. bind GasSponsor accounting to the canonical relayer/paymaster/account-abstraction execution boundary and prove debits/reimbursement/reserve accounting;
4. implement a canonical export DTO/schema and a replaceable exporter for the frozen fields, with reconciliation tests.

## PAY-AUDIT-5 — Indexer/event-model integration

**Status: COMPLETE.**

Durable qualification basis: source head `79e3bc85f3f2de1778e0200b7eb5dc7895e699f8` passed 420Pay audit qualification run #59 (`36965952679`), including the 420Indexer Pay reconciliation build/regressions. This bookkeeping state is valid only while the commit carrying it also passes the dedicated exact-head 420Pay audit workflow.

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

**Status: BLOCKED until the approved live testnet candidate exists and PAY-AUDIT-3/4/6 repository work is complete.**

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
