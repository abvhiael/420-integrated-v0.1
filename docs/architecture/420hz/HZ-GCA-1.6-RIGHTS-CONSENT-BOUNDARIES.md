# HZ-GCA-1.6 — Rights & consent boundaries

Status: **IMPLEMENTED — Level 1 rights/consent boundary definition**

Canonical parent step: **HZ-GCA-1 — Scope, threat model and authority map**

Machine-readable policy:

`hz/config/gca-rights-consent-v1.json`

This step freezes the rights and consent boundaries for 420Hz Generate. It preserves existing Creative Protocol and 420AI authority, defines the additional consent gates needed for synthetic voice/persona use, and fails closed where a qualified consent authority is unavailable.

## Authority separation

420Hz is not the authority for:

- Creative rights ownership;
- Creative derivative authorization;
- Creative licenses;
- contributor-credit acceptance;
- economic rights splits;
- AI model training permission;
- Wallet/SmartAccount signing;
- synthetic voice/persona consent.

420Hz may collect user intent, display requirements, preserve canonical references, perform preflight checks and fail closed. Final authority remains with the owning systems.

## Creative derivative permissions

The current Creative Protocol already defines exact permission masks by derivative class.

### COVER

Work permissions:

- `CREATE_COVER`
- `COMMERCIALIZE`

No source Recording permission is required by the current `AuthorizationRegistry420` path.

### REMIX

Work permissions:

- `CREATE_REMIX`
- `COMMERCIALIZE`

Source Recording permissions:

- `CREATE_REMIX`
- `USE_MASTER`
- `COMMERCIALIZE`

### STEM_REMIX

Work permissions:

- `CREATE_REMIX`
- `COMMERCIALIZE`

Source Recording permissions:

- `CREATE_REMIX`
- `USE_STEMS`
- `COMMERCIALIZE`

### SAMPLE_DERIVATIVE

Work permissions:

- `COMMERCIALIZE`

Source Recording permissions:

- `USE_SAMPLE`
- `COMMERCIALIZE`

### AI_DERIVATIVE

Work permissions:

- `COMMERCIALIZE`

Source Recording permissions:

- `AI_TRANSFORM`
- `USE_MASTER`
- `COMMERCIALIZE`

420Hz may not broaden, collapse or substitute these masks.

## Creative licenses

A Creative License can satisfy a required source-Recording permission only through the canonical `LicenseRegistry420.hasPermissions` semantics.

The license must be:

- ACTIVE;
- unexpired;
- issued to the exact licensee profile;
- bound to the exact source Recording;
- sufficient for the complete required permission mask.

The following are not permission:

- the existence of a license offer;
- a payment receipt;
- a metadata label;
- a provider/model claim;
- stale cached application state.

Derivative authorization is revalidated by the Creative Protocol at activation. A 420Hz preflight cannot become final authority.

## Contributor credit vs rights

The Creative `ContributorRegistry420` distinguishes proposed from accepted credit.

A `PROPOSED` credit is not accepted attribution or consent.

Only `ACCEPTED` credit establishes accepted protocol credit for that exact asset and role.

Contributor credit remains distinct from economic ownership:

- accepted credit does not imply a royalty/right share;
- a finalized RightsRegistry share does not imply source-use permission;
- either of those does not imply synthetic voice/persona consent.

420Hz cannot auto-accept credits or infer rights from display metadata.

## Rights ownership

Creative Work and Recording rights remain separate pools.

Initial rights splits must use the canonical RightsRegistry proposal/accept/finalize path.

Participation in AI generation does not itself grant Creative rights to:

- AI provider;
- model creator;
- Compute worker;
- storage provider;
- matcher/verifier;
- 420Hz application operator.

Community popularity or Awards results likewise do not alter Creative rights.

## AI transformation vs AI training

These permissions are explicitly independent.

### Creative transformation authority

`AuthorizationRegistry420` / `LicenseRegistry420` governs use of Works/Recordings for derivative creation, including `AI_TRANSFORM`.

### AI training authority

`AIModelRegistry` governs Model420 training-rights declarations/grants.

The boundaries are:

- `AI_TRANSFORM` does not authorize model training;
- an ordinary Creative license or remix permission does not authorize training;
- accepted contributor credit does not authorize training;
- Creative rights ownership does not automatically authorize training;
- a 420AI TrainingGrant does not authorize remixing, transformation, sampling, master use or commercialization of a Creative asset.

Training and transformation may both be needed in a future workflow, but each must be authorized independently.

## Disclosure class does not bypass rights

The four HZ-GCA-1.4 classes do not change canonical rights requirements.

### HUMAN

Ordinary Creative rights/contributor rules apply.

### AI_ASSISTED

Ordinary Creative rights/contributor rules apply. If protected source material is actually used, the applicable source permissions still apply.

### AI_GENERATED

Ordinary Creative registration/right/contributor rules still apply for claimed human contributors and rights holders.

Model/provider participation does not create Creative ownership.

### AI_DERIVATIVE

Canonical Creative source authorization is mandatory.

The disclosure label itself grants nothing.

## Reference audio

Possession or upload of reference audio is not authorization.

