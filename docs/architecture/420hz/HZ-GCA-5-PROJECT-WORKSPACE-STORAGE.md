# HZ-GCA-5 — Project workspace, versions, stems and storage

Status: **COMPLETE — Level 1 exact-head qualified**

Canonical roadmap step: **HZ-GCA-5 — Project workspace, versions, stems and storage**

Machine-readable policy: `hz/config/gca-project-workspace-v1.json`

Implementation: `hz/generate/src/project-workspace.js`

HZ-GCA-5 implements the creator-side private project workspace on top of the already-qualified generation/provenance boundaries.

## Project state

Projects are always `PRIVATE` and `indexable:false`. Reads and mutations are owner-scoped.

The workspace tracks ACTIVE, ARCHIVED and DELETED states plus immutable parent-linked version nodes for project creation, draft changes, generation records, selected/favorite takes and archive/restore transitions.

Lyrics, title and metadata remain private draft state and are never exposed through a public indexing projection.

## Generation history and takes

Generation results become project takes.

- COMPLETE takes may carry provider-neutral MIX/STEM/LYRICS_TIMING/ARTWORK manifests.
- selected takes must be COMPLETE and contain a MIX.
- favorite takes must be COMPLETE.
- FAILED/CANCELLED/INCOMPLETE records are preserved only as safe history and cannot become selected/favorite output.

This prevents partial provider output or failure state from being mistaken for a usable release artifact.

## Storage integration

`DeterministicPrivateStorage420` provides repository/local private-store qualification.

It stores opaque private references with SHA-256 integrity commitments and revalidates integrity on read.

Application-controlled deletion tombstones storage identities so replay/restore under the same object identity cannot resurrect deleted data.

This adapter is qualification infrastructure only. It does not replace 420ResourceProtocol/420Store authority over real storage agreements, proofs, placement, settlement or external replicas.

## Quota/resource accounting

Quota limits are constructor/deployment configuration, not protocol constants.

Accounting separates:

- private primary bytes;
- archived bytes;
- published external-reference bytes;
- object count.

Writes are quota-preflighted atomically before artifact persistence. Quota exhaustion fails closed and never silently discards unrelated saved work.

## Retention

HZ-GCA-5 executes the HZ-GCA-1.8 policy boundaries:

- failed/cancelled takes: 7 days;
- unsaved takes: 30 days;
- active-project inactivity: 365 days;
- archive grace: 30 days;
- export package: 24 hours.

Archive remains private and time-bounded. Inactivity never changes a project to public visibility.

## Delete/archive/export

Archive moves a project to a private bounded grace state and supports restore before expiry.

Export is authenticated and contains project summary, version history, take manifests and integrity references. Export packages expire within 24 hours and explicitly exclude secrets.

Delete immediately revokes application serving/indexing, tombstones private storage identities, removes controlled artifact/export references and does not pretend to erase immutable canonical chain/Creative history or external replicas outside 420Hz control.

## No accidental public indexing

`publicIndexRecords()` returns no private workspace records.

Private projects, lyrics drafts, metadata drafts, failed outputs and archives are therefore not eligible Search/Indexer source material at this step.

## Tests

`hz/generate/test/project-workspace.test.js` covers privacy, owner isolation, version trees, artifact manifests, integrity verification, favorite/selected constraints, incomplete/failed output handling, quota failure, archive/restore/expiry, export expiry/access control, deletion, anti-resurrection and retention sweeps.

## Qualification

HZ-GCA-5 is an ordinary **Level 1** app-scoped step.

Directly applicable retained checks are HZ-GCA-1.8 storage/retention and HZ-GCA-4 provenance boundaries plus the complete generation/project Node suite and HZ-GCA-5 targeted verifier.

No Level-2 milestone is introduced.

## Exit criteria

HZ-GCA-5 is complete when every canonical requirement is implemented and the exact-head Level-1 suite passes with no required skipped/cancelled/missing checks.

Next canonical step: **HZ-GCA-6 — 420Hz Generate Studio UX**


## Qualification result

Qualified implementation SHA:

`f296e4a40ba2bba2d9ea033b682d185aa5b15973`

Authoritative workflow:

- **420Hz Web Qualification**
- Run: **37823618595** (#223)
- Job: **HZ-GCA-5 Level 1**
- Job ID: **113470663884**
- Result: **PASS**

Exact-head required results:

- complete 420Hz generation/project suite: **54 PASS / 0 FAIL / 0 SKIPPED**
- HZ-GCA-1.8 storage/retention verifier: **PASS**
- HZ-GCA-4 provenance verifier: **PASS**
- HZ-GCA-5 targeted verifier: **PASS**
- retained 420Hz web job: **PASS**

Current `main` advanced after the implementation run to `f3221728500e5e280b8f29781ad7e3af42f5134a` through an unrelated ReeferReview RSS repair. The executable main delta is confined to ReeferReview; the only path overlap with the accumulated feature branch is global `docs/ROADMAP.md`. It does not alter the 420Hz generation/project module, storage policy, provenance policy, or active HZ-GCA-5 qualification workflow. Under the ordinary-step policy this does not justify ceremonial reconciliation or invalidate the exact-head HZ-GCA-5 Level-1 result.

No Level-2 milestone is required for HZ-GCA-5. Level-3 repository-wide qualification remains deferred to HZ-GCA-17.
