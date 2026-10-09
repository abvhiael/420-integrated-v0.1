# HZ-GCA-1.2 — Canonical object model qualification evidence

Status: **COMPLETE — Level 1**

Canonical parent step: **HZ-GCA-1 — Scope, threat model and authority map**

Work package: **HZ-GCA-1.2 — Define canonical object model**

## Qualification identity

- Repository: `abvhiael/420-integrated-v0.1`
- PR: **#565 — Add 420Hz Generate, Community & Awards roadmap phase**
- Audit/implementation branch: `feature/420hz-generate-community-awards-roadmap`
- Current `main` / base SHA: `537525ebc636eabc76ff261f5b5ff5d236869b32`
- Qualified implementation SHA: `026fce66d054172dffeb49082a502feef0284d97`
- Qualification level: **Level 1 — per-roadmap-step fast qualification**
- Level 2 milestone: **NOT REQUIRED for HZ-GCA-1.2**
- Level 3: **DEFERRED to HZ-GCA-17 phase closeout**

## Canonical definition

HZ-GCA-1.2 freezes the logical object model for Generate, Community and Awards while preserving the HZ-GCA-1.1 authority boundaries.

Required deliverables satisfied:

- normative object-model architecture document;
- machine-readable object manifest;
- explicit logical object classes;
- stable ID fields and ID ownership rules;
- immutable vs mutable field declarations;
- object-reference graph;
- explicit external canonical references;
- explicit derived/non-authoritative projections;
- Awards-domain separation from Civic governance;
- no-duplication/no-authority-escalation invariants;
- dedicated exact-head Level-1 verifier;
- app-specific CI coverage.

## Implementation completed

Added:

- `hz/config/gca-object-model-v1.json`
- `docs/architecture/420hz/HZ-GCA-1.2-CANONICAL-OBJECT-MODEL.md`
- `scripts/verify-420hz-gca-1-2.py`

Updated:

- `docs/420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md`
- `.github/workflows/420hz-gca.yml`

The CI workflow now watches the GCA machine-readable config family with `hz/config/gca-*.json` and runs both retained HZ-GCA-1.1 and HZ-GCA-1.2 verifiers on the exact pull-request head.

## Object vocabulary satisfied

### Generate

- GenerationProject
- GenerationIntent
- GenerationRunBinding
- GenerationOutput
- GenerationArtifact
- ProvenanceDraft
- PublishIntent

### Community / discovery

- ArtistFollow
- RecordingFavorite
- Playlist
- PlaylistItem
- CommunityActivity
- ChartSnapshot

### Awards

- AwardProgram
- AwardSeason
- AwardCategory
- EligibilityPolicy
- AwardNomination
- AwardBallot
- AwardVote
- AwardResult
- AwardBadge

### External canonical references

- CreatorAccountRef
- CreatorProfileRef
- WorkRef
- RecordingRef
- LicenseRef
- AIJobRef
- AIModelVersionRef
- AIProviderRef
- ComputeRequestRef
- ComputeJobRef
- StorageObjectRef
- PaymentRef

## Source reconciliation

The model preserves repository-native object identities and authority:

- Creative `CreatorId`, `WorkId`, `RecordingId`, and `LicenseId` remain the native Creative typed IDs.
- 420AI AI job/model-version identity remains external and authoritative in 420AI.
- Compute request/job identity remains external and authoritative in Compute Market.
- GenerateRunBinding stores references/observations only and cannot mutate AI/Compute canonical lifecycle.
- Indexer/Search-style activity/chart objects remain rebuildable derived projections.
- 420Hz Awards records are product-domain objects and do not become Civic governance objects.

## Object-model invariants

The manifest freezes **HZGCA-OBJ-001 through HZGCA-OBJ-016**.

Qualification checks include:

- one authority class and one logical ID field per object;
- no duplicate object type definitions;
- exact required object vocabulary;
- private-by-default classification for generation/draft objects;
- derived classification for CommunityActivity and ChartSnapshot;
- Awards product-domain classification;
- external canonical reference-only classification;
- no independently mutable canonical fields on external references;
- native Creative/AI/Compute identifier preservation;
- immutable/mutable field non-overlap;
- no silent ID reuse;
- no plaintext protected payloads in private IDs;
- no authority broadening beyond HZ-GCA-1.1.

## Level-1 qualification

Dedicated workflow:

**420Hz GCA Qualification**

Successful run:

- Run ID: **37721515964**
- Run number: **#14**
- Job: **HZ-GCA Level 1**
- Job ID: **113130002880**
- Exact tested SHA: `026fce66d054172dffeb49082a502feef0284d97`
- Result: **PASS**

Successful job steps:

1. exact-head checkout;
2. exact PR-head verification;
3. boundary manifest JSON validation;
4. retained HZ-GCA-1.1 boundary verifier;
5. HZ-GCA-1.2 canonical object-model verifier.

No required step was skipped or cancelled.

## Security / adversarial result

For this architecture/schema step, applicable security qualification focuses on identity confusion, authority duplication and mutation ambiguity.

Result: **PASS**

The verifier mechanically rejects:

- missing required object types;
- duplicate type definitions;
- unknown authority classes;
- missing IDs/owners/visibility/mutability/reference boundaries;
- fields declared both immutable and mutable;
- public reclassification of private generation objects;
- authoritative reclassification of chart/activity projections;
- Awards objects escaping the Awards product domain;
- external references gaining independently mutable canonical fields;
- Creative/AI/Compute native ID drift;
- missing no-duplication rules;
- loss of HZ-GCA-1.1 prerequisite binding.

Full privacy, lifecycle, economics, moderation and threat-model hardening remains assigned to later HZ-GCA-1.x steps.

## Level 2 status

**Not run / not required.**

HZ-GCA-1.2 remains an ordinary app-architecture work package. It introduces no executable shared-component integration requiring milestone qualification.

The HZ-GCA-1 Level-2 milestone remains **HZ-GCA-1.20** after the complete HZ-GCA-1 architecture/rules package converges.

## Intentionally deferred Level 3

Deferred to HZ-GCA-17:

- canonical full Solidity inventory;
- Genesis/address-authority qualification;
- 420 Integrated/global qualification;
- repository-wide Docs/global reconciliation;
- complete retained 420Hz app integration suite;
- broad client/service/Indexer/Search/RPC qualification;
- full adversarial/invariant/static/security qualification;
- deployment/config qualification.

No broad global rerun is required for this ordinary object-model step.

## Limitations

This step intentionally does not freeze:

- exact storage implementation;
- public ABI;
- contract inventory;
- address allocation;
- Generate lifecycle transitions;
- AI disclosure semantics;
- provenance schema details;
- privacy/retention policy;
- award voting mechanics;
- testnet or production deployment.

Those belong to subsequent roadmap work.

## Blockers

None for HZ-GCA-1.2.

## Completion state

**HZ-GCA-1.2 — COMPLETE (Level 1).**

Parent **HZ-GCA-1 remains IN PROGRESS**.

Next canonical work package:

**HZ-GCA-1.3 — Define Generate lifecycle**
