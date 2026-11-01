# BRIDGE-AUDIT-3 — Canonical transfer lifecycle qualification

**Status:** COMPLETE  
**Qualification level:** Level 1 step-specific  
**Qualified implementation SHA:** `42060ec5c0ea5efde0c527b38333381c44fb5f59`  
**Audit branch / PR:** `audit/420bridge-complete-20261001` / PR #463  
**Qualification-only branch / PR:** `qualification/bridge-a3-20261002` / PR #470 — DO NOT MERGE  
**Main/base SHA at qualification:** `98e545225d54379086f0c520afcb84b4d4d97288`

## Qualified outcome

BRIDGE-AUDIT-3 replaces the unconstrained Bridge transfer status setter with an enforced lifecycle state machine and records outbound initiation as a canonical transfer identity.

- Normal lifecycle is monotonic through source, proof, verification, destination and completion stages.
- COMPLETED and REFUNDED are terminal.
- Retry state records and returns only to the failed stage.
- Source reorg uses an explicit failed/retry-to-source-pending path.
- Pause/resume restores only the recorded prior state.
- Dispute, expiry and refund use guarded governance exception paths.
- Every lifecycle mutation requires evidence.
- Outbound initiation binds route, asset, sender, external recipient hash, amount and source message ID into a replay-protected canonical transfer ID.
- Outbound source finality cannot be recorded before a source transaction ID is bound.
- Inbound acceptance records canonical lifecycle state through VERIFIED.

## Exact-head Level 1 evidence

| Workflow | Run | Result |
| --- | ---: | --- |
| 420Bridge Fast Qualification | #13 / `36959604778` | PASS |
| Solidity Contracts | #3954 / `36959604766` | PASS |
| Solidity `pr-shards (0)` | job `110690246535` | PASS |
| Solidity `pr-shards (1)` | job `110690246475` | PASS |
| Solidity `pr-shards (2)` | job `110690246538` | PASS |
| Solidity `pr-shards (3)` | job `110690246470` | PASS |
| 420Docs Qualification | #4167 / `36959604860` | PASS |
| 420Indexer | #1571 / `36959604765` | PASS |
| Genesis Address Authority | #756 / `36959604799` | PASS |
| 420Registry REG-AUDIT-1 | #498 / `36959604783` | PASS |
| 420Registry REG-AUDIT-4 | #591 / `36959604794` | PASS |

The earlier exact head `035ae8143a040c86588aa6f852e76755c41e376d` failed only because a test function name used Foundry's removed reserved `testFail*` prefix. That harness naming defect was corrected; the superseded result is not qualification evidence.

## Exit decision

**BRIDGE-AUDIT-3 COMPLETE.**

No Level 2 or Level 3 suite is consumed by this ordinary step.
