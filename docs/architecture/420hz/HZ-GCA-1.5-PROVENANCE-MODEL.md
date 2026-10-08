# HZ-GCA-1.5 — Provenance model

Status: **IMPLEMENTED — Level 1 provenance definition**

Canonical parent step: **HZ-GCA-1 — Scope, threat model and authority map**

Machine-readable policy:

`hz/config/gca-provenance-v1.json`

This step freezes the provenance model for Generate-originated 420Hz releases. It links 420Hz project/output state to authoritative 420AI, Compute Market and Creative Protocol references without publishing protected payloads or creating duplicate authority.

## Provenance record

The canonical logical record is `GenerationProvenanceRecord`.

It is versioned, append-only after publication, and identified by `provenanceRecordId`.

The provenance record binds the exact:

- GenerationProject;
- GenerationIntent;
- GenerationRunBinding;
- selected GenerationOutput;
- creator account;
- 420AI job/model version;
- canonical request/result commitments;
- disclosure class and declaration commitment;
- source Work/Recording/License authorization references where applicable;
- optional synthetic voice/persona consent references where applicable;
- output artifact/storage commitments;
- Creative handoff commitments;
- returned WorkId and RecordingId once registered;
- final published provenance commitment.

## Lineage

The intended lineage is:

`GenerationProject → GenerationIntent → GenerationRunBinding → 420AI job/model → Compute references when bound → verified result → GenerationOutput/artifacts → disclosure → source/consent references → Creative provenance/authorization handoff → WorkId/RecordingId → published provenance commitment`

Each arrow is a reference/commitment edge. It does not transfer authority from the owning system to 420Hz.

## Required provenance before REVIEWED

Before a successful output can advance to REVIEWED, provenance must bind at least:

- schema version;
- policy version;
- project/intent/run/output IDs;
- creator account reference;
- canonical AI job ID;
- model version ID;
- request commitment;
- result commitment;
- result manifest hash;
- AI disclosure class;
- disclosure declaration commitment;
- artifact commitments;
- provenance revision identity.

420Hz must verify these against the exact selected successful output and owning-system references.

A provider claim or UI label is not sufficient.

## 420AI / Compute provenance

420Hz records only references already owned by canonical systems.

Required/conditional references include:

- `aiJobId`;
- `modelVersionId`;
- `providerId` when canonically bound;
- `computeRequestId` when canonically bound;
- `computeJobId` when canonically bound;
- `requestCommitment`;
- `resultCommitment`;
- `resultManifestHash`;
- `verificationOutcomeRef` when available.

The provenance layer may not fabricate missing provider, Compute or verification state.

The `resultCommitment` and `resultManifestHash` must match the verified canonical AI result used by the selected output.

## Disclosure binding

HZ-GCA-1.4 remains the disclosure-policy authority.

The provenance record binds:

- exact disclosure policy version;
- exactly one disclosure class;
- disclosure declaration commitment.

Disclosure remains distinct from Creative `ProvenanceClass`, Creative `RightsStatus`, model-version `aiDisclosureHash`, and provider marketing metadata.

## Derivative provenance

For AI_DERIVATIVE output, provenance must include:

- at least one source WorkId or RecordingId;
- applicable source authorization reference;
- LicenseId when authorization is represented by a Creative License.

These are native Creative IDs. They are never rehashed or remapped into new canonical identities.

The provenance reference records what authorization path was relied on. It does not itself grant permission.

AI transformation permission remains distinct from AI training permission.

## Voice/persona provenance

A synthetic voice or persona identity claim requires explicit `voiceConsentRefs`.

A model name, provider label or user-entered text is not consent evidence.

HZ-GCA-1.5 freezes the reference and fail-closed requirement only. The complete consent policy and validation semantics remain HZ-GCA-1.6.

If required voice/persona consent cannot be referenced, REVIEWED/publication must fail closed.

## Privacy boundary

Public provenance must not expose plaintext:

- prompts;
- private lyric drafts;
- raw reference audio;
- private stems;
- API credentials;
- wallet secrets/private keys;
- model secrets/private weights unless intentionally public;
- decryption keys.

Public provenance may expose:

- hashes/commitments;
- native canonical IDs;
- schema/policy versions;
- disclosure class;
- source-authorization references;
- final publication references.

