# EXP-0.4.9 — current-main reconciliation and requalification

**Status:** qualified at repository scope; final evidence-recording head requalification required.

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


## Exact-head implementation qualification

Qualified implementation head: `b984f978e24721163241683c5561146fe3712dd2`

Current-main reconciliation at qualification:

- current `main`: `304cb61286c94f72d0b05e32e5f713b9d68bc450`;
- audit branch ahead: 90 commits;
- audit branch behind: 0 commits;
- merge base: `304cb61286c94f72d0b05e32e5f713b9d68bc450`;
- unexpected product/runtime deltas: 0.

Qualification runs:

- 420Indexer #662 — run `36335007750`, job `108664069317` — success.
- 420Docs Qualification #2998 — run `36335007754`, job `108664121649` — success.
- 420 Integrated Qualification #5615 — run `36335007831` — success.
  - offline-core `108664248592` — success.
  - geth-engine `108664248654` — success.
  - production-dependencies `108664248718` — success.
  - fault-matrix `108664248736` — success.
- EXP-0.4.9 artifact `10936173702`.
- Digest `sha256:641ca96c3dbe0099c6d84b71a66711be545197a9b422fb938434697c12976988`.

Recording this evidence changes the branch SHA. The resulting head must be requalified before EXP-0.4.9 is marked COMPLETE.
