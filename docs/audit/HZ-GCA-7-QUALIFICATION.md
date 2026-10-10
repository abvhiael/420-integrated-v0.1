# HZ-GCA-7 — Register & Publish integration qualification evidence

Status: **COMPLETE — Level 1 + Generate milestone Level 2**

Canonical roadmap step: **HZ-GCA-7 — Register & Publish integration**

## Qualification identity

- Repository: `abvhiael/420-integrated-v0.1`
- PR: **#565 — Add 420Hz Generate, Community & Awards roadmap phase**
- Branch: `feature/420hz-generate-community-awards-roadmap`
- Current main reconciled into the qualification candidate: `ffc6a4028676907c266714b5c1ae8ba3af9a7137`
- Qualified implementation SHA: `4ec2b353f3688b252df8c7d55dde7c7ea21a0ef9`
- Evidence SHA: the commit containing this document; completion reporting records the resulting exact evidence HEAD.
- Level 1: **PASS**
- Generate milestone Level 2: **PASS**
- Level 3: **DEFERRED to HZ-GCA-17**

## Canonical requirement

HZ-GCA-7 closes the first Generate milestone by connecting the already-qualified HZ-GCA-2 through HZ-GCA-6 flow to existing 420 Creative primitives.

Required work:

- create or select Creator Profile;
- register Work;
- register Recording;
- contributor credits;
- rights split review/acceptance;
- derivative/source authorization checks;
- immutable generation-provenance commitment;
- AI disclosure publication;
- media manifest/storage publication;
- catalog Release creation;
- rollback/failure handling so generation success never implies registration success.

Canonical exit:

**one complete Generate -> Work -> Recording -> Release flow on repository/local qualification infrastructure**, followed by exact-head Level 1 and app-focused Generate milestone Level 2 qualification.

## Repository and current-main reconciliation

The initial HZ-GCA-7 implementation qualified successfully on SHA:

`40a7f408f2585a53099dc041f5330365e4d537c3`