A commitment establishes a linkage to committed data. It does not make hidden plaintext public and does not by itself prove semantic truth beyond the owning verification policy.

## Creative handoff

Before REGISTERED, the reviewed provenance package must produce exact handoff commitments.

### Work

Creative `provenanceHash` must derive from or bind the exact reviewed `creativeProvenanceCommitment`.

Creative `ProvenanceClass` remains a Creative Protocol semantic and does not replace the HZ disclosure class.

### Recording

Recording registration must preserve:

- `provenanceHash` bound to the reviewed provenance package;
- `authorizationManifestHash` bound to applicable source/consent/authorization references where required;
- `mediaManifestHash` as the separate media/storage commitment;
- AI_DERIVATIVE consistency across RecordingClass, disclosure and source provenance.

The provenance model does not activate the Work/Recording or finalize rights. Those remain Creative Protocol actions.

## Publication binding

Before PUBLISHED:

- canonical WorkId must exist;
- canonical RecordingId must exist;
- the IDs must match the exact registered handoff;
- a final `publishedProvenanceCommitment` must bind the exact Recording/version.

Publication provenance is historical. A later withdrawal, dispute or restriction changes current availability/status but does not erase provenance history.

## Corrections

Published provenance is append-only/versioned.

A correction must:

- create a new revision or new provenance record;
- preserve the prior record;
- link with `supersedesProvenanceRecordId`;
- never overwrite historical request/result/source/disclosure commitments in place.

If external evidence is later revoked/disputed, current presentation may show that status while preserving the historical lineage.

## Fail-closed cases

REVIEWED/REGISTERED/PUBLISHED must fail closed where applicable if:

- required provenance is missing;
- AI job/model/request/result references mismatch;
- the result or result manifest differs from the canonical verified job;
- AI_DERIVATIVE lacks source provenance or authorization;
- a synthetic identity claim lacks required consent references;
- Creative handoff commitments are absent;
- returned WorkId/RecordingId does not match the reviewed handoff;
- protected plaintext is placed in public provenance;
- provider/model marketing is substituted for canonical references;
- historical published provenance is mutated in place.

## Provenance vs authority

Provenance records are evidence/linkage metadata.

They do not independently grant:

- copyright;
- authorship;
- licenses;
- consent;
- identity;
- payment/custody;
- compute settlement;
- governance;
- dispute resolution.

Each authority remains with the canonical system identified by HZ-GCA-1.1.

## Invariants

The machine-readable provenance policy freezes **HZGCA-PROV-001 through HZGCA-PROV-018**.

These ensure:

- exact output lineage;
- native external IDs;
- canonical AI request/result binding;
- disclosure-policy binding;
- derivative/voice gates;
- privacy-preserving commitments;
- Creative handoff integrity;
- append-only correction/history semantics.

## Source reconciliation

This model was reconciled against:

- HZ-GCA-1.1 product boundaries;
- HZ-GCA-1.2 canonical object model;
- HZ-GCA-1.3 Generate lifecycle;
- HZ-GCA-1.4 AI disclosure policy;
- `AIJobManager`;
- `AIModelRegistry`;
- 420AI/Compute architecture;
- Creative typed IDs, `provenanceHash`, `authorizationManifestHash`, `mediaManifestHash`, RecordingClass and rights/authorization boundaries.

Existing repository semantics already separate:

- AI request/result commitments from raw payloads;
- Creative provenance from media manifests;
- derivative authorization from mere provenance claims;
- AI transformation from AI training permission.

HZ-GCA-1.5 preserves those boundaries.

## HZ-GCA-1.5 exit criteria

HZ-GCA-1.5 is complete when:

- creator/project/intent/run/output lineage is explicit;
- 420AI/Compute references and result commitments are explicit;
- disclosure is bound under an exact policy version;
- derivative source and optional voice-consent provenance rules are explicit;
- Creative provenance/authorization handoff is explicit;
- public/private data boundaries are explicit;
- correction and later dispute-history semantics are explicit;
- the targeted verifier passes on the exact implementation SHA;
- no ABI, deployment, live provider or testnet claim is invented;
- parent HZ-GCA-1 remains open.

Next work package after qualification:

**HZ-GCA-1.6 — Define rights & consent boundaries**
