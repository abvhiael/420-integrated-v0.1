# HZ-GCA-1.3 — Generate lifecycle qualification evidence

Status: **COMPLETE — Level 1**

Canonical parent step: **HZ-GCA-1 — Scope, threat model and authority map**

Work package: **HZ-GCA-1.3 — Define Generate lifecycle**

## Qualification identity

- Repository: `abvhiael/420-integrated-v0.1`
- PR: **#565 — Add 420Hz Generate, Community & Awards roadmap phase**
- Audit/implementation branch: `feature/420hz-generate-community-awards-roadmap`
- Current `main` / base SHA: `537525ebc636eabc76ff261f5b5ff5d236869b32`
- Qualified implementation SHA: `c0ec03ce63af3e83462c9ce32d77dee7fb40a979`
- Qualification level: **Level 1 — per-roadmap-step fast qualification**
- Level 2 milestone: **NOT REQUIRED for HZ-GCA-1.3**
- Level 3: **DEFERRED to HZ-GCA-17 phase closeout**

## Canonical definition

HZ-GCA-1.3 freezes the 420Hz Generate product lifecycle:

`DRAFT → QUOTED → SUBMITTED → RUNNING → SUCCEEDED → REVIEWED → REGISTERED → PUBLISHED`

with exceptional terminal outcomes:

- `FAILED`
- `CANCELLED`

The step preserves HZ-GCA-1.1 authority boundaries and HZ-GCA-1.2 object ownership while mapping product state to authoritative 420AI, Compute Market and Creative state.

## Implementation completed

Added:

- `hz/config/gca-generate-lifecycle-v1.json`
- `docs/architecture/420hz/HZ-GCA-1.3-GENERATE-LIFECYCLE.md`
- `scripts/verify-420hz-gca-1-3.py`

Updated:

- `docs/420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md`
- `.github/workflows/420hz-gca.yml`

The workflow now validates all `hz/config/gca-*.json` manifests and runs retained HZ-GCA-1.1, HZ-GCA-1.2 and HZ-GCA-1.3 verification against the exact PR head.

## Requirements satisfied

### Lifecycle vocabulary and transitions

The manifest freezes:

- DRAFT
- QUOTED
- SUBMITTED
- RUNNING
- SUCCEEDED
- FAILED
- CANCELLED
- REVIEWED
- REGISTERED
- PUBLISHED

Every legal transition has an explicit guard. Shortcut transitions such as DRAFT→SUBMITTED, SUBMITTED→SUCCEEDED, SUCCEEDED→REGISTERED, REVIEWED→PUBLISHED, FAILED→RUNNING and CANCELLED→SUBMITTED are explicitly forbidden.

### 420AI observation mapping

- CREATED / FUNDED / MATCHED / ACCEPTED → SUBMITTED
- RUNNING → RUNNING
- RESULT_COMMITTED → RUNNING
- VERIFIED / SETTLED → SUCCEEDED
- CANCELLED → CANCELLED
- EXPIRED / FAILED → FAILED
- DISPUTED → hold at prior submitted/running phase
- REFUNDED → preserve preceding FAILED/CANCELLED cause

Product state is observational and cannot overwrite canonical AI/Compute state.

### Review / registration / publication gates

REVIEWED requires:

- SUCCEEDED;
- explicit creator output selection;
- provenance/disclosure review commitment.

REGISTERED requires:

- REVIEWED;
- canonical native WorkId;
- canonical native RecordingId;
- successful Creative registration.

PUBLISHED requires:

- REGISTERED;
- canonical Recording ACTIVE;
- successful media/release/catalog publication.

### Retry / replay / cancellation

- FAILED and CANCELLED are historical terminal outcomes for the exact intent/run.
- Retry creates a new intent/run or explicit supersession.
- Quote refresh may return QUOTED→DRAFT before submission.
- Duplicate submissions must resolve idempotently to the same canonical AI job or fail closed.
- Post-submission cancellation requires owning AI/Compute confirmation.
- 420Hz cancellation cannot transfer/refund funds or erase valid external earned entitlement.

