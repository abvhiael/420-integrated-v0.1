# HZ-GCA-1.6 — Rights & consent boundaries qualification evidence

Status: **COMPLETE — Level 1**

Canonical parent step: **HZ-GCA-1 — Scope, threat model and authority map**

Work package: **HZ-GCA-1.6 — Define rights & consent boundaries**

## Qualification identity

- Repository: `abvhiael/420-integrated-v0.1`
- PR: **#565 — Add 420Hz Generate, Community & Awards roadmap phase**
- Audit/implementation branch: `feature/420hz-generate-community-awards-roadmap`
- Current `main` / base SHA: `537525ebc636eabc76ff261f5b5ff5d236869b32`
- Qualified implementation SHA: `2fe236a14bea157d05a435cc9b78d3a44f9151f5`
- Qualification level: **Level 1 — per-roadmap-step fast qualification**
- Level 2 milestone: **NOT REQUIRED for HZ-GCA-1.6**
- Level 3: **DEFERRED to HZ-GCA-17 phase closeout**

## Canonical definition

HZ-GCA-1.6 freezes rights and consent boundaries for Generate-originated music.

The implementation preserves canonical Creative Protocol and 420AI authority while defining fail-closed product behavior for:

- derivative source authorization;
- exact Creative permission masks;
- Creative licenses;
- contributor credits;
- economic rights;
- AI training rights;
- synthetic voice/persona consent;
- authorization expiry/revocation/revalidation;
- lifecycle rights/consent gates.

## Implementation completed

Added:

- `hz/config/gca-rights-consent-v1.json`
- `docs/architecture/420hz/HZ-GCA-1.6-RIGHTS-CONSENT-BOUNDARIES.md`
- `scripts/verify-420hz-gca-1-6.py`

Updated:

- `docs/420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md`
- `.github/workflows/420hz-gca.yml`

## Requirements satisfied

### Authority boundaries

420Hz is explicitly non-authoritative for:

- Creative rights;
- derivative authorization;
- Creative licenses;
- contributor-credit acceptance;
- economic rights splits;
- AI training rights;
- Wallet signing;
- synthetic voice/persona consent.

### Canonical derivative permission masks

The machine policy preserves current `AuthorizationRegistry420` semantics for:

- COVER;
- REMIX;
- STEM_REMIX;
- SAMPLE_DERIVATIVE;
- AI_DERIVATIVE.

For AI_DERIVATIVE the current source-Recording requirements remain:

- `AI_TRANSFORM`
- `USE_MASTER`
- `COMMERCIALIZE`

and Work permission remains:

- `COMMERCIALIZE`

### Creative license validation

A license may satisfy a required source-Recording permission only through canonical Creative `LicenseRegistry420.hasPermissions` semantics for the exact:

- active license;
- licensee profile;
- source Recording;
- required permission mask;
- effective/expiry window.

Derivative authorization remains revalidated by the Creative Protocol at activation; 420Hz preflight does not become authority.

### Contributor credits vs rights

The policy freezes:

- PROPOSED credit is not accepted credit;
- only ContributorRegistry ACCEPTED state establishes accepted protocol credit;
- contributor credit is distinct from economic rights ownership;
- economic rights are distinct from source-use authorization;
- neither credit nor rights automatically establishes synthetic voice/persona consent.

### AI transformation vs training

The implementation explicitly separates:

- Creative `AI_TRANSFORM` / derivative permissions;
- 420AI Model420 training-rights declarations/grants.

Neither direction is substitutable:

- Creative transformation permission does not authorize model training;
- 420AI training grants do not authorize Creative transformation/remix/master use/commercialization.

### Synthetic voice/persona consent

Synthetic identifiable voice/persona use requires explicit scoped consent evidence.

The policy explicitly rejects as consent:

- typed names;
- artist names;
- model names;
- prompt text;
- provider badges;
- public recordings;
- unverified checkboxes;
- contributor credits alone;
- unrelated source-use licenses.

The repository does not currently establish a canonical production voice/persona consent registry for this 420Hz phase, so the product must fail closed unless a qualified explicit consent source/reference exists.

No nonexistent registry, ABI or address was invented.

### Expiry/revocation/revalidation

Time-bounded rights/consent must be checked at the exact action that relies on them.

Revocation/expiry may block new REVIEWED, registration, publication, republication or derivative actions while preserving immutable historical provenance.

Missing/unavailable/conflicting authority state fails closed.

## Rights/consent invariants

