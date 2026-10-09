# HZ-GCA-4 — Provenance, consent and AI rights metadata

Status: **COMPLETE — Level 1 exact-head qualified**

Canonical roadmap step:

**HZ-GCA-4 — Provenance, consent and AI rights metadata**

Machine-readable policy:

`hz/config/gca-provenance-consent-rights-v1.json`

Implementation:

`hz/generate/src/provenance.js`

HZ-GCA-4 turns the provenance, rights and consent boundaries frozen in HZ-GCA-1.4 through HZ-GCA-1.6 into executable application validation for generated outputs.

## Provenance record

The runtime record binds:

- stable provenance record identity;
- provenance schema/policy version;
- generation manifest hash;
- creator Wallet/SmartAccount reference;
- creation timestamp;
- provider ID and revision;
- model ID and model version;
- request commitment;
- result commitment;
- result-manifest hash;
- verification reference when present;
- AI disclosure class and declaration commitment;
- source Work/Recording/License/authorization references;
- transformation and training authorization references in separate fields;
- synthetic voice/persona consent evidence when applicable;
- output artifact commitments;
- optional creator-published prompt/lyrics references;
- exact publication snapshot once registered/published.

These references preserve linkage. They do not move authority from Creative, 420AI, Wallet, Compute or any consent source into 420Hz.

## Private prompt / lyric boundary

Public provenance must never embed private generation plaintext.

The executable validator rejects fields named:

- `prompt`;
- `lyrics`;
- `rawReferenceAudio`;
- `referenceAudioBytes`;
- `privateAudio`;
- `audioBytes`.

Private prompts, lyric drafts and reference audio remain off-chain by default.

If a creator intentionally publishes prompt or lyric material, provenance may contain an explicit public reference such as `creatorPublishedInputRefs.promptRef` or `lyricsRef`. The provenance record still does not embed the private plaintext itself.

## Generation manifest and job linkage

`provenanceFromSucceededJob420` builds provenance only from a generation job in `SUCCEEDED` state.

The job bridge binds:

- `job.requestDigest` as request commitment unless an exact stronger commitment is supplied;
- provider/model/version from the exact selected provider binding;
- canonical/provider result commitment retained by the generation lifecycle;
- verified output-manifest digest;
- artifact integrity commitments;
- optional verification reference.

An unfinished job cannot be promoted to a completed provenance record.

HZ-GCA-4 also extends the HZ-GCA-2 generation state with an `executionEvidence` snapshot so result, verification, entitlement and settlement references observed from a provider can be retained for provenance without changing provider authority.

## AI disclosure

Exactly one HZ-GCA-1.4 class is required:

- HUMAN
- AI_ASSISTED
- AI_GENERATED
- AI_DERIVATIVE

A declaration commitment is required with the class.

Provider/model naming does not choose or validate the class by itself.

## AI derivatives

`AI_DERIVATIVE` provenance fails closed unless it contains:

1. at least one source Work or Recording reference;
2. applicable source authorization reference(s);
3. explicit transformation authorization reference(s).

License IDs may also be retained when the authorization path is license-backed.

The references are evidence/linkage only. HZ-GCA-4 does not grant a Creative permission.

## Transformation vs training

Creative transformation permission and 420AI training permission are separate and non-substitutable.

Executable provenance uses distinct arrays:

- `source.transformationAuthorizationRefs`
- `source.trainingAuthorizationRefs`

A 420AI training grant cannot satisfy the transformation requirement of an AI derivative.

A Creative transformation/license reference does not imply model-training permission.

This preserves the existing 420 Creative Protocol and AIModelRegistry authority split.

## Synthetic voice / performer-model consent

When `syntheticVoiceClaim=true`, explicit qualified consent evidence is mandatory.

The metadata binds:

- subject reference;
- controller/consenting-authority reference;
- scope commitment;
- evidence reference;
- ACTIVE status;
- effective timestamp;
- check timestamp;
- optional expiry timestamp.

Consent that is absent, revoked, inactive, not yet effective or expired fails closed.

420Hz does not infer consent from:

- a typed performer name;
- a prompt;
- a model/provider label;
- public recordings;
- source-license existence;
- contributor credit.

This implementation does **not** claim that the repository currently has a canonical production voice/persona consent registry. It validates an explicit qualified evidence shape and fails closed when such evidence is unavailable.

## Publication snapshot and immutability

