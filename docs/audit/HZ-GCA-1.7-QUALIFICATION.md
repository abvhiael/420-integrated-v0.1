# HZ-GCA-1.7 — Privacy model qualification evidence

Status: **COMPLETE — Level 1**

Canonical parent step: **HZ-GCA-1 — Scope, threat model and authority map**

Work package: **HZ-GCA-1.7 — Define privacy model**

## Qualification identity

- Repository: `abvhiael/420-integrated-v0.1`
- PR: **#565 — Add 420Hz Generate, Community & Awards roadmap phase**
- Audit/implementation branch: `feature/420hz-generate-community-awards-roadmap`
- Current `main` / base SHA: `537525ebc636eabc76ff261f5b5ff5d236869b32`
- Qualified implementation SHA: `e059c93b502c293aac2f49a3c56acd412673e1a7`
- Qualification level: **Level 1 — per-roadmap-step fast qualification**
- Level 2 milestone: **NOT REQUIRED for HZ-GCA-1.7**
- Level 3: **DEFERRED to HZ-GCA-17 phase closeout**

## Canonical definition

HZ-GCA-1.7 freezes privacy classes, protected-data handling, private AI/Compute execution boundaries, projection/indexing exclusions, logging/telemetry redaction, lifecycle visibility transitions and fail-closed behavior for Generate, Community and Awards.

The four logical privacy classes are:

- PUBLIC;
- UNLISTED;
- PRIVATE;
- SECRET.

## Implementation completed

Added:

- `hz/config/gca-privacy-v1.json`
- `docs/architecture/420hz/HZ-GCA-1.7-PRIVACY-MODEL.md`
- `scripts/verify-420hz-gca-1-7.py`

Updated:

- `docs/420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md`
- `.github/workflows/420hz-gca.yml`

## Requirements satisfied

### Private-by-default Generate content

Private by default:

- GenerationProject;
- GenerationIntent;
- GenerationRunBinding;
- GenerationOutput;
- GenerationArtifact;
- ProvenanceDraft;
- PublishIntent;
- prompts;
- private lyric drafts;
- reference audio;
- draft mixes/outputs;
- private stems;
- raw consent evidence.

Generation success, review or registration does not automatically make those payloads public.

### Secrets

Wallet private keys, provider API credentials, bearer/session tokens and decryption credentials are classified SECRET and may not be persisted as 420Hz content, logged or indexed.

### AI / Compute private execution

The model requires:

- authenticated encrypted off-chain payload handling;
- assignment-scoped access;
- least privilege;
- time-bounded access;
- no cross-project/cross-job permission;
- minimum necessary data transfer;
- fail-closed expired/wrong-scope access;
- no plaintext prompts/audio/private payloads in public runtime state/logs.

### Indexer/Search

Public projections admit only explicitly public-eligible data.

- PRIVATE and SECRET are excluded.
- UNLISTED is excluded from broad Search/trending/discovery.
- draft Generate state is non-indexable.
- commitments/ciphertext references do not authorize protected payload recovery.
- Search visibility cannot exceed source visibility.

### Notifications

420Notifications may receive minimal event metadata for opt-in delivery, but not raw private generation payloads.

Subscription state, watchlists, endpoints and notification history remain private by default.

### Logs, telemetry and CI

Logs/traces/crash reports/metrics/CI must redact or omit prompts, lyrics, raw audio/stems, tokens, credentials, wallet secrets and raw consent evidence.

Debug mode cannot silently disable those protections.

### Community and Awards

- favorites default PRIVATE;
- private playlists remain PRIVATE;
- unlisted playlists remain UNLISTED;
- public playlists are PUBLIC;
- Awards vote secret/signature material remains private;
- finalized Award results may be public.

### Retention boundary

HZ-GCA-1.7 requires bounded retention and forbids indefinite private provider/runtime copies by default.

Exact deletion/retention durations, archival, export, quotas and abandoned/failed-project cleanup remain intentionally assigned to **HZ-GCA-1.8 — Define storage & retention rules**.

## Privacy invariants

The manifest freezes **HZGCA-PRIV-001 through HZGCA-PRIV-018**.

The targeted verifier checks:

- exact privacy class vocabulary and default indexability;
- required privacy classifications for Generate/community/award data;
- private-by-default Generate objects;
- provider encryption/scope/minimization rules;
- off-chain raw private content;
- low-entropy hash confidentiality warning;
- retention deferral to HZ-GCA-1.8;
- PRIVATE/SECRET Search exclusion;
- UNLISTED broad-Search exclusion;
- Notifications minimization/private subscription state;
- logging/telemetry/CI redaction;
- lifecycle publication boundaries;
- fail-closed privacy cases;
- all 18 invariant identifiers;
- retained source-document existence;
- roadmap Level-1/non-milestone classification.

## Level-1 qualification

Dedicated workflow:

**420Hz GCA Qualification**

Successful exact-head run:

- Run ID: **37726154039**
- Run number: **#75**
- Job: **HZ-GCA Level 1**
- Job ID: **113144673439**
- Exact tested SHA: `e059c93b502c293aac2f49a3c56acd412673e1a7`
- Result: **PASS**

Successful checks:

1. exact PR-head checkout/verification;
2. all GCA JSON manifest syntax validation;
3. retained HZ-GCA-1.1 verifier;
4. retained HZ-GCA-1.2 verifier;
5. retained HZ-GCA-1.3 verifier;
6. retained HZ-GCA-1.4 verifier;
7. retained HZ-GCA-1.5 verifier;
8. retained HZ-GCA-1.6 verifier;
9. HZ-GCA-1.7 privacy verifier.

No required Level-1 check was skipped, cancelled, stale or substituted.

The concurrently triggered 420Hz Web Qualification also passed on the same exact implementation SHA. It is useful collateral evidence but is not required to close HZ-GCA-1.7.

## CI diagnosis

No HZ-GCA-1.7 implementation, verifier or workflow defect occurred on the qualified implementation SHA.

The first exact-head HZ-GCA-1.7 qualification run passed.

## Security / adversarial result

Applicable security qualification focuses on privacy leakage, visibility escalation, private payload logging/indexing and provider scope expansion.

Result: **PASS**

The verifier rejects policies that:

- make Generate drafts public by default;
- index PRIVATE/SECRET data;
- broad-index UNLISTED objects;
- omit encrypted/scoped provider access;
- allow cross-job/project access;
- log protected generation payloads/secrets;
- let Notifications republish raw private payloads;
- let Search broaden source visibility;
- silently publish unresolved-visibility fields;
- remove bounded retention/privacy fail-closed rules.

## Level 2 status

**Not run / not required.**

HZ-GCA-1.7 is an ordinary architecture/privacy work package and does not introduce executable shared-component behavior requiring milestone qualification.

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

HZ-GCA-1.7 intentionally does not yet freeze exact retention periods, archival/export/quota policy, failed/abandoned-project cleanup, storage deletion mechanics or production provider/runtime deployment.

Those belong to HZ-GCA-1.8 and later implementation steps.

## Blockers

None for HZ-GCA-1.7.

## Completion state

**HZ-GCA-1.7 — COMPLETE (Level 1).**

Parent **HZ-GCA-1 remains IN PROGRESS**.

Next canonical work package:

**HZ-GCA-1.8 — Define storage & retention rules**