The manifest freezes **HZGCA-RC-001 through HZGCA-RC-018**.

The verifier checks:

- prerequisite binding to HZ-GCA-1.1 through HZ-GCA-1.5;
- exact derivative-class permission cases;
- exact permission-mask vocabulary;
- Creative license validity/revalidation semantics;
- contributor PROPOSED/ACCEPTED separation;
- credit/rights/consent separation;
- transformation/training non-substitution;
- synthetic voice/persona evidence requirements;
- no invented consent registry;
- reference-audio permission separation;
- lifecycle gates;
- expiry/revocation point-of-use checking;
- fail-closed missing/conflicting authority state;
- all 18 invariant identifiers;
- retained source-document existence;
- roadmap Level-1/non-milestone classification.

## Level-1 qualification

Dedicated workflow:

**420Hz GCA Qualification**

Successful exact-head run:

- Run ID: **37725350547**
- Run number: **#64**
- Job: **HZ-GCA Level 1**
- Job ID: **113142150156**
- Exact tested SHA: `2fe236a14bea157d05a435cc9b78d3a44f9151f5`
- Result: **PASS**

Successful checks:

1. exact PR-head checkout/verification;
2. all GCA JSON manifest syntax validation;
3. retained HZ-GCA-1.1 verifier;
4. retained HZ-GCA-1.2 verifier;
5. retained HZ-GCA-1.3 verifier;
6. retained HZ-GCA-1.4 verifier;
7. retained HZ-GCA-1.5 verifier;
8. HZ-GCA-1.6 rights/consent verifier.

No required check was skipped or cancelled.

## Diagnosed failed attempt

Initial exact-head run:

- SHA: `c8563c7cdd035fe003480ba16e830f9dbca675f2`
- Run ID: **37725314140**
- Job ID: **113142035777**
- Result: **FAIL**

The only failures were:

- `contributor proposed/accepted distinction missing`
- `training/Creative non-substitution missing`

Diagnosis: **test-harness wording defects**.

The normative manifest already contained both required semantics:

- a proposed Creative contributor credit is not accepted consent/attribution, and only ContributorRegistry ACCEPTED state establishes accepted protocol credit;
- a 420AI training grant does not authorize Creative transformation/remix/commercialization.

The verifier had been matching different literal tokens/casing.

Repair:

- aligned only the verifier string matching;
- removed no assertions;
- changed no permission mask;
- weakened no authorization/consent rule;
- changed no product behavior.

The repaired SHA was qualified exactly and passed.

## Security / adversarial result

Applicable security qualification focuses on permission confusion, stale authorization, consent spoofing and authority escalation.

Result: **PASS**

The verifier rejects policies that:

- broaden derivative permission masks;
- accept wrong/expired/inactive/insufficient licenses;
- confuse PROPOSED with ACCEPTED credit;
- collapse credit into rights;
- collapse rights into source authorization;
- treat AI_TRANSFORM as training permission;
- treat TrainingGrant as Creative permission;
- accept provider/model/name/prompt assertions as voice consent;
- omit fail-closed behavior where qualified consent authority is unavailable;
- allow stale/missing/conflicting authorization state;
- claim a nonexistent consent registry.

## Level 2 status

**Not run / not required.**

HZ-GCA-1.6 is an ordinary architecture/policy work package and does not introduce executable shared-component behavior requiring milestone qualification.

The HZ-GCA-1 Level-2 milestone remains **HZ-GCA-1.20**.

## Intentionally deferred Level 3

Deferred to HZ-GCA-17:

- canonical full Solidity inventory;
- Genesis/address-authority qualification;
- 420 Integrated/global qualification;
- repository-wide Docs/global reconciliation;
- retained 420Hz app integration suite;
- broad client/service/Indexer/Search/RPC qualification;
- full adversarial/invariant/static/security qualification;
- deployment/config verification.

## Limitations

HZ-GCA-1.6 intentionally does not implement:

- a new consent contract/registry;
- voice/persona consent storage service;
- rights-management UI;
- runtime license preflight service;
- provider adapter enforcement;
- new Creative contract ABI;
- live provider/testnet deployment.

Those belong to later implementation roadmap work.

## Blockers

None for HZ-GCA-1.6.

## Completion state

**HZ-GCA-1.6 — COMPLETE (Level 1).**

Parent **HZ-GCA-1 remains IN PROGRESS**.

Next canonical work package:

**HZ-GCA-1.7 — Define privacy model**
