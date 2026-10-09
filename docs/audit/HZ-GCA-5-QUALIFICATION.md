# HZ-GCA-5 — Project workspace, versions, stems and storage qualification evidence

Status: **COMPLETE — Level 1**

Canonical roadmap step: **HZ-GCA-5 — Project workspace, versions, stems and storage**

## Qualification identity

- Repository: `abvhiael/420-integrated-v0.1`
- PR: **#565 — Add 420Hz Generate, Community & Awards roadmap phase**
- Branch: `feature/420hz-generate-community-awards-roadmap`
- Qualified implementation SHA: `f296e4a40ba2bba2d9ea033b682d185aa5b15973`
- Current main at evidence closeout: `f3221728500e5e280b8f29781ad7e3af42f5134a`
- Qualification level: **Level 1**
- Level 2: **NOT REQUIRED / NOT RUN**
- Level 3: **DEFERRED to HZ-GCA-17**

## Canonical requirements satisfied

- private generation projects;
- deterministic generation history/version tree;
- favorite/selected takes;
- stem/artifact manifests;
- lyrics and metadata drafts;
- delete/archive/export;
- storage integrity hashes;
- quota/resource accounting;
- no accidental public indexing of drafts;
- safe handling of incomplete/failed output sets.

Canonical exit:

**deterministic project state model and storage integration tests.**

## Repository inspection and current-main disposition

HZ-GCA-5 was implemented after the branch had already been reconciled to main `6a3c611a3c0629c9bbae1e67f992d98ba1787550`.

After exact-head HZ-GCA-5 qualification completed, main advanced to:

`f3221728500e5e280b8f29781ad7e3af42f5134a`

through the ReeferReview single-process RSS ingestion repair.

A base-to-main/base-to-branch comparison showed:

- ReeferReview executable changes under `cmd/reefer-*` and `reefer-review/`;
- no overlap with `hz/generate/`, HZ-GCA config, HZ-GCA architecture docs, or the HZ-GCA-5 CI workflow;
- the only accumulated feature-branch path overlap was global `docs/ROADMAP.md`, unrelated to HZ-GCA-5 runtime/storage semantics.

Therefore no ceremonial branch reconciliation was required for this ordinary step, and the exact tested HZ-GCA-5 implementation SHA remains authoritative for Level 1.

## Implementation completed

Added:

- `hz/generate/src/project-workspace.js`
- `hz/generate/test/project-workspace.test.js`
- `hz/config/gca-project-workspace-v1.json`
- `docs/architecture/420hz/HZ-GCA-5-PROJECT-WORKSPACE-STORAGE.md`
- `scripts/verify-420hz-gca-5.py`

Updated:

- `hz/generate/src/index.js`
- `hz/generate/package.json`
- `docs/420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md`
- `.github/workflows/420hz-web.yml`
- `.github/workflows/420hz-gca.yml`

## Project model

`ProjectWorkspace420` implements owner-scoped PRIVATE projects with ACTIVE / ARCHIVED / DELETED states.

Every project is:

- `visibility: PRIVATE`;
- `indexable: false`;
- readable/mutable only by the owning account.

`publicIndexRecords()` returns no workspace state.

## Version tree and drafts

Project history is immutable and parent-linked.

Version nodes cover:

- PROJECT_CREATED;
- DRAFT_UPDATED;
- GENERATION_RECORDED;
- TAKE_FAVORITED / TAKE_UNFAVORITED;
- TAKE_SELECTED;
- PROJECT_ARCHIVED;
- PROJECT_RESTORED.

Lyrics, title and metadata drafts are versioned private state.

## Takes and incomplete-output safety

Generation records map into COMPLETE / INCOMPLETE / FAILED / CANCELLED takes.

Only COMPLETE takes may be favorited.

Only COMPLETE takes containing a MIX may be selected.

FAILED, CANCELLED and INCOMPLETE records retain safe history only and cannot become selected/favorite release output.

## Artifact manifests and storage integrity

Complete takes can retain provider-neutral:

- MIX;
- STEM;
- LYRICS_TIMING;
- ARTWORK

manifest entries.

The local private-store qualification adapter records:

- opaque storage reference;
- SHA-256 integrity commitment;
- byte length;
- private storage class;
- source provider reference/integrity.

Reads revalidate integrity and fail closed on tampering.

## Quota/resource accounting

Quota is application/deployment configuration, not a protocol constant.

Accounting separates:

- private primary bytes;
- archived bytes;
- published external-reference bytes;
- object count.

Artifact writes are quota-preflighted before persistence. The implementation was explicitly repaired to preflight the aggregate artifact set before any write, preventing partial storage mutation when a multi-artifact generation would exceed quota.

