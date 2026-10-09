# HZ-GCA-1.5 — Provenance model qualification evidence

Status: **COMPLETE — Level 1**

Canonical parent step: **HZ-GCA-1 — Scope, threat model and authority map**

Work package: **HZ-GCA-1.5 — Define provenance model**

## Qualification identity

- Repository: `abvhiael/420-integrated-v0.1`
- PR: **#565 — Add 420Hz Generate, Community & Awards roadmap phase**
- Audit/implementation branch: `feature/420hz-generate-community-awards-roadmap`
- Current `main` / base SHA: `537525ebc636eabc76ff261f5b5ff5d236869b32`
- Qualified implementation SHA: `63949e3fbbfb635960efbdafb2316a8a1d158684`
- Qualification level: **Level 1 — per-roadmap-step fast qualification**
- Level 2 milestone: **NOT REQUIRED for HZ-GCA-1.5**
- Level 3: **DEFERRED to HZ-GCA-17 phase closeout**

## Canonical definition

HZ-GCA-1.5 freezes the Generate provenance model that links exact 420Hz project/output state to authoritative 420AI, Compute Market and Creative Protocol references using native IDs, hashes and commitments.

The provenance model is privacy-preserving, reference-based, append-only/versioned after publication and non-authoritative over rights, consent, payments, compute settlement or governance.

## Implementation completed

Added:

- `hz/config/gca-provenance-v1.json`
- `docs/architecture/420hz/HZ-GCA-1.5-PROVENANCE-MODEL.md`
- `scripts/verify-420hz-gca-1-5.py`

Updated:

- `docs/420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md`
- `.github/workflows/420hz-gca.yml`

## Requirements satisfied

### Exact creator/generation lineage

The model binds:

- GenerationProject;
- GenerationIntent;
- GenerationRunBinding;
- selected GenerationOutput;
- creator account;
- 420AI job/model version;
- Compute request/job/provider references when canonically bound;
- verified request/result/result-manifest commitments;
- disclosure class and declaration commitment;
- source Work/Recording/License/authorization references where applicable;
- synthetic voice/persona consent references where applicable;
- artifact/storage commitments;
- Creative provenance/authorization handoff;
- returned native WorkId/RecordingId;
- final published provenance commitment.

### AI / Compute authority preservation

- `aiJobId` remains owned by 420AI.
- `modelVersionId` remains owned by 420AI ModelRegistry.
- Compute request/job IDs remain Compute Market native IDs.
- provider/compute references may be recorded only when canonically bound.
- result commitment and result manifest must agree with the verified canonical AI result.
- 420Hz provenance cannot fabricate provider, verification, Compute or settlement state.

### Disclosure binding

HZ-GCA-1.4 remains the disclosure authority.

The provenance record binds:

- exact policy version;
- exactly one disclosure class;
- declaration commitment.

Disclosure remains separate from Creative `ProvenanceClass`, `RightsStatus`, Model420 `aiDisclosureHash`, and provider marketing.

### Derivative/source provenance

AI_DERIVATIVE provenance requires:

- source WorkId or RecordingId;
- source authorization reference;
- native LicenseId when a Creative License is the authorization path.

These references preserve native Creative identity and do not themselves grant permission.

AI transformation permission remains distinct from AI training permission.

### Synthetic voice/persona provenance

A synthetic identity claim requires explicit `voiceConsentRefs`.

A model name/provider label is insufficient.

Detailed consent validation remains correctly deferred to HZ-GCA-1.6, while HZ-GCA-1.5 freezes the provenance reference/gating requirement.

### Creative handoff

Before REGISTERED:

- the reviewed provenance package yields an exact `creativeProvenanceCommitment`;
- the Work `provenanceHash` must bind that reviewed provenance package;
- Recording `provenanceHash` must bind the same exact package;
- Recording `authorizationManifestHash` binds applicable source/consent/authorization references;
- `mediaManifestHash` remains separate media/storage state;
- AI_DERIVATIVE RecordingClass must stay consistent with disclosure/source provenance.

### Privacy

Public provenance must not expose plaintext:

- prompts;
- private lyric drafts;
- raw reference audio;
- private stems;
- provider/API credentials;
- wallet secrets/private keys;
- private model secrets/weights unless intentionally public;
- decryption keys.

