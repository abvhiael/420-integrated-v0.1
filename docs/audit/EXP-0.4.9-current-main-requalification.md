# EXP-0.4.9 — current-main reconciliation and requalification

**Status:** implementation complete; exact-head qualification required.

## Purpose

EXP-0.4.9 proves that the cumulative Explorer audit work is reconciled against the repository's current `main` lineage before EXP-0 closes.

At implementation start, current `main` is:

`304cb61286c94f72d0b05e32e5f713b9d68bc450`

The cumulative EXP-0.4 branch is ahead of that commit and **0 commits behind**. The same SHA was the main baseline at EXP-0.4.1, so no intervening mainline change requires a reconciliation merge.

## Reconciliation requirements

The verifier fails closed unless:

- current-main SHA `304cb612…` is an ancestor of the exact qualification head;
- the final EXP-0.4.8 qualified head `a9a5e640…` is also an ancestor;
- every branch delta from current main is confined to EXP-0.4 audit records, EXP-0.4 verifier scripts, or the retained 420Indexer workflow;
- the retained verifier chain includes EXP-0.4.1 through EXP-0.4.9;
- canonical status remains 60 mandatory requirements, 10 active Genesis blockers, 10 unverified ACs and 0 Genesis-qualified requirements.

## Exact-head qualification

The implementation head must pass:

1. 420Indexer, including the dedicated EXP-0.4.9 verifier;
2. 420Docs Qualification;
3. 420 Integrated Qualification:
   - offline-core,
   - production-dependencies,
   - geth-engine,
   - fault-matrix.

A green run proves only the repository/current-main reconciliation scope. It does not establish runtime, deployment, live-network or Genesis qualification.