### Partial outputs

Partial output may be retained only if explicitly admitted by the owning AI/Compute policy. It does not itself qualify as SUCCEEDED and cannot bypass review, provenance, rights, registration or publication.

## Lifecycle invariants

The manifest freezes **HZGCA-LIFE-001 through HZGCA-LIFE-018**.

The targeted verifier checks:

- exact lifecycle state vocabulary/order;
- exact legal transition graph;
- transition guards;
- required forbidden shortcuts;
- exact 420AI product-state mappings;
- HZ-GCA-1.1 and HZ-GCA-1.2 prerequisite binding;
- GenerationIntent / GenerationRunBinding / GenerationOutput / PublishIntent state ownership;
- failed/cancelled retry history rules;
- duplicate-submission idempotency;
- partial-output non-bypass;
- post-submission cancellation authority;
- separation of review/registration/publication gates;
- required WorkId, RecordingId and Recording ACTIVE gates;
- all 18 invariant identifiers;
- source-document existence;
- roadmap Level-1/non-milestone classification.

## Level-1 qualification

Dedicated workflow:

**420Hz GCA Qualification**

Successful exact-head run:

- Run ID: **37722046860**
- Run number: **#27**
- Job: **HZ-GCA Level 1**
- Job ID: **113131696468**
- Exact tested SHA: `c0ec03ce63af3e83462c9ce32d77dee7fb40a979`
- Result: **PASS**

Successful steps:

1. exact-head checkout;
2. exact PR-head verification;
3. all GCA JSON manifest syntax validation;
4. HZ-GCA-1.1 product-boundary verifier;
5. HZ-GCA-1.2 canonical object-model verifier;
6. HZ-GCA-1.3 Generate lifecycle verifier.

No required check was skipped or cancelled.

## Diagnosed failed attempt

Initial exact-head run:

- SHA: `5bd32bdf9ec810b35d3976f11394ac85a2458d45`
- Run ID: **37721999548**
- Job ID: **113131543167**
- Result: **FAIL**

The only failure was:

`post-submission cancellation authority missing`

Diagnosis: **test-harness wording defect**.

The manifest correctly stated:

`owning AI/Compute cancellation confirmation`

while the verifier expected the stricter literal phrase:

`canonical owning AI/Compute cancellation confirmation`

No architecture requirement was absent. The verifier phrase was aligned to the existing normative wording. No assertion, transition, security rule or authority boundary was removed or weakened.

The repaired SHA was then qualified exactly and passed.

## Security / adversarial result

For this lifecycle-definition step, applicable adversarial coverage focuses on illegal transitions, authority escalation, replay and state confusion.

Result: **PASS**

The verifier rejects lifecycle models that:

- skip required stages;
- treat RESULT_COMMITTED as success;
- let FAILED/CANCELLED re-enter execution;
- auto-promote SUCCEEDED into registration/publication;
- permit local cancellation to stand in for canonical post-submission cancellation;
- let partial output bypass verification;
- treat PublishIntent as Creative authority;
- drop native Creative registration gates;
- remove duplicate-submission idempotency.

## Level 2 status

**Not run / not required.**

HZ-GCA-1.3 is an ordinary architecture/lifecycle work package. It does not introduce executable shared-component integration requiring milestone qualification.

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

HZ-GCA-1.3 intentionally does not yet freeze:

- detailed AI disclosure rules;
- provenance field schema;
- rights/voice/reference-audio consent rules;
- privacy/retention implementation;
- generation economics;
- provider adapter implementation;
- live retry/refund execution;
- actual UI/backend state machine code;
- testnet or production deployment.

Those remain later canonical roadmap work.

## Blockers

None for HZ-GCA-1.3.

## Completion state

**HZ-GCA-1.3 — COMPLETE (Level 1).**

Parent **HZ-GCA-1 remains IN PROGRESS**.

Next canonical work package:

**HZ-GCA-1.4 — Define AI disclosure rules**
