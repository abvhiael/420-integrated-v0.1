# EXP-2R — Phase 2 Post-Merge Reconciliation

Baseline: `52a162612257122d4c6b6e2ab9e8bc163d1d5f6f` (PR #381 merge commit).

PR #381 final qualified head: `26a06117c7662c0f8986a2f7b505d5180d3121ea`.

## Result

EXP-2R does not restart the Explorer audit and does not renumber lost historical roadmap steps.

The recoverable original roadmap evidence establishes:

- EXP-2 — Core Explorer services and APIs.
- EXP-2.1 — transaction fee model/API.
- EXP-2.2 — HTTP/API route contracts.
- EXP-2.3 — core data services.

The exact original definitions/order for EXP-2.4 through EXP-2.10 were not recovered. Current repository EXP-2.4 through EXP-2.6 are retained as useful, qualified reconstructed milestones, but are not represented as proof of the lost original numbering.

No repository file, issue or reliable commit history was found that establishes historical EXP-2.7 through EXP-2.10 definitions.

## Merged Phase-2 state

| Milestone | Repository state | Remaining boundary |
|---|---|---|
| EXP-2.1 | qualified repository scope | deployed UI fee rendering, live witness, Genesis closeout |
| EXP-2.2 | COMPLETE | deployed/live/Registry-runtime evidence |
| EXP-2.3 | COMPLETE | deployed UI and dependency witnesses |
| EXP-2.4 | COMPLETE | deployed consensus witness, live producer comparison, UI workflow |
| EXP-2.5 | COMPLETE after EXP-2R evidence reconciliation | deployed raw-event UI, optional decoded diagnostics, live witness |
| EXP-2.6 | COMPLETE | live Registry publication, deployed troubleshooting, recovery |

## EXP-2.5 reconciliation

The stale EXP-2.5 status was bookkeeping, not an implementation failure.

EXP-2.5 passed on:

- candidate head `0db5f76d4038a03ae19a0a64e7c294203ec95919`, run `36384004251`;
- later exact head `78ca89dd5302b1655a7a0592bf79473783db2f59`, run `36384607389`;
- EXP-2.6 final evidence head `c0b40a61b95192627fd21fabfe7349ecda5a4360`, run `36454719177`;
- PR #381 final exact head `26a06117c7662c0f8986a2f7b505d5180d3121ea`, run `36455530414`.

The PR head and merge commit differ by the merge node only; the compare has zero changed files.

## Remaining repository-scope work

PR #381 closes the remaining Phase-2 backend/service/API work identified by the reconciled audit. The next repository work is outside that completed backend slice:

1. Registry ABI/descriptor release provenance.
2. Browser fee and raw-event presentation.
3. Browser producer/validator and cross-resource workflow closeout.
4. Release-scope unsafe/untrusted rendering coverage.

These are now assigned new identifiers in `EXP-2R.5-authoritative-next-phase-roadmap.json`. The new identifiers are explicitly not reconstructed EXP-2.7–EXP-2.10 labels.

## Live/deployment work remains separate

The following are not qualified by EXP-2R:

- a deployed 420Indexer endpoint;
- production Explorer deployment;
- approved live RPC/source binding;
- live ProtocolRegistry code/publication provenance;
- deployed consensus-provider witness;
- live block-to-producer comparison;
- production-equivalent recovery;
- final Genesis closeout.

Explorer and 420Indexer remain derived/non-authoritative services.

## EXP-2R steps

- **EXP-2R.1** — merged Phase-2 source/evidence inventory.
- **EXP-2R.2** — audit-record and exact-head evidence reconciliation.
- **EXP-2R.3** — requirements/gap/workflow ownership reconciliation.
- **EXP-2R.4** — remaining repository blocker determination.
- **EXP-2R.5** — authoritative next-phase roadmap.

No feature changes are permitted in EXP-2R.1–2R.4 unless a concrete merged-code defect is discovered.
