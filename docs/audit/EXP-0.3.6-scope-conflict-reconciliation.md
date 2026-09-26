# EXP-0.3.6 — scope-conflict resolution register

**Status:** conflict register committed; exact-head CI qualification required before closeout.  
**Machine-readable register:** `docs/audit/EXP-0.3.6-scope-conflict-resolution-register.json`.

## Objective

EXP-0.3.6 creates a fail-closed register for authoritative Genesis-scope conflicts.

The current register contains exactly one conflict:

**Governance view**

The frozen Genesis application-purpose record names governance as part of 420 Explorer's purpose, while the dedicated Explorer Genesis profile omits governance from `requiredViews`.

This step does not guess which source should win.

## Conflict chain

The active conflict is traced end-to-end:

- `EXP-CAP-019` — governance view, `scope_decision_required`;
- `EXP-FIND-001` — Genesis-blocking scope/documentation gap;
- `EXP-REQ-SCOPE-001` — authoritative requirement requiring explicit resolution;
- `AC-5` and `AC-10` — blocked until the final scope is reconciled.

The qualified required-view path set contains no dedicated governance implementation path.

## Admissible resolutions

Only two outcomes are accepted by the register.

### Resolution A — governance becomes mandatory

An explicit authoritative decision may declare governance a mandatory Explorer Genesis view.

That requires:

- adding governance to the dedicated profile;
- defining a real Explorer/Indexer implementation path;
- adding user workflow, API/UI, data-source and test requirements;
- converting the scope conflict into concrete implementation/runtime qualification work;
- updating all downstream matrices and acceptance criteria;
- qualifying the new capability before closeout.

A label-only reclassification is prohibited.

### Resolution B — governance is descriptive, not a dedicated required view

An explicit authoritative decision may state that the broad application-purpose wording describes ecosystem subject matter rather than a mandatory dedicated Explorer view.

That requires:

- amending or clarifying the frozen application-purpose source;
- retiring the scope-decision capability/requirement;
- closing EXP-FIND-001;
- removing its AC-5/AC-10 blocking effect only after the authoritative sources agree;
- rerunning the retained qualification gates.

Deleting the blocker without reconciling the source wording is prohibited.

## Atomic reconciliation

A decision must update the full reconciliation manifest together:

- frozen application purpose;
- dedicated Explorer Genesis profile;
- capability matrix;
- workflow matrix;
- gap register;
- acceptance map;
- requirement inventory;
- capability path map;
- acceptance-test map;
- status freeze;
- exclusion matrix;
- scope-conflict register.

This prevents a scope decision from leaving contradictory qualified artifacts behind.

## Qualification meaning

EXP-0.3.6 can be qualified while the governance conflict remains unresolved.

Qualification means:

- the conflict is explicitly registered;
- its source disagreement is mechanically verified;
- its blocker chain is intact;
- only valid resolution paths are allowed;
- downstream reconciliation is enumerated;
- final EXP-0 closeout remains fail-closed.

It does **not** mean the governance decision itself has been made.

## Qualification gate

`scripts/verify-exp-0-3-6-scope-conflicts.py` fails closed unless:

1. exactly one scope conflict exists;
2. it is the governance-view conflict;
3. source A still names governance;
4. source B still omits governance from `requiredViews`;
5. EXP-CAP-019 remains `scope_decision_required`;
6. EXP-FIND-001 remains Genesis-blocking;
7. EXP-REQ-SCOPE-001 remains `scope_decision_required`;
8. EXP-0.3.4 freezes the same unresolved status;
9. EXP-0.3.5 protects governance from optional/post-Genesis exclusion;
10. AC-5 and AC-10 still list EXP-FIND-001 as blocking;
11. both admissible resolution paths exist with required actions and prohibited shortcuts;
12. every file in the atomic reconciliation manifest exists;
13. the conflict remains unresolved until an explicit decision record exists;
14. summary counts remain 1 conflict / 1 unresolved / 1 blocker / 2 admissible resolutions;
15. final EXP-0 closeout remains blocked while the conflict is unresolved.

The verifier emits:

- `exp-0-3-6-evidence/summary.json`;
- `exp-0-3-6-evidence/conflicts.tsv`.

## Completion condition

EXP-0.3.6 is qualified when the dedicated verifier and all retained Explorer/Indexer/repository qualification gates pass on the same exact head and the evidence artifact is uploaded.

The subsequent scope-decision step may then resolve the governance question using one of the two registered paths.
