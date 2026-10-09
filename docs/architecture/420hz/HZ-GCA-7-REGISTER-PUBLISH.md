# HZ-GCA-7 — Register & Publish integration

Status: **COMPLETE — exact-head Level 1 + Generate milestone Level 2 qualified**

Canonical roadmap step: **HZ-GCA-7 — Register & Publish integration**

Machine-readable policy:

`hz/config/gca-register-publish-v1.json`

Implementation:

`hz/generate/src/register-publish.js`

HZ-GCA-7 connects qualified Generate outputs to the existing 420 Creative Protocol music primitives without inventing a second registration, rights, storage or catalog authority.

## Milestone classification

HZ-GCA-7 is the end of the Generate implementation sequence begun at HZ-GCA-2.

It therefore receives:

- ordinary step-specific **Level 1** qualification; and
- a **Level 2 Generate milestone** retained integration run covering HZ-GCA-2 through HZ-GCA-7 plus the directly consumed Creative kernel/indexer surfaces.

This remains app-focused. It is not the Level-3 repository-wide closeout.

## Creator Profile

The flow supports either:

- selecting an existing ACTIVE Creator Profile owned by the publishing account; or
- creating the repository/local deterministic equivalent of an ARTIST_PROJECT profile.

The local coordinator accepts the special `SELF` holder/contributor reference only as a request-time convenience. It is resolved to the exact Creator Profile ID before any rights or credit record is created.

It never means another profile's acceptance may be inferred.

## Work registration

A generated release first creates a PROVISIONAL Work carrying:

- composition hash;
- metadata hash;
- immutable HZ-GCA-4 generation-provenance commitment;
- provenance class;
- rights status;
- registrant Creator Profile.

The Work cannot become ACTIVE until its initial rights split is finalized.

## Contributor credits

Work and Recording contributor credits are explicit.

A credit records:

- asset type / ID;
- contributor Creator Profile;
- role schema version;
- role code;
- accepted/proposed status.

The local qualification flow preserves whether a contributor accepted the credit instead of treating a controller-created credit as automatically accepted by a different contributor.

## Rights split review and acceptance

Work and Recording rights are independent 10,000-bps pools, matching the Creative kernel.

The Register & Publish flow requires:

- non-zero holders;
- no duplicate holder;
- positive bps;
- exactly 10,000 total bps;
- explicit acceptance by every holder before finalization.

Activation is blocked until finalization.

## Recording registration

Recording registration requires an ACTIVE Work.

The Recording binds:

- registrant Creator Profile;
- Work;
- Recording class;
- master hash;
- metadata hash;
- exact generation-provenance commitment;
- media-manifest hash;
- authorization-manifest hash where applicable;
- royalty schedule version;
- authorization-policy version;
- optional parent/source Recording;
- optional source-license reference;
- exact AI disclosure class.

Recording begins PROVISIONAL.

It can become ACTIVE only after its independent Recording rights split is finalized and any required derivative authorization succeeds.

## Derivative/source authorization

Derivative classes are:

- COVER;
- REMIX;
- STEM_REMIX;
- SAMPLE_DERIVATIVE;
- AI_DERIVATIVE.

REMIX, STEM_REMIX, SAMPLE_DERIVATIVE and AI_DERIVATIVE require a source Recording.

Derivative publication fails closed unless an exact authorization reference is supplied and positively validated by the orchestration boundary.

AI_DERIVATIVE additionally requires explicit Creative transformation permission.

A 420AI training permission cannot substitute for Creative transformation authorization.

## Immutable generation provenance

HZ-GCA-7 validates the exact HZ-GCA-4 provenance record and computes a stable pre-publication commitment.

That commitment is carried into both Work and Recording registration.

Once Creator Profile, Work and Recording identities exist, HZ-GCA-7 invokes the HZ-GCA-4 publication finalizer and freezes:

- Creator Profile ID;
- Work ID;
- Recording ID;
- Creative provenance commitment;
- authorization-manifest commitment;
- publication timestamp;
- published provenance commitment.

Published provenance is not modified in place.

## AI disclosure publication

The HZ-GCA-4 AI disclosure class is retained unchanged through:

generation provenance → Recording metadata → Release metadata.

The Register & Publish coordinator does not infer a more favorable class from provider/model names or user-entered labels.

## Media and storage publication

Media publication occurs only after Recording activation.

The repository/local media record mirrors the Creative media boundary:

- manifest hash;
- master content hash;
- technical metadata hash;
- storage locator hash;
- provenance hash;
- duration.

At least one storage source is required with:

- provider key;
- locator hash;
- content hash;
- integrity hash;
- priority.

This does not claim physical storage-provider authority or deployment of 420ResourceProtocol/420Store.

## Catalog Release

The flow creates a DRAFT catalog Release.

The Recording is added only if it is ACTIVE.

Release publication requires:

- at least one track;
- ACTIVE Recording;
- published media metadata.

The final state is PUBLISHED.

The release metadata commits:

- title;
- AI disclosure class;
- published provenance commitment.

## Failure, rollback and retry

A successful generation never implies successful Creative registration.

The orchestrator records explicit stages:

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

A stage failure leaves the publication attempt FAILED and records the stage.

No Release is represented as PUBLISHED until every prior stage succeeds.

Partial canonical-like references are retained rather than pretending immutable registration can be rolled back by deletion.

Retry resumes the same normalized request and reuses already-created Work/Recording/Release identities.

A replay of an already-published request returns the same publication result.

## Repository/local qualification kernel

