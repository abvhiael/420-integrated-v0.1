# EXP-0.3.8 — governance scope decision and atomic reconciliation

**Decision:** `EXP-SCOPE-RESOLUTION-B`  
**Status:** resolved; exact-head CI qualification required before closeout.

## Authoritative decision

Governance is descriptive ecosystem subject matter and is **not** a mandatory dedicated 420Explorer Genesis view.

The dedicated Explorer Genesis profile remains the specific required-view contract. Its ten `requiredViews` remain unchanged. The broader frozen application-purpose wording has been reconciled so it no longer implies an eleventh governance view.

## Why Resolution B is applied

EXP-0.3.6 allowed only two outcomes. Resolution A would make governance mandatory and require a real Explorer/Indexer API, UI, data-source and qualification path. No such path exists in the qualified required-view implementation set.

Resolution B reconciles the broad purpose statement to the dedicated profile without inventing a new mandatory feature. This is a scope clarification, not an optional/post-Genesis downgrade.

## Atomic reconciliation completed

The resolution updates the full registered reconciliation chain:

- `config/genesis-applications.json` no longer names governance in the Explorer purpose;
- the dedicated Explorer profile continues to define exactly ten mandatory views;
- `EXP-CAP-019` is retired from the active capability matrix;
- `EXP-REQ-SCOPE-001` is retired from the active requirement inventory/status ledger;
- `EXP-FIND-001` is retained as resolved, non-blocking historical evidence;
- AC-5 and AC-10 no longer list `EXP-FIND-001` as a blocker;
- the exclusion ledger records the decision as resolved rather than optional/post-Genesis;
- the conflict register is now `resolved` with Resolution B selected;
- bidirectional traceability now covers 60 mandatory requirements and 10 remaining Genesis-blocking findings, with the resolved governance decision recorded separately.

## Expected state

After reconciliation:

- 60 active mandatory Genesis requirements;
- 0 active scope-decision requirements;
- 64 total active requirements including optional/post-Genesis entries;
- 10 remaining Genesis-blocking findings;
- 0 unresolved scope conflicts;
- 1 resolved scope conflict.

No acceptance criterion is promoted to satisfied by this step. Runtime, deployment, UI workflow, security, recovery and release-candidate qualification remain later work.

## Qualification gate

`scripts/verify-exp-0-3-8-scope-resolution.py` must fail closed unless the decision record, authoritative source wording, retired records, resolved historical finding, acceptance-map changes, scope-conflict register, status ledger, exclusion ledger and bidirectional traceability all agree.

The dedicated 0.3.8 verifier and every retained Explorer/Indexer/repository qualification gate must pass on the same exact head before EXP-0.3.8 can be marked complete.
