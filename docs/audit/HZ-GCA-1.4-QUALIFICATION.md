# HZ-GCA-1.4 — AI disclosure rules qualification evidence

Status: **COMPLETE — Level 1**

Canonical parent step: **HZ-GCA-1 — Scope, threat model and authority map**

Work package: **HZ-GCA-1.4 — Define AI disclosure rules**

## Qualification identity

- Repository: `abvhiael/420-integrated-v0.1`
- PR: **#565 — Add 420Hz Generate, Community & Awards roadmap phase**
- Audit/implementation branch: `feature/420hz-generate-community-awards-roadmap`
- Current `main` / base SHA: `537525ebc636eabc76ff261f5b5ff5d236869b32`
- Qualified implementation SHA: `fe31b81b158cc1a486c7eb0f526b07a095279841`
- Qualification level: **Level 1 — per-roadmap-step fast qualification**
- Level 2 milestone: **NOT REQUIRED for HZ-GCA-1.4**
- Level 3: **DEFERRED to HZ-GCA-17 phase closeout**

## Canonical definition

HZ-GCA-1.4 freezes the AI-disclosure vocabulary and publication rules for Generate-originated recordings.

Exactly one disclosure class is required at publication:

- `HUMAN`
- `AI_ASSISTED`
- `AI_GENERATED`
- `AI_DERIVATIVE`

The step also freezes classification precedence, ambiguity handling, publication binding, append-only correction/versioning, Model420/provider-disclosure separation, Creative rights/provenance boundaries and privacy rules.

## Implementation completed

Added:

- `hz/config/gca-ai-disclosure-v1.json`
- `docs/architecture/420hz/HZ-GCA-1.4-AI-DISCLOSURE.md`
- `scripts/verify-420hz-gca-1-4.py`

Updated:

- `docs/420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md`
- `.github/workflows/420hz-gca.yml`

## Requirements satisfied

### Disclosure vocabulary

The four-class vocabulary is exact and closed:

- HUMAN — no material generative-AI contribution incorporated;
- AI_ASSISTED — material AI assistance without substantial generated content in the released composition/master;
- AI_GENERATED — substantial generated compositional/audible/performance content retained;
- AI_DERIVATIVE — generative transformation/remix of an existing source requiring source authorization.

### Classification precedence

The policy freezes:

1. AI_DERIVATIVE over AI_GENERATED where source transformation requires authorization;
2. AI_GENERATED over AI_ASSISTED where substantial generated content remains;
3. AI_ASSISTED over HUMAN where material generative assistance contributed;
4. HUMAN only when none of the AI conditions apply.

No numeric percentage threshold was invented. Genuine ambiguity between AI_ASSISTED and AI_GENERATED fails closed at publication rather than defaulting to HUMAN.

### Publication binding and corrections

For Generate-originated publication:

- disclosure is mandatory;
- exactly one class is allowed;
- publication cannot complete without a valid disclosure commitment;
- the published Recording/version retains historical disclosure;
- corrections require an explicit new revision/version;
- prior disclosure values remain retained;
- withdrawal/restriction does not erase disclosure history.

### Model/provider separation

The repository's Model420 `aiDisclosureHash` remains model/version metadata only.

It cannot independently determine the disclosure class of a particular Recording.

Provider marketing, model name, Search labels, chart placement or popularity cannot determine the Recording disclosure.

### Creative Protocol boundaries

- Creative `RecordingClass.AI_DERIVATIVE` requires disclosure AI_DERIVATIVE.
- Other RecordingClass values do not fully determine disclosure.
- Creative `ProvenanceClass` and `RightsStatus` do not substitute for disclosure.
- Disclosure grants no copyright, authorship, license, consent, rights, payment or governance authority.
- AI transformation authorization remains distinct from AI training permission.

### Privacy

Public disclosure does not require exposing plaintext prompts, private lyric drafts, raw reference audio, provider credentials, model secrets or private intermediate output.

