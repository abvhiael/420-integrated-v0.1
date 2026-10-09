# HZ-GCA-4 — Provenance, consent and AI rights metadata qualification evidence

Status: **COMPLETE — Level 1**

Canonical roadmap step: **HZ-GCA-4 — Provenance, consent and AI rights metadata**

## Qualification identity

- Repository: `abvhiael/420-integrated-v0.1`
- PR: **#565 — Add 420Hz Generate, Community & Awards roadmap phase**
- Branch: `feature/420hz-generate-community-awards-roadmap`
- Current `main` / base SHA: `6a3c611a3c0629c9bbae1e67f992d98ba1787550`
- Qualified implementation SHA: `1a96ea3e136219e7900569eb98359007d483ec29`
- Evidence SHA: the commit containing this document
- Qualification level: **Level 1**
- Level 2: **NOT REQUIRED / NOT RUN**
- Level 3: **DEFERRED to HZ-GCA-17**

## Canonical definition

HZ-GCA-4 requires durable provenance for generated outputs while preserving privacy and authority boundaries.

Original canonical requirements individually satisfied:

- generation manifest hash;
- provider/model/version identifier;
- creator identity/account binding;
- timestamp and request/result commitments;
- input/reference-content authorization references when applicable;
- AI disclosure class;
- transformation vs training permission separation;
- explicit voice/performer-model consent metadata for synthetic identity claims;
- source Work/Recording/License references for derivatives;
- immutable provenance versioning at publication;
- private prompts/lyrics remain off-chain unless explicitly published by creator action.

Canonical exit:

**provenance schemas, validation and adversarial tests preventing unauthorized derivative/voice claims.**

## Repository inspection / gap analysis

The step began at branch HEAD:

`63e73bafc61a6b302e027c1af383909fbdf43b29`

Current main at initial implementation remained:

`0993ff5b5b3b213a0768dbde90e4734df5ab4cc0`.

After the first exact-head PASS, current `main` advanced through CMP-8 to:

`6a3c611a3c0629c9bbae1e67f992d98ba1787550`.

The new main delta added the 420Compute application and extended Compute Indexer/application projection surfaces. It did not overlap any path changed by HZ-GCA-4, but it changed executable repository state. Under exact-SHA qualification rules the branch was therefore reconciled before final closeout rather than relying on stale pre-reconciliation evidence.

Final reconciliation merge commit / final qualified implementation SHA:

`1a96ea3e136219e7900569eb98359007d483ec29`.

A base-to-main/base-to-branch path comparison found **zero overlapping changed paths**, so reconciliation preserved both current-main CMP-8 state and the HZ-GCA implementation without conflict. PR #565 returned to a mergeable state.

Existing qualified architecture already froze the relevant authority model in:

- `hz/config/gca-ai-disclosure-v1.json`
- `hz/config/gca-provenance-v1.json`
- `hz/config/gca-rights-consent-v1.json`
- `contracts/src/ai/AIModelRegistry.sol`
- `contracts/src/creative/rights/AuthorizationRegistry420.sol`
- `contracts/src/creative/rights/LicenseRegistry420.sol`

The missing HZ-GCA-4 work was executable application enforcement and end-to-end metadata construction/finalization.

No new Solidity contract, canonical AI authority, Creative authority, Wallet authority or voice/persona consent registry was required or introduced.

## Implementation completed

Added:

- `hz/generate/src/provenance.js`
- `hz/generate/test/provenance.test.js`
- `hz/config/gca-provenance-consent-rights-v1.json`
- `docs/architecture/420hz/HZ-GCA-4-PROVENANCE-CONSENT-AI-RIGHTS.md`
- `scripts/verify-420hz-gca-4.py`

Updated:

- `hz/generate/src/index.js`
- `hz/generate/src/provider.js`
- `hz/generate/src/jobs.js`
- `hz/generate/package.json`
- `docs/420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md`
- `.github/workflows/420hz-web.yml`
- `.github/workflows/420hz-gca.yml`

## Executable provenance schema

`buildGenerationProvenance420` validates and normalizes a versioned provenance record containing:

