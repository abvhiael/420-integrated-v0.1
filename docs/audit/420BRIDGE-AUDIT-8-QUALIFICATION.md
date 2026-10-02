# BRIDGE-AUDIT-8 Qualification Evidence

Status: **COMPLETE / PASS**

## Qualified implementation

- Step: `BRIDGE-AUDIT-8 — Documentation, ABI, Indexer and cross-app integration reconciliation`
- Authoritative implementation SHA: `8845396b3a51efa08f30773113eff0c5cdbcfead`
- Source audit branch: `audit/420bridge-complete-20261001`
- Source remediation PR: #463
- Qualification workflow: `420Bridge AUDIT-8 Level 2`
- Workflow run: `37067605885` (run #9)
- Consumer/integration job: `111039209150` — **SUCCESS**
- Retained Bridge Level 2 job: `111039209489` — **SUCCESS**

This record is documentation-only evidence. It does not alter executable source, tests, workflows, configuration, deployment inputs or qualification scope, so the exact implementation SHA above remains the qualified implementation head.

## A8 implementation closeout

BRIDGE-AUDIT-8 reconciles the repository-side Bridge ABI, Indexer, derived consumers and documentation around the actual canonical Bridge contract/event model.

Implemented and qualified:

- canonical address-unbound `420Bridge` descriptor covering **9 deployment components / 27 events**, with runtime binding to exact deployment/ProtocolRegistry addresses;
- generated Foundry ABI parity verification for event signatures, fields and indexed attributes;
- Indexer topic decoding that supports identical event signatures across separately bound contracts while remaining fail-closed on a known topic emitted from the wrong contract address;
- canonical Bridge transfer lifecycle reconstruction from `TransferCreated`, `TransferStatus` and `TransferTransition`;
- Bridge lifecycle object identity keyed by `transferId` ahead of route/asset identifiers;
- canonical status mapping through CREATED, SOURCE_PENDING, SOURCE_FINALIZED, PROOF_PENDING, VERIFIED, DESTINATION_PENDING, COMPLETED, FAILED, RETRYABLE, EXPIRED, PAUSED, DISPUTED and REFUNDED;
- Exchange read-model consumption of canonical Bridge lifecycle events without obsolete synthetic event aliases;
- Wallet, Exchange, Explorer, Notifications and Analytics documentation/consumer boundaries reconciled around the shared non-authoritative 420Indexer projection;
- audit requirement matrix reconciled so repository-remediable Bridge items are COMPLETE while live deployment/testnet evidence remains explicitly deferred.

## Qualification results

### Consumer / integration job — `111039209150`

All exact-head checks passed:

- A8 ABI/Indexer/cross-app/docs reconciliation verifier — **PASS**
  - `BRIDGE_AUDIT_8_INTEGRATION=PASS`
  - canonical contracts: **9**
  - canonical events: **27**
  - derived consumers: Wallet, Exchange, Explorer, Notifications, Analytics
- full 420Indexer suite — **206 pass / 0 fail**
- Exchange read-service — **12 pass / 0 fail**
- Exchange web regression — **264 pass / 0 fail**
- Analytics Indexer client — **PASS**
- Analytics protocol metrics — **PASS**

### Retained Bridge Level 2 job — `111039209489`

All exact-head checks passed:

- canonical Bridge ABI artifact build — **PASS**
- retained A6/A7/A8 Bridge verifiers, including generated ABI parity — **PASS**
- broad `Bridge*.t.sol` contract qualification — **PASS**
- canonical production adapter suites — **166 pass / 0 fail / 0 skipped**
- retained cross-adapter / replay-domain / verifier-rotation / emergency-control / malformed-proof fuzz / router-bypass / accounting-recovery security suites — **44 pass / 0 fail / 0 skipped**
- Exchange Bridge qualification — **10 pass / 0 fail**
- Pay/Swap/Bridge Genesis integration — **1 pass / 0 fail**

The retained security gate includes 2,500-run fuzz cases for malformed proof/recipient boundaries and stale/duplicate accounting observations.

## Qualification defects found and corrected

Qualification exposed two real Indexer regressions introduced during A8 implementation. Both were corrected before the authoritative run:

1. Bridge lifecycle object identity initially selected `routeId` before `transferId`. The reducer now gives Bridge transfer identity explicit `transferId` precedence.
2. Multi-contract topic dispatch initially returned `null` for a known topic at an unbound/wrong contract address. This weakened the existing Indexer fail-closed contract-identity invariant used by Registry, Names and Stake. The decoder now supports duplicate topics by exact bound address while throwing a contract-mismatch error when a known topic comes from the wrong address.

The authoritative run above is after both corrections.

## Scope boundary

A8 is the Bridge **Level 2 application milestone**. It does not claim:

- live external-chain proof/finality witnesses;
- live production-equivalent testnet deployment receipts, runtime hashes or Registry publication transactions;
- production route/verifier/gateway operations;
- repository-wide Level 3 qualification;
- reconciliation/mergeability of the long-lived audit PR against the latest `main`.

Those remain later-phase work. Live external-chain/deployment qualification begins at **BRIDGE-AUDIT-9**; full repository closeout/Level 3 remains reserved for the final audit closeout phase.

## Result

**BRIDGE-AUDIT-8 is qualified COMPLETE at implementation SHA `8845396b3a51efa08f30773113eff0c5cdbcfead`.**