Public provenance may expose commitments, native IDs, policy/schema versions, disclosure class and authorization/publication references.

### Correction / historical integrity

Published provenance is append-only/versioned.

Corrections use a new revision/record and `supersedesProvenanceRecordId`. Historical request/result/source/disclosure commitments cannot be overwritten in place.

Later dispute/restriction may change current presentation/availability but cannot erase historical provenance.

## Provenance invariants

The manifest freezes **HZGCA-PROV-001 through HZGCA-PROV-018**.

The targeted verifier checks:

- exact provenance schema/work-package identity;
- HZ-GCA-1.1 through 1.4 prerequisite bindings;
- exact provenance field vocabulary;
- field authority/visibility/requirement metadata;
- required REVIEWED fields;
- canonical AI/Compute/Creative ownership;
- native WorkId/RecordingId/LicenseId preservation;
- protected-public-payload exclusions;
- complete lineage stages;
- AI_DERIVATIVE source/authorization rules;
- voice consent reference gate;
- append-only/versioned correction semantics;
- Creative provenance/authorization/media-manifest separation;
- fail-closed provenance failures;
- all 18 invariant identifiers;
- retained source-document existence;
- roadmap Level-1/non-milestone classification.

## Level-1 qualification

Dedicated workflow:

**420Hz GCA Qualification**

Successful exact-head run:

- Run ID: **37723618144**
- Run number: **#51**
- Job: **HZ-GCA Level 1**
- Job ID: **113136653693**
- Exact tested SHA: `63949e3fbbfb635960efbdafb2316a8a1d158684`
- Result: **PASS**

Successful checks:

1. exact PR-head checkout/verification;
2. all GCA JSON manifest syntax validation;
3. retained HZ-GCA-1.1 product-boundary verifier;
4. retained HZ-GCA-1.2 canonical object-model verifier;
5. retained HZ-GCA-1.3 Generate-lifecycle verifier;
6. retained HZ-GCA-1.4 AI-disclosure verifier;
7. HZ-GCA-1.5 provenance-model verifier.

No required Level-1 check was skipped, cancelled, stale or substituted.

## CI diagnosis

No HZ-GCA-1.5 implementation or verifier failure occurred on the qualified implementation SHA.

The workflow passed on its first exact-head HZ-GCA-1.5 qualification run.

## Security / adversarial result

For this architecture/provenance step, applicable adversarial coverage focuses on provenance forgery, identity/reference confusion, privacy leakage, rights/consent escalation and historical rewriting.

Result: **PASS**

The verifier rejects models that:

- omit canonical AI/job/result bindings;
- remap native Creative IDs;
- expose protected plaintext in public provenance;
- omit derivative source/authorization references;
- accept synthetic identity claims without consent references;
- use model/provider claims in place of canonical references;
- collapse Creative provenance/media/disclosure semantics;
- mutate published provenance in place;
- treat provenance references as rights, consent, payment or governance authority.

## Level 2 status

**Not run / not required.**

HZ-GCA-1.5 is an ordinary architecture/provenance work package and does not introduce executable shared-component integration requiring milestone qualification.

The HZ-GCA-1 Level-2 milestone remains **HZ-GCA-1.20**.

## Intentionally deferred Level 3

Deferred to HZ-GCA-17:

- canonical full Solidity inventory;
- Genesis/address-authority qualification;
- 420 Integrated/global qualification;
- repository-wide Docs/global reconciliation;
- retained 420Hz application integration suite;
- broad client/service/Indexer/Search/RPC qualification;
- full adversarial/invariant/static/security qualification;
- deployment/config verification.

## Limitations

HZ-GCA-1.5 intentionally does not yet freeze:

- complete rights/consent policy semantics;
- voice consent registry/authority implementation;
- storage/retention implementation;
- generation economics;
- provider adapter implementation;
- on-chain provenance ABI;
- disclosure/provenance UI;
- live provider/testnet deployment.

These remain later roadmap work.

## Blockers

None for HZ-GCA-1.5.

## Completion state

**HZ-GCA-1.5 — COMPLETE (Level 1).**

Parent **HZ-GCA-1 remains IN PROGRESS**.

Next canonical work package:

**HZ-GCA-1.6 — Define rights & consent boundaries**
