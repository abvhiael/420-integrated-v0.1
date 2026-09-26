# EXP-0.3.4 — qualification-status freeze

**Status:** freeze ledger committed; exact-head qualification required before closeout.  
**Machine-readable ledger:** `docs/audit/EXP-0.3.4-qualification-status-freeze.json`.

## Objective

EXP-0.3.4 freezes the current qualification status of every authoritative 420Explorer Genesis requirement so later milestones cannot silently reinterpret source evidence as deployment, runtime, or Genesis qualification.

The ledger contains the same 65 authoritative requirements established in EXP-0.3.1 and gives each requirement exactly one frozen status.

## Frozen distribution

- 47 `source_qualified`
- 6 `implemented_source`
- 4 `partial_source`
- 1 `deployment_pending`
- 2 `runtime_unverified`
- 2 `optional_unimplemented`
- 2 `post_genesis`
- 1 `scope_decision_required`

No requirement is marked Genesis-qualified.

All AC-1 through AC-10 remain unverified.

## Promotion rules

The freeze distinguishes source evidence from later evidence:

- `source_qualified` and `implemented_source` do not imply deployment or live qualification.
- `partial_source` requires remediation plus mapped tests before promotion.
- `deployment_pending` requires a real non-placeholder deployment and live evidence.
- `runtime_unverified` requires target-network runtime/provenance evidence.
- optional/post-Genesis items remain non-blocking unless authoritative scope changes.
- governance remains `scope_decision_required` until the authoritative-source conflict is explicitly reconciled.

## Qualification gate

`scripts/verify-exp-0-3-4-status-freeze.py` fails closed unless:

1. all 65 EXP-0.3.1 requirements are present exactly once;
2. each frozen status exactly matches the current authoritative requirement inventory;
3. status counts remain 47/6/4/1/2/2/2/1;
4. all 10 required views preserve their EXP-0.3.2/0.3.3 source status;
5. Indexer chain source remains deployment-pending while readiness URL is `REPLACE`;
6. consensus and Registry sources remain runtime-unverified;
7. optional Names/Identity remain optional-unimplemented;
8. post-Genesis entries remain post-Genesis;
9. governance remains scope-decision-required while the source conflict exists;
10. no entry is marked Genesis-qualified;
11. AC-1 through AC-10 remain unverified;
12. every evidence reference exists;
13. every promotion gate is non-empty;
14. the freeze rules continue to distinguish source, deployment, runtime, and Genesis qualification.

## Completion condition

EXP-0.3.4 is qualified when this verifier and all retained Explorer/Indexer/repository qualification gates pass on the same exact head and the evidence artifact is uploaded.

Qualification freezes the current status model only. It does not advance any requirement to deployment, runtime, or Genesis acceptance.
