# HZ-GCA-1.4 — AI disclosure rules

Status: **IMPLEMENTED — Level 1 disclosure-policy definition**

Canonical parent step: **HZ-GCA-1 — Scope, threat model and authority map**

Machine-readable policy:

`hz/config/gca-ai-disclosure-v1.json`

This step freezes the public AI-disclosure classification rules for 420Hz Generate while preserving the existing authority boundaries of 420AI, Compute Market and the Creative Protocol.

## Canonical disclosure classes

Every published Recording created through Generate must expose **exactly one** of:

- **HUMAN** — no material generative-AI contribution is incorporated into the published composition or master;
- **AI_ASSISTED** — AI materially assisted the creative/production process, but substantial generated compositional or audible/performance content is not retained in the released result;
- **AI_GENERATED** — substantial generated composition, lyrics, vocal/instrumental performance, stems or other generated master content is retained in the released result;
- **AI_DERIVATIVE** — the release is a generative transformation/remix of an existing Work or Recording and therefore requires the relevant Creative source authorization path.

The disclosure is descriptive metadata. It is not a copyright, authorship, consent, license, rights, payment or governance decision.

## Classification precedence

The classification precedence is:

1. **AI_DERIVATIVE** when a generative transformation/remix of a pre-existing source requires derivative authorization;
2. otherwise **AI_GENERATED** when substantial generated compositional or audible/performance content remains;
3. otherwise **AI_ASSISTED** when material generative assistance contributed to the released process/result;
4. otherwise **HUMAN**.

This precedence prevents a derivative transformation from being softened to AI_GENERATED and prevents substantial generated material from being softened to AI_ASSISTED or HUMAN.

## HUMAN

HUMAN is permitted only when no material generative contribution is incorporated into the published Work or Recording.

Ordinary deterministic processing does not by itself make a release AI-assisted. Examples include non-generative editing, metering, storage, indexing, deterministic mastering/process tools and ordinary automation.

HUMAN is invalid if generated melody, harmony, lyrics, arrangement, voice, instrumental performance, stems or audible master content is materially incorporated.

## AI_ASSISTED

AI_ASSISTED covers material assistance without substantial generated content in the final composition/master.

Examples may include:

- ideation;
- critique;
- tagging;
- arrangement suggestions;
- cleanup/restoration assistance;
- timing suggestions;
- workflow assistance where generated output does not become substantial final composition/performance/master content.

It is not valid when substantial generated content remains in the released result.

## AI_GENERATED

AI_GENERATED applies when substantial generated content materially forms the released Work or Recording and the release is not AI_DERIVATIVE.

Examples include substantial generated:

- melody/harmony/composition;
- lyrics;
- synthetic vocals;
- generated instrumental performance;
- generated stems;
- generated master/audio content.

Human editing, mixing, curation or performance layered over generated material does not automatically reduce the classification if substantial generated content remains.

## AI_DERIVATIVE

AI_DERIVATIVE applies when a generative model transforms/remixes/revoices/restyles/stem-processes or otherwise derives a release from a pre-existing Work or Recording in a way requiring source authorization.

The Creative Protocol remains the authority for derivative permission.

The label itself grants no permission.

Where Creative `RecordingClass.AI_DERIVATIVE` applies, the 420Hz disclosure must be **AI_DERIVATIVE**.

## Substantiality

HZ-GCA-1.4 does **not** invent a numeric percentage threshold.

For this policy, substantiality means that generated material forms a meaningful compositional, lyrical, vocal, instrumental, stem or audible-master contribution to the released result.

If the distinction between AI_ASSISTED and AI_GENERATED is genuinely unresolved at publication review, publication **fails closed** until corrected. The system must not default ambiguity to HUMAN.

A later explicit policy version may refine the threshold, but historical disclosure semantics cannot be silently rewritten.

## Publication binding

For Generate-originated publication:

- disclosure is mandatory;
- exactly one class is allowed;
- the disclosure must be bound before or atomically with publication handoff;
- a missing/unknown/multiple disclosure blocks publication;
- the final published Recording/version retains its historical disclosure commitment.

A disclosure correction is append-only/versioned. It must preserve the prior value and clearly identify the superseding disclosure.

Withdrawal/restriction does not erase historical disclosure.

## Lifecycle integration

### DRAFT

Disclosure may be absent or undetermined.

### QUOTED

Disclosure may remain provisional.

### SUBMITTED / RUNNING