Where reference audio contains protected Work/Recording material, the exact applicable Creative permissions must be satisfied.

`USE_MASTER`, `USE_STEMS`, `USE_SAMPLE` and `AI_TRANSFORM` are distinct permissions.

A Work-level permission does not substitute for a required Recording-level permission.

## Synthetic voice/persona consent

A synthetic or cloned voice/persona claim that identifies or purports to identify a real performer/creator/person requires explicit, scoped consent evidence.

Required consent evidence must be able to bind:

- consent subject identity/reference;
- consenting authority/controller reference;
- scope commitment for the intended synthetic use;
- effective/expiry bounds where applicable;
- revocation/status source;
- independently checkable evidence commitment/reference.

The following are **not** consent:

- a typed name;
- an artist name;
- a model name;
- prompt text;
- provider badge;
- public availability of recordings;
- an unverified checkbox;
- contributor credit alone;
- a source-use license that does not explicitly cover the synthetic identity use.

The repository does not currently establish a canonical production synthetic voice/persona consent registry for this 420Hz phase. Therefore 420Hz must **fail closed** for such claims unless a qualified explicit consent source/reference is available.

HZ-GCA-1.6 deliberately does not invent a registry, contract or address.

## Consent expiry and revocation

Time-bounded source licenses and consent instruments must be checked at the action that relies on them.

Expiry/revocation can block new:

- REVIEWED transitions;
- registration;
- publication;
- republication;
- new derivative actions.

Historical provenance remains immutable. A later revocation may change current availability or future permission but does not erase the historical consent reference observed at publication.

Cached authorization/consent state is non-authoritative and cannot outlive the source validity/freshness.

If required authority state is unavailable or conflicting, the action fails closed.

## Lifecycle gates

### Before SUBMITTED

Where determinable, known prohibited source/persona use should fail before paid execution.

The creator must acknowledge applicable source/voice rights requirements.

### Before REVIEWED

Require:

- HZ-GCA-1.5 provenance for the selected output;
- source authorization references for AI_DERIVATIVE;
- qualified consent references for synthetic identifiable voice/persona claims;
- no known expired/revoked/insufficient required authorization.

### Before REGISTERED

Require:

- valid Creative registrant/creator-profile authority;
- revalidated source authorization/license state;
- exact authorization-manifest commitment;
- no fabricated contributor/rights state.

### Before PUBLISHED

Require:

- canonical Work/Recording activation requirements;
- derivative authorization valid at activation/publication;
- required voice/persona consent still valid for the publication action;
- consistency across disclosure, provenance, rights and consent references.

## Fail-closed cases

420Hz must reject or block the gated action if:

- AI_DERIVATIVE lacks required Creative authorization;
- a Creative license is wrong, expired, inactive or insufficient;
- required voice/persona consent lacks qualified explicit evidence;
- contributor credit is only PROPOSED;
- a rights split is not finalized where finalization is required;
- `AI_TRANSFORM` is treated as training permission;
- a TrainingGrant is treated as Creative transformation/commercialization permission;
- provider/model/user assertions are substituted for canonical authorization;
- required authority state is missing, stale, unavailable or conflicting.

## Provenance integration

HZ-GCA-1.5 `authorizationManifestCommitment` binds the exact source/consent references used for the Creative handoff.

That commitment does not grant the underlying authority.

The provenance record preserves historical references while the owning Creative/AI/consent system determines current validity.

## Invariants

The machine-readable policy freezes **HZGCA-RC-001 through HZGCA-RC-018**.

The major guarantees are:

- no authority migration into 420Hz;
- no disclosure/provenance label as a substitute for rights;
- exact derivative permission masks;
- license validity checks;
- accepted-credit vs rights separation;
- transformation vs training separation;
- explicit voice/persona consent;
- fail-closed missing/conflicting authority state;
- immutable historical provenance.

## Source reconciliation

This policy was reconciled against:

- `AuthorizationRegistry420`;
- `LicenseRegistry420`;
- `ContributorRegistry420`;
- `RightsRegistry420`;
- Creative permission constants and RecordingClass definitions;
- Creative acceptance tests requiring source authorization at derivative activation;
- `AIModelRegistry` Model420 training-rights model;
- HZ-GCA-1.1 through HZ-GCA-1.5.

Repository truth establishes that derivative activation revalidates authorization and that AI transformation permission is separate from AI training permission. HZ-GCA-1.6 preserves those existing semantics.

## HZ-GCA-1.6 exit criteria

HZ-GCA-1.6 is complete when:

- Creative rights, contributor, licensing, AI-training and voice/persona consent authorities are explicitly separated;
- exact derivative permission masks are preserved;
- Creative license validity/revalidation is explicit;
- transformation and training permissions are non-substitutable;
- synthetic voice/persona consent evidence requirements and fail-closed absence behavior are explicit;
- expiry/revocation and historical provenance rules are explicit;
- the targeted verifier passes against the exact implementation SHA;
- no nonexistent consent registry, ABI, deployment, provider or testnet state is claimed;
- parent HZ-GCA-1 remains open.

Next work package after qualification:

**HZ-GCA-1.7 — Define privacy model**