Quota exhaustion returns `NO_CAPACITY` and does not silently delete existing saved work.

## Retention

HZ-GCA-5 implements the qualified HZ-GCA-1.8 boundaries:

- failed/cancelled takes: 7 days;
- unsaved takes: 30 days;
- active project inactivity: 365 days;
- archive grace: 30 days;
- export package: 24 hours.

Inactivity transitions to private archive and never public visibility.

## Archive, export and delete

Archive is private and bounded.

Restore is available only before archive expiry.

Export is owner-authenticated, integrity checked, includes project/version/take/integrity metadata, excludes secrets, and expires within 24 hours.

Delete:

- revokes application serving immediately;
- revokes indexing eligibility immediately;
- deletes application-controlled private object/export references;
- installs tombstones;
- prevents same-identity replay resurrection.

It does not claim physical deletion authority over external Resource/Storage replicas or immutable canonical history.

## Storage authority boundary

`DeterministicPrivateStorage420` is repository/local qualification infrastructure.

420Hz owns only its application-controlled private workspace state/deletion ledger.

420ResourceProtocol/420Store retain authority over their own:

- agreements;
- capacity;
- proofs;
- placement;
- settlement;
- external object lifecycle.

A storage reference/hash is not evidence that 420Hz can erase every external replica.

## Machine-readable invariants

`hz/config/gca-project-workspace-v1.json` freezes **HZGCA5-001 through HZGCA5-018**.

The invariants cover privacy, ownership, version-tree determinism, artifact completeness, take selection, storage integrity, quota preflight, retention, archive/export limits, deletion/tombstones, anti-resurrection, public-index exclusion, and authority separation.

## Level-1 qualification

Authoritative workflow:

**420Hz Web Qualification**

Successful exact-head run:

- Run ID: **37823618595**
- Run number: **#223**
- Job: **HZ-GCA-5 Level 1**
- Job ID: **113470663884**
- Exact tested SHA: `f296e4a40ba2bba2d9ea033b682d185aa5b15973`
- Result: **PASS**

Required results:

1. exact PR-head checkout/verification — PASS;
2. 420Hz generation/project syntax and Node qualification — **54 PASS / 0 FAIL / 0 SKIPPED**;
3. HZ-GCA-1.8 storage/retention verifier — PASS;
4. HZ-GCA-4 provenance verifier — PASS;
5. HZ-GCA-5 targeted verifier — PASS;
6. retained 420Hz web job — PASS.

No required HZ-GCA-5 check was skipped, cancelled, missing or untriggered.

## Security / adversarial result

Result: **PASS**

Coverage proves:

- another account cannot read a private project;
- workspace state never emits public index records;
- incomplete/failed takes cannot be selected;
- quota exhaustion fails before writes;
- stored object tampering fails integrity validation;
- archive expiry deletes/tombstones controlled storage;
- expired export access fails closed;
- explicit delete revokes serving/indexing;
- storage tombstones block replay resurrection;
- inactivity/archive never widens visibility.

## Level 2

**Not required / not run.**

HZ-GCA-5 is an ordinary app-scoped step. It implements the already-qualified HZ-GCA-1.8 storage policy and HZ-GCA-4 provenance boundary without materially changing shared Resource/Storage protocol authority.

## Intentionally deferred Level 3

Deferred to HZ-GCA-17:

- canonical full Solidity inventory;
- Genesis/address-authority qualification;
- 420 Integrated/global qualification;
- final Docs/global reconciliation;
- retained complete app/client/service/Indexer/Search/RPC/frontend/backend suites;
- global security/static/deployment/config closeout.

## Limitations

HZ-GCA-5 does not claim:

- live 420Store/Resource deployment;
- production storage agreements/proofs/placement;
- physical deletion of independently controlled replicas/backups;
- live Search/Indexer privacy probes;
- public testnet qualification;
- production storage quotas.

## Exit criteria verification

- private generation projects: **PASS**
- generation history/version tree: **PASS**
- favorite/selected takes: **PASS**
- stem/artifact manifests: **PASS**
- lyrics and metadata drafts: **PASS**
- delete/archive/export: **PASS**
- storage integrity hashes: **PASS**
- quota/resource accounting: **PASS**
- no accidental public indexing of drafts: **PASS**
- safe incomplete/failed output handling: **PASS**
- deterministic project state model: **PASS**
- storage integration tests: **PASS**
- exact-head Level-1 qualification: **PASS**
- required skipped/cancelled/missing checks: **NONE**

## Blockers

None.

## Completion state

**HZ-GCA-5 — COMPLETE (Level 1).**

Next canonical roadmap step:

**HZ-GCA-6 — 420Hz Generate Studio UX**
