# BRIDGE-AUDIT-4 — Accounting-health enforcement and recovery-boundary qualification

**Status:** COMPLETE  
**Qualification level:** Level 1 step-specific  
**Qualified implementation SHA:** `52f5aadbe89b52697df7bb91bd461f2008ce03e2`  
**Audit branch / PR:** `audit/420bridge-complete-20261001` / PR #463  
**Qualification-only branch / PR:** `qualification/bridge-a4-20261002` / PR #472 — DO NOT MERGE  
**Main/base SHA at qualification:** `d30c81cfbea7847817654b39491694a23c8701e4`

## Qualified outcome

BRIDGE-AUDIT-4 makes Bridge accounting reconciliation state an explicit execution-safety boundary without granting accounting evidence custody or balance-repair authority.

- `BridgeAccountingRegistry` exposes explicit UNKNOWN, HEALTHY, AUTHORIZED_EXCEEDS_OBSERVED and OBSERVED_EXCEEDS_AUTHORIZED states.
- New inbound and outbound movement fail closed unless canonical Bridge accounting is HEALTHY.
- Accounting-health admission occurs before Bridge risk consumption and adapter side effects.
- Missing accounting registration and UNKNOWN health fail closed.
- Both mismatch directions fail closed.
- Reconciliation evidence hashes are single-use; replayed evidence cannot restore health even with a newer timestamp.
- Recovery requires newer, distinct reconciliation evidence.
- Recovery updates reconciliation evidence only; it does not rewrite settled transfer history or repair balances.
- The accounting registry retains no mint, burn, transfer, confiscation or balance-repair authority.
- Existing governed transfer refund/recovery is explicitly classified through the shared `WITHDRAWAL_ONLY` safety path rather than as new outbound movement.
- Cross-suite Pay/Swap/Bridge integration was updated to register canonical Bridge accounting and establish healthy reconciliation evidence before movement.

## Exact-head Level 1 evidence

| Workflow | Run | Result |
| --- | ---: | --- |
| 420Bridge Fast Qualification | #16 / `36963300992` | PASS |
| Bridge Fast `bridge-fast` | job `110701555363` | PASS |
| Solidity Contracts neutral qualification | #3985 / `36963302288` | PASS |
| Solidity `pr-shards (0)` | job `110708690296` | PASS |
| Solidity `pr-shards (1)` | job `110708690507` | PASS |
| Solidity `pr-shards (2)` | job `110708690184` | PASS |
| Solidity `pr-shards (3)` | job `110708690332` | PASS |
| 420Docs Qualification | #4198 / `36963302319` | PASS |
| 420Indexer | #1602 / `36963302263` | PASS |
| Genesis Address Authority | #786 / `36963302264` | PASS |
| 420Registry REG-AUDIT-1 | #520 / `36963302295` | PASS |
| 420Registry REG-AUDIT-4 | #621 / `36963302283` | PASS |

Bridge Fast #16 passed the hardening verifier, Bridge contract tests, affected Exchange Bridge qualification, and Pay/Swap/Bridge cross-suite integration on the exact qualified SHA.

The earlier reconciled candidate `399b573ca945950e537dce07598d3be3a3f869fb` is superseded. Its Bridge Fast run exposed a stale cross-suite fixture that had not registered `BridgeAccountingRegistry`; the production router correctly failed closed with `InactiveComponent(ACCOUNTING_REGISTRY)`. The fixture was corrected in `52f5aadbe89b52697df7bb91bd461f2008ce03e2`, and the exact-head Bridge Fast suite then passed.

Solidity run #3984 is not counted as qualification evidence because its real PR shards were skipped. On the neutral qualification run #3985, all four real Solidity PR shards executed and passed. Earlier duplicate/cancelled runs are not counted as passing evidence.

## Security and adversarial coverage

The qualified A4 coverage proves:

- unknown accounting state blocks movement;
- authorized supply greater than observed supply blocks movement;
- observed supply greater than authorized supply blocks movement;
- failed accounting admission occurs before risk accounting or adapter execution;
- stale/duplicate reconciliation evidence cannot restore health;
- reused evidence hashes cannot restore health at a newer timestamp;
- only newer, distinct healthy evidence restores movement;
- reconciliation recovery does not rewrite completed transfer history;
- refund/recovery remains governed by shared system-safety semantics while accounting is unhealthy;
- the accounting registry cannot itself mint, burn, transfer, confiscate or repair balances.

## Qualification scope

This is a **Level 1** per-roadmap-step qualification. No Level 2 or Level 3 suite is consumed here.

- Level 2 remains deferred to the Bridge application milestone after BRIDGE-AUDIT-8.
- Level 3 remains deferred to BRIDGE-AUDIT-10.
- Production-equivalent live-testnet proof remains BRIDGE-AUDIT-9 and is not required to close this repository-remediable step.

## Exit decision

**BRIDGE-AUDIT-4 COMPLETE.**

Next canonical step: **BRIDGE-AUDIT-5 — Bridge application/service surface completion.**