`DeterministicCreativeKernel420` is qualification infrastructure.

It mirrors the relevant authority/state ordering of:

- CreatorProfileRegistry420;
- WorkRegistry420;
- RecordingRegistry420;
- ContributorRegistry420;
- RightsRegistry420;
- AuthorizationRegistry420;
- MediaManifestRegistry420;
- StorageSourceRegistry420;
- CatalogRegistry420.

Its deterministic string IDs are local test identities, not claims about deployed on-chain numeric IDs.

## End-to-end flow

The HZ-GCA-7 test suite starts with the actual qualified Generate stack:

- HZ-GCA-2 generation job;
- deterministic provider execution;
- HZ-GCA-5 private project/save/select flow;
- HZ-GCA-4 provenance construction.

That saved complete take is then registered through:

Generate → Creator Profile → Work → Recording → media/storage → Release.

This directly satisfies the canonical exit on repository/local qualification infrastructure.

## Level 1

Directly applicable Level-1 checks are:

- complete `hz/generate` syntax/test suite;
- HZ-GCA-4 provenance verifier;
- HZ-GCA-5 workspace/storage verifier;
- HZ-GCA-6 Generate Studio verifier;
- HZ-GCA-7 targeted verifier;
- retained 420Hz web verifier.

## Level 2 — Generate milestone

HZ-GCA-7 is a sensible app integration milestone because HZ-GCA-2 through HZ-GCA-7 converge into the first complete Generate-to-Creative publication lifecycle.

The retained Level-2 suite covers:

- HZ-GCA-2 through HZ-GCA-7 verifiers;
- complete generation/project/register-publish tests;
- 420Hz web verification;
- targeted CreativeKernelAcceptance420 Foundry tests;
- Decision #10 deterministic Creative fixture generation;
- Creative reference indexer build and projection tests.

The Level-2 job must not run the full repository Foundry inventory. Full Solidity remains owned by the canonical Solidity workflow at Level 3.

## Authority boundaries

HZ-GCA-7 creates no new:

- Wallet signing/custody authority;
- Creative canonical authority;
- Rights/license authority;
- AI-training authority;
- external storage authority;
- payment/settlement authority;
- Search/Indexer authority;
- governance authority.

It orchestrates existing boundaries and proves the application sequencing.

## Limitations

HZ-GCA-7 does not claim:

- public-testnet registration;
- production chain transactions;
- deployed Creative addresses;
- Wallet signatures;
- live storage placement;
- royalty settlement;
- public release availability.

Those remain later testnet/production qualification concerns.

## Exit criteria

HZ-GCA-7 is complete when:

- Creator Profile create/select works;
- Work registration works;
- contributor credits are represented;
- Work/Recording rights splits require explicit acceptance and finalization;
- Recording registration/activation works;
- derivative/source authorization fails closed;
- immutable generation provenance is retained and finalized;
- AI disclosure is published unchanged;
- media/storage publication is sequenced after Recording activation;
- catalog Release reaches PUBLISHED only after all prerequisites;
- failure/retry/replay behavior prevents generation success from implying publication success;
- one complete Generate → Work → Recording → Release flow passes locally;
- exact-head Level 1 passes;
- Generate milestone Level 2 passes.

Next canonical roadmap step:

**HZ-GCA-8 — Community identity and social graph**


## Qualification result

Final reconciled implementation SHA:

`4ec2b353f3688b252df8c7d55dde7c7ea21a0ef9`

Authoritative workflow:

- **420Hz Web Qualification**
- Run: **37846580684** (#257)
- Result: **PASS**

Level 1:

- Job: **HZ-GCA-7 Level 1**
- Job ID: **113548844949**
- exact-head checkout: PASS
- complete 420Hz generation/register-publish suite: **67 PASS / 0 FAIL / 0 SKIPPED**
- HZ-GCA-4 provenance verifier: PASS
- HZ-GCA-5 project/storage verifier: PASS
- HZ-GCA-6 Generate Studio verifier: PASS
- HZ-GCA-7 targeted verifier: PASS
- 420Hz web verifier: PASS

Generate milestone Level 2:

- Job: **HZ-GCA-7 Generate Milestone Level 2**
- Job ID: **113548845001**
- exact-head checkout: PASS
- complete Generate implementation suite: **67 PASS / 0 FAIL / 0 SKIPPED**
- Generate Studio state model: **10 PASS / 0 FAIL / 0 SKIPPED**
- HZ-GCA-2 through HZ-GCA-7 targeted verifiers: PASS
- 420Hz web verifier: PASS
- targeted `CreativeKernelAcceptance420` Foundry qualification: **13 PASS / 0 FAIL / 0 SKIPPED** across the acceptance and royalty-allocation fuzz suites
- Decision #10 deterministic Creative fixture generation: PASS
- Creative reference indexer dependency install/build: PASS
- Creative reference projection tests: **4 PASS / 0 FAIL / 0 SKIPPED**

Before final qualification, current `main` advanced to `ffc6a4028676907c266714b5c1ae8ba3af9a7137` with Compute web/logo changes. There were no overlapping paths with the HZ-GCA branch. The branch was nevertheless reconciled because HZ-GCA-7 is the Generate milestone boundary, producing exact candidate `4ec2b353f3688b252df8c7d55dde7c7ea21a0ef9`, and both required levels were rerun successfully against that exact SHA.

The full repository Solidity inventory was intentionally not run at this Level-2 milestone; it remains owned by the canonical Solidity workflow at HZ-GCA-17 Level 3.