Disclosure may be refined based on the actual model/job/source path. It is still provisional.

### SUCCEEDED

A candidate disclosure must be determinable from the successful output/source path before REVIEWED.

### REVIEWED

The creator explicitly confirms the disclosure as part of review/provenance handoff.

### REGISTERED

The disclosure commitment remains bound to the exact Creative handoff data.

### PUBLISHED

Exactly one valid disclosure class is public and bound to the published Recording/version.

## Model/provider disclosure is not Recording disclosure

The repository's `AIModelRegistry` already supports Model420 `aiDisclosureHash`.

That hash describes model/version disclosure metadata. It does **not** determine whether a particular Recording is HUMAN, AI_ASSISTED, AI_GENERATED or AI_DERIVATIVE.

The Recording disclosure must not be inferred from:

- provider marketing copy;
- model name;
- "human-like", "assistive", "original" or similar provider claims;
- Search labels;
- chart placement;
- popularity;
- Model420 `aiDisclosureHash` alone.

The classification is reviewed against the actual generation, output and source/provenance path.

## Creative Protocol relationships

Disclosure and Creative state remain distinct:

- `RecordingClass.AI_DERIVATIVE` requires disclosure AI_DERIVATIVE;
- other RecordingClass values do not fully determine disclosure;
- `ProvenanceClass` does not substitute for disclosure;
- `RightsStatus` does not substitute for disclosure;
- disclosure does not create rights or authorization;
- AI transformation permission remains distinct from AI training permission.

An AI_GENERATED or AI_ASSISTED disclosure does not waive contributor, royalty, license or provenance requirements.

## Privacy

Public disclosure does not require exposing:

- plaintext prompts;
- private lyric drafts;
- raw reference audio;
- provider credentials;
- model secrets;
- private intermediate outputs.

Public disclosure may reference commitments or IDs sufficient for later provenance verification.

Private disclosure deliberation remains non-indexable until publication policy makes the final disclosure public.

## Required disclosure record

The logical disclosure record must bind at least:

- schema version;
- disclosure class;
- policy version;
- declaration commitment;
- Recording reference when available;
- provenance draft/reference or provenance commitment;
- disclosure revision identity/time.

HZ-GCA-1.5 defines the fuller provenance model; HZ-GCA-1.4 intentionally does not duplicate it.

## Fail-closed validation

Generate publication must reject:

- missing disclosure;
- unknown disclosure class;
- multiple simultaneous disclosure classes;
- HUMAN with material generated content;
- AI_ASSISTED with substantial generated content;
- AI_GENERATED when derivative transformation requires AI_DERIVATIVE;
- AI_DERIVATIVE without the relevant source/authorization path;
- disclosure inferred only from provider/model marketing;
- in-place historical disclosure overwrite;
- disclosure being used as a substitute for rights/license/training authorization.

## Invariants

The machine-readable policy freezes **HZGCA-DISC-001 through HZGCA-DISC-016**.

These ensure disclosure remains a transparent, versioned product/publication fact without becoming a new rights, AI-model, identity, payment or governance authority.

## Source reconciliation

This policy was reconciled against:

- `docs/420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md`;
- HZ-GCA-1.1 product boundaries;
- HZ-GCA-1.2 object model;
- HZ-GCA-1.3 Generate lifecycle;
- `contracts/src/ai/AIModelRegistry.sol`;
- `docs/architecture/infrastructure/420ai-compute-infrastructure.md`;
- `contracts/src/creative/shared/CreativeTypes420.sol`;
- `contracts/src/creative/README.md`.

The repository already separates Model420 disclosure metadata from Creative rights/provenance and explicitly keeps AI transformation permission distinct from AI training permission. HZ-GCA-1.4 preserves those boundaries.

## HZ-GCA-1.4 exit criteria

HZ-GCA-1.4 is complete when:

- all four classes are explicit;
- classification precedence is explicit;
- ambiguity fails closed;
- publication binding and correction/versioning are explicit;
- Model420/provider disclosure is separated from Recording disclosure;
- Creative rights/provenance/RecordingClass relationships are explicit;
- privacy and non-rights-grant boundaries are explicit;
- the targeted verifier passes on the exact implementation SHA;
- no ABI, contract deployment, provider integration or live/testnet claim is invented;
- parent HZ-GCA-1 remains open.

Next work package after qualification:

**HZ-GCA-1.5 — Define provenance model**