`finalizeGenerationProvenance420` freezes the exact publication linkage:

- CreatorProfile ID;
- Work ID;
- Recording ID;
- Creative provenance commitment;
- authorization-manifest commitment;
- publication timestamp;
- published provenance commitment.

The published commitment covers the full normalized provenance version and publication snapshot.

Changing a published field causes validation failure.

Corrections require a new provenance version and optional `supersedesProvenanceCommitment` edge. Published provenance is not mutated in place.

## Creative handoff

HZ-GCA-4 prepares the metadata needed by later HZ-GCA-7 Register & Publish integration, but it does not claim that registration or publication already occurred.

At publication, the exact:

- `creativeProvenanceCommitment`;
- `authorizationManifestCommitment`;
- CreatorProfile;
- Work;
- Recording

must be frozen into the publication snapshot.

The actual Creative Protocol registration/activation authority remains in the Creative contracts.

## Tests

`hz/generate/test/provenance.test.js` covers:

- private prompt/lyrics rejection;
- private-input references rather than plaintext publication;
- AI derivative source identity;
- source authorization requirement;
- training-vs-transformation separation;
- required active voice consent;
- expired/revoked voice consent;
- successful generation-job provenance construction;
- unfinished-job rejection;
- publication finalization;
- published provenance tamper detection.

The existing HZ-GCA-1.4, HZ-GCA-1.5 and HZ-GCA-1.6 policy verifiers remain directly relevant retained checks.

## Authority boundaries

HZ-GCA-4 creates no new:

- Wallet authority;
- Creative rights/license authority;
- AI training authority;
- voice/persona consent registry authority;
- Compute verification/settlement authority;
- registration/publication authority;
- governance authority.

A provenance commitment proves only the normalized record that was committed. It does not itself prove the legal validity of an external authorization instrument.

## Qualification

HZ-GCA-4 is an ordinary **Level 1** roadmap step.

Directly applicable qualification includes:

- generation module syntax/tests;
- HZ-GCA-4 targeted verifier;
- retained HZ-GCA-1.4 disclosure verifier;
- retained HZ-GCA-1.5 provenance verifier;
- retained HZ-GCA-1.6 rights/consent verifier;
- retained HZ-GCA-3 execution-adapter verifier because HZ-GCA-4 consumes its result evidence.

No Level-2 milestone is introduced by this step.

## Exit criteria

HZ-GCA-4 is complete when:

- generation manifest hash is durable;
- provider/model/version is bound;
- creator account is bound;
- timestamp, request and result commitments are validated;
- source/reference authorization references are represented;
- AI disclosure metadata is bound;
- transformation and training permissions remain separate;
- synthetic voice/persona claims fail closed without active scoped evidence;
- source Work/Recording/License references are supported;
- publication provenance is immutable/versioned;
- private prompts/lyrics remain off-chain unless explicitly published by creator action;
- adversarial tests prevent unauthorized derivative and voice claims;
- exact-head Level-1 qualification passes with no required skipped/cancelled/missing checks.

Next canonical roadmap step:

**HZ-GCA-5 — Project workspace, versions, stems and storage**


## Qualification result

Qualified implementation SHA:

`1a96ea3e136219e7900569eb98359007d483ec29`

Authoritative workflow:

- **420Hz Web Qualification**
- Run: **37817799769** (#211)
- Job: **HZ-GCA-4 Level 1**
- Job ID: **113450783236**
- Result: **PASS**

Exact-head required results:

- 420Hz generation/provenance module: **40 PASS / 0 FAIL / 0 SKIPPED**
- HZ-GCA-1.4 AI disclosure verifier: **PASS**
- HZ-GCA-1.5 provenance verifier: **PASS**
- HZ-GCA-1.6 rights/consent verifier: **PASS**
- HZ-GCA-3 execution-evidence verifier: **PASS**
- HZ-GCA-4 targeted verifier: **PASS**
- retained 420Hz web job: **PASS**

No Level-2 milestone was required for HZ-GCA-4. Before final closeout, current `main` advanced through CMP-8 to `6a3c611a3c0629c9bbae1e67f992d98ba1787550`; the HZ-GCA branch was reconciled by merge commit `1a96ea3e136219e7900569eb98359007d483ec29` and the complete HZ-GCA-4 Level-1 suite was rerun successfully on that exact reconciled SHA. Level-3 repository-wide qualification remains deferred to HZ-GCA-17.