- provenance record ID/version;
- generation manifest hash;
- creator account reference;
- creation timestamp;
- provider ID/revision;
- model ID/version;
- request commitment;
- result commitment;
- result-manifest hash;
- verification reference;
- AI disclosure class;
- declaration commitment;
- source Work/Recording/License/authorization references;
- separate transformation and training authorization references;
- synthetic voice/persona consent evidence;
- artifact commitments;
- explicit creator-published prompt/lyrics references when applicable.

## Private-input boundary

Public provenance explicitly rejects private plaintext-bearing fields including:

- `prompt`
- `lyrics`
- `rawReferenceAudio`
- `referenceAudioBytes`
- `privateAudio`
- `audioBytes`

The provenance record freezes:

- prompt plaintext off-chain;
- lyric plaintext off-chain;
- reference-audio plaintext off-chain;
- creator publication requires explicit action.

When a creator intentionally publishes prompt or lyric content, the provenance record may bind explicit public references rather than embedding the private plaintext.

## Generation-job provenance bridge

HZ-GCA-4 adds `executionEvidence` retention to `GenerationJobManager420`.

On successful generation the job may retain:

- result commitment;
- verification reference;
- entitlement reference;
- settlement reference.

`provenanceFromSucceededJob420` requires a `SUCCEEDED` generation job and a canonical/provider result commitment before constructing provenance.

It binds:

- exact request digest;
- selected provider/model/version;
- result commitment;
- output-manifest digest;
- artifact-integrity commitments;
- verification reference where available.

Unfinished generation fails closed.

## AI disclosure binding

Exactly one HZ-GCA-1.4 class is accepted:

- HUMAN
- AI_ASSISTED
- AI_GENERATED
- AI_DERIVATIVE

A declaration commitment is mandatory.

Provider/model labels cannot substitute for disclosure classification.

## Derivative authorization

`AI_DERIVATIVE` provenance requires:

1. source Work and/or Recording identity;
2. source authorization references;
3. explicit transformation authorization references.

Native License IDs can be retained when applicable.

The application does not grant these permissions; it preserves their canonical references.

## Transformation vs training separation

The schema has separate:

- `transformationAuthorizationRefs`
- `trainingAuthorizationRefs`

A 420AI training grant does not satisfy an AI-derivative transformation requirement.

Creative transformation/license state does not grant model-training permission.

This preserves the existing split between:

- 420 Creative Protocol transformation/source-use authority;
- 420AI ModelRegistry training-rights authority.

## Synthetic voice / performer-model consent

A synthetic identity claim requires explicit consent metadata:

- subject reference;
- controller reference;
- scope commitment;
- evidence reference;
- ACTIVE status;
- effective time;
- checked time;
- optional expiry.

Absent, inactive, revoked, not-yet-effective or expired consent fails closed.

HZ-GCA-4 deliberately does not invent or claim a production voice/persona consent registry.

Names, prompts, model/provider labels, public recordings and generic licenses are not treated as consent.

## Publication immutability

`finalizeGenerationProvenance420` freezes:

- CreatorProfile ID;
- Work ID;
- Recording ID;
- Creative provenance commitment;
- authorization-manifest commitment;
- publication time;
- published provenance commitment.

The commitment covers the full normalized provenance plus publication snapshot.

Any field mutation after publication causes validation failure.

Corrections require a new provenance version/supersession edge rather than in-place mutation.

## Deterministic provider provenance evidence

The deterministic HZ-GCA-2 mock provider now exposes:

- deterministic result commitment;
- deterministic verification reference.

This allows repository/local provenance qualification to exercise the full success path without claiming production provider verification.

## Machine-readable invariants

`hz/config/gca-provenance-consent-rights-v1.json` freezes:

**HZGCA4-001 through HZGCA4-018**

covering:

- stable versioned generation manifest binding;
- provider/model/version identity;
- creator binding;
- request/result commitments;
- disclosure metadata;
- private-input exclusion;
- explicit creator publication references;
- derivative source/authorization requirements;
- transformation-vs-training non-substitution;
- voice-consent fail-closed semantics;
- successful job evidence binding;
- unfinished-job rejection;
- publication immutability;
- tamper detection;
- versioned correction semantics.

## Level-1 qualification

Authoritative workflow:

**420Hz Web Qualification**

Initial exact-head implementation run before current-main reconciliation:

