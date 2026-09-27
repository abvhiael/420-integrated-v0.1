# EXP-0.3.5 — optional and post-Genesis exclusion reconciliation

**Status:** exclusion matrix committed; exact-head CI qualification required before closeout.  
**Machine-readable matrix:** `docs/audit/EXP-0.3.5-nonblocking-scope-exclusions.json`.

## Objective

EXP-0.3.5 proves that optional integrations and post-Genesis enhancements cannot accidentally become core 420Explorer Genesis blockers.

The authoritative non-blocking set is exactly:

1. 420 Names display enrichment;
2. 420 Identity public display enrichment;
3. dedicated staking/reward-specific activity history;
4. 420 Verify-backed verified-source presentation.

These entries are intentionally separate from the mandatory required views and from unresolved scope decisions.

## Non-blocking rules

- Names and Identity remain optional display enrichments.
- Their absence, deployment state, or live qualification state cannot block core Explorer Genesis qualification.
- Dedicated staking/reward history remains post-Genesis; validator and epoch/rotation views remain mandatory and are not excluded.
- Verify-backed source presentation remains post-Genesis; runtime bytecode/code hash and raw contract inspection remain mandatory independent of Verify integration.
- Optional or post-Genesis entries carry no AC-1 through AC-10 mappings.
- Post-Genesis findings remain `genesis_blocking=false`.
- Optional dependencies may remain unimplemented or unverified without becoming core blockers.

## Governance is not excluded

The governance-view conflict is deliberately **not** part of this exclusion matrix.

It remains:

`scope_decision_required`

and remains Genesis-blocking for EXP-0 closeout because the frozen application-purpose description and the dedicated Explorer profile disagree.

EXP-0.3.5 must therefore fail if governance is silently reclassified as optional or post-Genesis without an explicit authoritative scope decision.

## Promotion discipline

An excluded item can become mandatory only if an explicit authoritative Genesis scope change occurs.

Such a change must then reconcile:

- the EXP-0.3.1 requirement inventory;
- EXP-0.2.4 dependency readiness;
- EXP-0.2.5 findings;
- EXP-0.2.6 acceptance criteria;
- EXP-0.3.4 frozen statuses;
- this EXP-0.3.5 exclusion matrix.

No implementation alone can silently promote optional/post-Genesis work into mandatory Genesis scope.

## Qualification gate

`scripts/verify-exp-0-3-5-nonblocking-exclusions.py` fails closed unless:

1. exactly four exclusions exist;
2. exactly two are `optional_integration`;
3. exactly two are `post_genesis_enhancement`;
4. every excluded requirement exists in EXP-0.3.1 with matching classification/status;
5. every excluded entry is frozen consistently in EXP-0.3.4;
6. every optional dependency is `required_for_genesis=false`;
7. EXP-DEP-009, EXP-DEP-010 and EXP-DEP-011 remain optional dependencies;
8. EXP-FIND-012 and EXP-FIND-014 remain `genesis_blocking=false`;
9. neither post-Genesis finding appears in any AC blocking-findings list;
10. excluded requirements carry no acceptance criteria;
11. profile `requiredViews` does not contain Names, Identity, staking/reward history or Verify presentation;
12. profile still declares Names and Identity as optional source enrichments;
13. governance remains `scope_decision_required`, Genesis-blocking, and outside the exclusion set;
14. summary counts remain 4 excluded / 2 optional / 2 post-Genesis / 0 blockers / 1 protected scope decision.

The verifier emits:

- `exp-0-3-5-evidence/summary.json`;
- `exp-0-3-5-evidence/exclusions.tsv`.

## Completion condition

EXP-0.3.5 is qualified when its dedicated verifier and all retained Explorer/Indexer/repository qualification gates pass on the same exact PR head and the evidence artifact is uploaded.

Qualification means optional and post-Genesis work is formally prevented from becoming an accidental core Genesis blocker. It does not resolve the governance scope decision.