## Disclosure invariants

The manifest freezes **HZGCA-DISC-001 through HZGCA-DISC-016**.

The targeted verifier checks:

- exact four-class vocabulary and order;
- per-class meaning/allowed/forbidden conditions;
- precedence ordering;
- no invented fixed substantiality threshold;
- fail-closed ambiguity;
- mandatory exactly-one publication binding;
- historical immutability and versioned correction;
- required disclosure-record fields;
- provider/Model420 non-authority;
- rights/training/transformation separation;
- RecordingClass AI_DERIVATIVE mapping;
- ProvenanceClass/RightsStatus separation;
- REVIEWED creator confirmation;
- PUBLISHED public disclosure gate;
- privacy exclusions;
- fail-closed validation cases;
- all 16 invariant identifiers;
- retained source-document existence;
- roadmap Level-1/non-milestone classification.

## Level-1 qualification

Dedicated workflow:

**420Hz GCA Qualification**

Successful exact-head run:

- Run ID: **37723211985**
- Run number: **#40**
- Job: **HZ-GCA Level 1**
- Job ID: **113135378491**
- Exact tested SHA: `fe31b81b158cc1a486c7eb0f526b07a095279841`
- Result: **PASS**

Successful steps:

1. exact-head checkout;
2. exact PR-head verification;
3. all GCA JSON manifest syntax validation;
4. retained HZ-GCA-1.1 product-boundary verifier;
5. retained HZ-GCA-1.2 canonical object-model verifier;
6. retained HZ-GCA-1.3 Generate lifecycle verifier;
7. HZ-GCA-1.4 AI disclosure verifier.

No required check was skipped or cancelled.

## Diagnosed failed attempt

Initial exact-head run:

- SHA: `887bfa816205df62300e94c5656b2fef88cb6fd9`
- Run ID: **37723175535**
- Job ID: **113135266857**
- Result: **FAIL**

Only two verifier assertions failed:

- `ambiguous classification fail-closed rule missing`
- `ambiguous HUMAN default prohibition missing`

Diagnosis: **test-harness wording defect**.

The normative manifest already said:

- publication must `fail closed`;
- classification must resolve `rather than default to HUMAN`.

The verifier expected the literal variants `fails closed` and `never default to HUMAN`.

The repair changed only the verifier phrase matching. No disclosure class, precedence rule, privacy rule, publication gate, rights boundary or fail-closed requirement was weakened or removed.

The repaired SHA was then qualified exactly and passed.

## Security / adversarial result

For this disclosure-policy step, applicable adversarial qualification focuses on mislabeling, authority confusion and privacy leakage.

Result: **PASS**

The verifier rejects models that:

- remove or add disclosure classes;
- downgrade derivative/generated content through precedence drift;
- default ambiguity to HUMAN;
- omit mandatory disclosure at publication;
- allow multiple simultaneous classes;
- treat Model420/provider marketing as Recording disclosure authority;
- use disclosure as a rights/license/training grant;
- collapse ProvenanceClass or RightsStatus into disclosure;
- overwrite historical disclosure in place;
- require disclosure of private prompts/reference payloads.

## Level 2 status

**Not run / not required.**

HZ-GCA-1.4 is an ordinary architecture/policy work package and introduces no executable shared-component integration requiring milestone qualification.

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

HZ-GCA-1.4 intentionally does not yet freeze the full provenance schema, consent records, source/reference-audio authorization schema, storage/retention implementation, provider adapter implementation, disclosure UI implementation, on-chain ABI or live deployment.

Those belong to later roadmap work.

## Blockers

None for HZ-GCA-1.4.

## Completion state

**HZ-GCA-1.4 — COMPLETE (Level 1).**

Parent **HZ-GCA-1 remains IN PROGRESS**.

Next canonical work package:

**HZ-GCA-1.5 — Define provenance model**
