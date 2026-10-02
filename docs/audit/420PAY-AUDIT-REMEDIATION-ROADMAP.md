# 420Pay audit remediation roadmap

Authority: `docs/audit/420PAY-COMPLETE-AUDIT-20261001.md`.

Requirement numbering is stable. Do not renumber closed or blocked items.

## PAY-AUDIT-1 — canonical definition and dependency reconciliation

**Status: IMPLEMENTED — exact-head qualification pending.**

Freeze the repository-grounded scope, classify the generic shared-interface dependency row, and preserve the contradiction between the frozen Genesis user-application catalogue (which omits 420Pay) and the Genesis contract/interface records (which include it).

Deliverables:
- machine-readable runtime dependency reconciliation;
- no invented fixed Pay address;
- Registry-resolved Pay deployment model retained;
- explicit standalone-UI requirement left unresolved until catalogue authority is reconciled.

## PAY-AUDIT-2 — settlement authority and replay hardening

**Status: IMPLEMENTED — exact-head qualification pending.**

Requirements:
- `PaymentRouter420` remains the payer/governance authorization boundary;
- `CanonicalSettlementAdapter420` accepts execution only from its configured canonical payment router;
- `CanonicalSwapExecutor420` trusts the exact settlement adapter only by governance configuration;
- Pay replay domain binds to the exact payment router at deployment;
- direct adapter-call bypass is adversarially tested.

Live deployment binding remains a PAY-AUDIT-7 requirement.

## PAY-AUDIT-3 — invoice/offline authorization and payment lifecycle completion

**Status: BLOCKED — canonical architecture decision required.**

The frozen Decision #4 says offline invoice creation is supported and defines an invoice signing domain/root, but the current on-chain registry only accepts `createInvoice` from `i.merchant == msg.sender`; no signature-verification/acceptance path exists.

`PaymentRegistry420.Status` also contains INCLUDED, CERTIFIED, SETTLED and FAILED, but the current public mutation surface creates SUBMITTED, records FINALIZED, and applies refund states only.

Required decision:
1. define whether offline signed invoices are merely off-chain presentation objects or must be accepted/verified by canonical Pay state;
2. if canonical, freeze signature scheme, signer/controller resolution, chain/domain binding, expiry and replay semantics before implementation;
3. define authorized transitions for INCLUDED/CERTIFIED/SETTLED/FAILED or remove unreachable states in a versioned migration;
4. add negative, replay, malformed-signature and lifecycle-transition tests.

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

**Status: IMPLEMENTED — exact-head qualification pending.**

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