using 420Hz Web Qualification run `37844712657` (#256), where both HZ-GCA-7 Level 1 and Generate milestone Level 2 passed.

After that run, current `main` advanced to:

`ffc6a4028676907c266714b5c1ae8ba3af9a7137`

with Compute web/logo changes:

- `compute/web/compute-market-logo.png`
- `compute/web/favicon-192.png`
- `compute/web/favicon-32.png`
- `compute/web/index.html`
- `compute/web/scripts/build.mjs`
- `compute/web/styles.css`

A base/main/branch comparison found **zero overlapping changed paths** with the HZ-GCA branch.

Because HZ-GCA-7 is the Generate milestone boundary rather than an ordinary isolated step, the branch was nevertheless reconciled before final closeout.

Final reconciled implementation candidate:

`4ec2b353f3688b252df8c7d55dde7c7ea21a0ef9`

The complete required Level-1 and Level-2 suites were then rerun on that exact SHA.

## Implementation

HZ-GCA-7 adds the deterministic application orchestration required to move a saved COMPLETE generated take through Creative registration/publication semantics while retaining canonical authority boundaries.

Primary artifacts:

- `hz/generate/src/register-publish.js`
- `hz/generate/test/register-publish.test.js`
- `hz/config/gca-register-publish-v1.json`
- `docs/architecture/420hz/HZ-GCA-7-REGISTER-PUBLISH.md`
- `scripts/verify-420hz-gca-7.py`
- Level-1 and Generate-milestone Level-2 jobs in `.github/workflows/420hz-web.yml`

## Creator Profile

The flow supports:

- selecting an existing ACTIVE Creator Profile owned by the publisher; or
- creating the deterministic local equivalent of an ARTIST_PROJECT profile.

An unauthorized existing profile selection fails closed.

The request-time `SELF` shorthand is resolved to the exact Creator Profile before rights or contributor records are created.

It does not infer another person's acceptance.

## Work registration

Work begins PROVISIONAL and binds:

- registrant Creator Profile;
- composition hash;
- metadata hash;
- exact HZ-GCA-4 generation-provenance commitment;
- provenance class;
- rights status.

Work activation is blocked until its independent initial rights split has been accepted and finalized.

## Contributor credits

Work and Recording contributor credits are explicit records.

Credit acceptance state is retained.

A controller cannot fabricate another contributor's acceptance.

## Rights review and acceptance

Work and Recording pools are independent 10,000-bps splits.

Qualification enforces:

- non-empty holders;
- no duplicate holder;
- positive shares;
- exact 10,000-bps total;
- explicit holder acceptance;
- finalization before asset activation.

## Recording registration

Recording registration requires an ACTIVE Work.

Recording binds:

- Creator Profile;
- Work;
- Recording class;
- master hash;
- metadata hash;
- generation-provenance commitment;
- media-manifest hash;
- authorization-manifest hash when required;
- royalty schedule version;
- authorization-policy version;
- optional source Recording/license;
- exact AI disclosure class.

Recording begins PROVISIONAL and activates only after its independent Recording rights split is finalized and derivative authorization requirements are satisfied.

## Derivative/source authorization

Derivative classes remain:

- COVER;
- REMIX;
- STEM_REMIX;
- SAMPLE_DERIVATIVE;
- AI_DERIVATIVE.

REMIX, STEM_REMIX, SAMPLE_DERIVATIVE and AI_DERIVATIVE require a source Recording.

Derivative publication fails closed without positively validated Creative authorization.

AI_DERIVATIVE requires explicit Creative transformation permission.

420AI training permission cannot substitute for Creative transformation authorization.

## Immutable provenance

HZ-GCA-7 validates the HZ-GCA-4 provenance record and commits the exact pre-publication provenance through Work and Recording.

Publication finalization freezes:

- Creator Profile ID;
- Work ID;
- Recording ID;
- Creative provenance commitment;
- authorization-manifest commitment;
- publication timestamp;
- published provenance commitment.

Published provenance is immutable; correction requires a later version/supersession path rather than in-place mutation.

## AI disclosure

The HZ-GCA-4 AI disclosure class is retained unchanged through:

generation provenance -> Recording metadata -> Release metadata.

Provider/model labels do not rewrite disclosure.

## Media/storage publication

Media publication is sequenced after Recording activation.

The local qualification record carries:

- manifest hash;
- master content hash;
- technical metadata hash;
- storage locator hash;
- provenance hash;
- duration;
- storage source/integrity metadata.

This is metadata/application qualification only and does not claim external 420ResourceProtocol/420Store authority.

## Catalog Release

Release begins DRAFT.

A track can be added only for an ACTIVE Recording.

Release publication requires:

- an ACTIVE Recording;
- media publication;
- finalized provenance;
- valid release metadata.

Final state is PUBLISHED.

## Failure/retry/replay

The coordinator records explicit progression:

1. PROFILE_READY
2. WORK_REGISTERED
3. WORK_RIGHTS_FINALIZED
4. WORK_ACTIVE
5. RECORDING_REGISTERED
6. RECORDING_RIGHTS_FINALIZED
7. RECORDING_ACTIVE
8. MEDIA_PUBLISHED
9. PROVENANCE_FINALIZED
10. RELEASE_DRAFT
11. RELEASE_PUBLISHED

Generation SUCCEEDED never implies any later Creative state.

A failure records the stage and retains already-created deterministic references rather than pretending immutable writes disappeared.

Retry resumes the same normalized request.

Replay of an already-published request returns the same publication identity rather than duplicating Work/Recording/Release state.

## Repository/local Creative kernel

`DeterministicCreativeKernel420` mirrors the ordering and authority constraints needed from:

- CreatorProfileRegistry420;
- WorkRegistry420;
- RecordingRegistry420;
- ContributorRegistry420;
- RightsRegistry420;
- AuthorizationRegistry420;
- MediaManifestRegistry420;
- StorageSourceRegistry420;
- CatalogRegistry420.

It is qualification infrastructure only.

Its deterministic string IDs are not deployed chain IDs.

## Level 1 qualification

Final authoritative workflow:

**420Hz Web Qualification**

Run:

- Run ID: **37846580684**
- Run number: **#257**
- Exact implementation SHA: `4ec2b353f3688b252df8c7d55dde7c7ea21a0ef9`
- Workflow result: **PASS**

HZ-GCA-7 Level 1:

- Job ID: **113548844949**
- exact-head checkout/verification: PASS;
- complete 420Hz generation/register-publish Node suite: **67 PASS / 0 FAIL / 0 SKIPPED**;
- HZ-GCA-4 provenance verifier: PASS;
- HZ-GCA-5 project/storage verifier: PASS;
- HZ-GCA-6 Generate Studio verifier: PASS;
- HZ-GCA-7 targeted verifier: PASS;
- 420Hz web verifier: PASS.

No required HZ-GCA-7 Level-1 check was skipped, cancelled, missing or untriggered.

## Generate milestone Level 2 qualification

Final authoritative Level-2 job:

- Job: **HZ-GCA-7 Generate Milestone Level 2**
- Job ID: **113548845001**
- Exact implementation SHA: `4ec2b353f3688b252df8c7d55dde7c7ea21a0ef9`
- Result: **PASS**

Retained milestone results:

- complete Generate implementation suite: **67 PASS / 0 FAIL / 0 SKIPPED**;
- Generate Studio state model: **10 PASS / 0 FAIL / 0 SKIPPED**;
- HZ-GCA-2 through HZ-GCA-7 targeted verifiers: PASS;
- 420Hz web verifier: PASS;
- targeted `CreativeKernelAcceptance420` Foundry tests: **13 PASS / 0 FAIL / 0 SKIPPED** total:
  - CreativeKernelAcceptance420Test: **11 PASS**;
  - RoyaltyAllocationFuzz420Test: **2 PASS**, each with 10,000 fuzz runs;
- deterministic Decision #10 Creative fixture generation: PASS;
- Creative indexer dependency install: PASS;
- Creative indexer build: PASS;
- Creative reference projection tests: **4 PASS / 0 FAIL / 0 SKIPPED**;
- PostgreSQL-backed indexer test service initialized and stopped successfully.

No required HZ-GCA-7 Level-2 check was skipped, cancelled, missing or untriggered.

## Solidity qualification boundary

The Level-2 milestone intentionally ran only:

`forge test --match-path test/CreativeKernelAcceptance420.t.sol -vvv`

plus the deterministic Decision #10 fixture generation required by the Creative indexer.

It did **not** run or duplicate the canonical complete repository Foundry inventory.

That remains the responsibility of the Solidity Contracts workflow at HZ-GCA-17 Level 3.

## Security / adversarial result

Result: **PASS**

The retained Generate and Creative suites cover:

- unauthorized Creator Profile selection;
- non-10,000-bps rights splits;
- duplicate or unaccepted rights holders;
- activation before rights finalization;
- derivative activation without source authorization;
- exhausted/expired license conditions;
- AI training vs transformation non-substitution;
- immutable provenance linkage;
- generation success without registration success;
- idempotent replay/retry;
- failed orchestration withholding Release publication;
- finalized split replacement/dilution rejection;
- settlement replay rejection;
- royalty gross-conservation fuzz checks;
- indexer deterministic reference projection.

## Authority boundaries

HZ-GCA-7 creates no new:

- Wallet signing/custody authority;
- Creative canonical authority;
- Rights/license authority;
- AI training authority;
- external storage authority;
- payment/settlement authority;
- Search/Indexer authority;
- governance authority.

The local orchestration proves sequencing; it does not become canonical protocol truth.

## Level 3 deferred work

Deferred to **HZ-GCA-17**:

- complete canonical Solidity inventory;
- Genesis/address-authority qualification;
- 420 Integrated/global qualification;
- Geth/global fault/soak where applicable;
- final Docs/global reconciliation;
- comprehensive app/client/service/Indexer/Search/RPC/frontend/backend coverage;
- final security/static/deployment/config closeout.

## Limitations

HZ-GCA-7 does not claim:

- public-testnet Creative registration;
- production chain transactions;
- deployed Creative addresses;
- Wallet signatures;
- live external storage placement;
- royalty settlement;
- production/public release availability.

Those remain later testnet/production qualification concerns.

## Exit criteria verification

- create/select Creator Profile: **PASS**
- register Work: **PASS**
- register Recording: **PASS**
- contributor credits: **PASS**
- Work rights review/acceptance/finalization: **PASS**
- Recording rights review/acceptance/finalization: **PASS**
- derivative/source authorization: **PASS**
- AI training does not substitute for Creative transformation permission: **PASS**
- immutable generation-provenance commitment: **PASS**
- AI disclosure publication: **PASS**
- media manifest/storage metadata publication: **PASS**
- catalog Release creation/publication: **PASS**
- failure/rollback semantics: **PASS**
- retry/replay idempotency: **PASS**
- one complete Generate -> Work -> Recording -> Release flow: **PASS**
- exact-head Level 1: **PASS**
- Generate milestone Level 2: **PASS**
- required skipped/cancelled/missing checks: **NONE**

## Blockers

None.

## Completion state

**HZ-GCA-7 — COMPLETE (Level 1 + Generate milestone Level 2).**

Next canonical roadmap step:

**HZ-GCA-8 — Community identity and social graph**