- Run ID: **37816294856**
- Run number: **#208**
- Job: **HZ-GCA-4 Level 1**
- Job ID: **113445676046**
- Exact tested implementation SHA: `e13ff098988028bd1a9181edd7559066a611de99`
- Result: **PASS**

Because current `main` later advanced with executable CMP-8 state, that run was superseded for final closeout by the reconciled exact-head run below.

Final authoritative exact-head run:

- Run ID: **37817799769**
- Run number: **#211**
- Job: **HZ-GCA-4 Level 1**
- Job ID: **113450783236**
- Exact tested implementation SHA: `1a96ea3e136219e7900569eb98359007d483ec29`
- Result: **PASS**

Required results:

1. exact PR-head checkout/verification — PASS;
2. generation/provenance syntax checks — PASS;
3. complete `hz/generate` Node suite — **40 PASS / 0 FAIL / 0 SKIPPED**;
4. HZ-GCA-1.4 AI disclosure verifier — PASS;
5. HZ-GCA-1.5 provenance verifier — PASS;
6. HZ-GCA-1.6 rights/consent verifier — PASS;
7. HZ-GCA-3 execution-evidence verifier — PASS;
8. HZ-GCA-4 targeted verifier — PASS;
9. retained 420Hz web job — PASS.

No required HZ-GCA-4 check was skipped, cancelled, missing or untriggered. The final reconciled run reported **40 tests / 40 pass / 0 fail / 0 skipped** for the generation/provenance module, and all retained policy/adapter verifiers returned PASS.

## Security / adversarial results

Result: **PASS**

Adversarial coverage proves:

- public provenance rejects prompt/lyric plaintext;
- AI_DERIVATIVE cannot proceed with training permission alone;
- AI_DERIVATIVE requires source identity;
- AI_DERIVATIVE requires source authorization;
- AI_DERIVATIVE requires transformation authorization;
- synthetic voice/persona claims require explicit active consent;
- expired consent fails closed;
- publication tampering invalidates the commitment;
- unfinished generation cannot become completed provenance;
- successful provenance preserves exact provider/model/request/result/artifact linkage.

## Level 2

**Not required / not run.**

HZ-GCA-4 is an ordinary app-scoped implementation step.

It executes the already-qualified HZ-GCA-1.4/1.5/1.6 policy boundaries and consumes HZ-GCA-3 result evidence, but it does not materially alter the canonical AI/Creative shared implementations or introduce a documented accumulated milestone.

## Intentionally deferred Level 3

Deferred to **HZ-GCA-17**:

- canonical full Solidity inventory;
- Genesis/address-authority qualification;
- 420 Integrated/global qualification;
- final Docs/global reconciliation;
- complete affected clients/services/Indexer/Search/RPC/frontend/backend suites;
- global adversarial/invariant/security/static qualification;
- deployment/config/production closeout.

Canonical Solidity remains the single owner of the complete Foundry inventory; Genesis/address-authority qualification must not duplicate it.

## Limitations

HZ-GCA-4 does not claim:

- a live production/testnet provider;
- a deployed public provenance service;
- live Creative registration/publication;
- live Wallet authorization;
- production voice/persona consent registry;
- production testnet provenance evidence;
- legal validity of an external authorization solely because its reference is present.

The runtime validates record shape, required relationships and fail-closed application boundaries; authority remains with the owning protocols/sources.

## Exit criteria verification

- generation manifest hash: **PASS**
- provider/model/version identifier: **PASS**
- creator identity/account binding: **PASS**
- timestamp + request/result commitments: **PASS**
- input/reference authorization references: **PASS**
- AI disclosure class: **PASS**
- transformation vs training separation: **PASS**
- synthetic voice/persona consent metadata: **PASS**
- source Work/Recording/License references: **PASS**
- immutable publication provenance version: **PASS**
- private prompt/lyrics off-chain rule: **PASS**
- unauthorized derivative adversarial tests: **PASS**
- unauthorized/expired voice claim adversarial tests: **PASS**
- exact-head Level-1 qualification: **PASS**
- required skipped/cancelled/missing checks: **NONE**

## Blockers

None. Current-main reconciliation was completed and the reconciled exact implementation SHA was requalified successfully.

## Completion state

**HZ-GCA-4 — COMPLETE (Level 1).**

Next canonical roadmap step:

**HZ-GCA-5 — Project workspace, versions, stems and storage**
