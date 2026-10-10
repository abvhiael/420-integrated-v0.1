# HZ-GCA-1.11 — Charts rules qualification evidence

Status: **COMPLETE — Level 1**

Canonical parent step: **HZ-GCA-1 — Scope, threat model and authority map**

Work package: **HZ-GCA-1.11 — Define Charts rules**

## Qualification identity

- Repository: `abvhiael/420-integrated-v0.1`
- PR: **#565 — Add 420Hz Generate, Community & Awards roadmap phase**
- Branch: `feature/420hz-generate-community-awards-roadmap`
- Qualified implementation SHA: `7181155882f11663c3b501a32b067bd16e050b6f`
- Implementation reconciliation/base SHA: `c6b62a6ea75be97564564e56b779dfad7df3f784`
- Current `main` at evidence closeout: `d112b2eb55b50a3a4f52a5e2a5364374595efe71`
- Qualification level: **Level 1 — per-roadmap-step fast qualification**
- Level 2 milestone: **NOT REQUIRED for HZ-GCA-1.11**
- Level 3: **DEFERRED to HZ-GCA-17 phase closeout**

Current main advanced after exact-head qualification via an unrelated ReeferReview/testnet documentation reconciliation. That change does not materially alter the HZ-GCA-1.11 Charts dependencies or invalidate the exact-head Level-1 result, so ordinary-step main reconciliation is intentionally not repeated.

## Canonical definition

HZ-GCA-1.11 freezes 420Hz Charts as deterministic, versioned and rebuildable derived projections over eligible public source state.

It explicitly separates:

- raw plays;
- qualified plays;
- distinct listeners;
- public favorites;
- public playlist adds;
- public follows;
- shares;
- Search clicks;
- Generate activity;
- Award votes.

Charts do not become Creative, Identity, Awards, payment, Search, playback or governance authority.

## Implementation completed

Added:

- `hz/config/gca-charts-v1.json`
- `docs/architecture/420hz/HZ-GCA-1.11-CHARTS-RULES.md`
- `scripts/verify-420hz-gca-1-11.py`

Updated:

- `docs/420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md`
- `.github/workflows/420hz-gca.yml`

## Requirements satisfied

### Chart families

Frozen initial logical chart families:

- TOP_RECORDINGS
- TRENDING_RECORDINGS
- NEW_RECORDINGS
- TOP_ARTISTS
- COMMUNITY_FAVORITES

These remain product presentation classes, not canonical media or rights categories.

### Signal separation

The machine policy distinguishes RAW_PLAY from QUALIFIED_PLAY.

AwardVote, Search clicks and Generate counts are categorically non-chart signals.

Community signals are not automatically chart credit.

### V1 methodology

Policy version 1 freezes:

- qualified play weight: 1
- distinct listener bonus: 1
- public favorite weight: 0
- public playlist-add weight: 0
- public follow weight: 0

Thus v1 positive ranking is based on qualified playback/listener evidence only.

Any change in weight, qualification, dedupe, decay, tie-break or window semantics requires a new chartPolicyVersion.

### Runtime threshold boundary

HZ-GCA-1.11 intentionally does not invent a playback-duration/completion threshold because no qualified 420Hz playback-event runtime currently exists to enforce one.

A raw play can become QUALIFIED_PLAY only through a later qualified runtime source under an explicit versioned threshold/policy.

### Eligibility and privacy

Public chart inputs require eligible PUBLIC source state.

Excluded:

- PRIVATE content;
- UNLISTED content;
- private favorites/playlists;
- deleted/withdrawn/unavailable/rights-blocked content;
- stale/unverified source state where current freshness is required.

AI disclosure class may be a public filter/facet but does not automatically boost or penalize rank.

### Time windows

Frozen logical windows:

- DAILY — 24h
- WEEKLY — 7d
- MONTHLY — 30d with exact rolling/fixed semantics declared by policy version
- ALL_TIME — checkpoint-bounded eligible history

### Anti-gaming / replay

Rules include:

- stable event/replay-key dedupe;
- no duplicate-delivery/rebuild inflation;
- bounded repeated contribution;
- malformed/future/window mismatch rejection;
- test/synthetic fixture exclusion;
- no PRIVATE/UNLISTED scoring;
- no direct operator/admin rank edits;
- no sponsored boost;
- no AwardVote reuse;
- no Community replay inflation.

### Deterministic snapshots

ChartSnapshot binds:

- chartPolicyVersion;
- windowStart;
- windowEnd;
- sourceCheckpoint;
- resultCommitment.

Same policy + same eligible inputs/checkpoint must produce the same ordered result.

Default v1 tie-break:

1. score descending;
2. stable canonical target ID ascending.

Corrections/rebuilds create a new snapshot/result commitment rather than mutating historical snapshot bytes in place.

### Freshness / Search / Indexer

420Indexer/Search/Analytics remain non-authoritative.

Stale/degraded source state must be surfaced or failed closed.

Search may index a published ChartSnapshot but cannot rewrite the rank.

### Community / Awards separation

- Community actions do not automatically score.
- AwardVote is never chart credit.
- Chart rank does not create Award eligibility, nomination, ballot placement, vote or winner state.
- Future Awards policy may reference chart snapshots only through explicit versioned rules.

## Charts invariants

The manifest freezes **HZGCA-CHART-001 through HZGCA-CHART-018**.

The targeted verifier checks:

- derived-only chart authority;
- exact chart-family vocabulary;
- exact signal vocabulary;
- RAW_PLAY / QUALIFIED_PLAY separation;
- AwardVote exclusion;
- exact v1 weights;
- policy-version requirements;
- source eligibility/privacy;
- time windows;
- anti-replay / anti-gaming rules;
- distinct-listener privacy;
- deterministic snapshot/tie-breaking;
- source checkpoint/result commitment;
- stale/rebuild behavior;
- Charts/Community/Awards/Search/Indexer separation;
- all 18 invariant identifiers;
- HZ-GCA-1.2/1.7/1.10 prerequisite binding;
- roadmap Level-1/non-milestone classification.

## Level-1 qualification

Dedicated workflow:

**420Hz GCA Qualification**

Successful exact-head run:

- Run ID: **37735399558**
- Run number: **#126**
- Job: **HZ-GCA Level 1**
- Job ID: **113173663026**
- Exact tested SHA: `7181155882f11663c3b501a32b067bd16e050b6f`
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
9. retained HZ-GCA-1.7 verifier;
10. retained HZ-GCA-1.8 verifier;
11. retained HZ-GCA-1.9 verifier;
12. retained HZ-GCA-1.10 verifier;
13. HZ-GCA-1.11 Charts verifier.

The concurrently triggered **420Hz Web Qualification #86** also passed on the same implementation SHA. It is collateral evidence, not a substitute for GCA Level 1.

## Diagnosed failed attempt

Initial exact-head run:

- SHA: `b12bd5836ec1ba173b2e6202abe73d95b5c193ee`
- Run: **37735332377**
- Job: **113173450690**
- Failure: `hidden boost prohibition missing`

Diagnosis: **test-harness wording/case defect**.

The normative manifest already contained:

`no hidden personalized or sponsored boost may alter canonical chart rank`

The verifier expected the same phrase beginning with capital `No`.

Repair:

- aligned only the case-sensitive verifier string;
- changed no Chart methodology;
- changed no score weight;
- removed no anti-gaming assertion;
- changed no privacy/source eligibility rule;
- weakened no authority boundary.

The repaired exact SHA then passed.

## Security / adversarial result

Result: **PASS**

The verifier rejects Chart policies that:

- treat RAW_PLAY as qualified credit;
- admit PRIVATE/UNLISTED inputs;
- reuse AwardVote as chart credit;
- allow replay/duplicate inflation;
- omit deterministic snapshot/tie-breaking;
- permit direct operator rank edits;
- mix sponsored placement into organic ranking;
- expose protected private listener/community state;
- let chart score create rights/payment/Award/Identity/Governance authority.

## Level 2 status

**Not run / not required.**

HZ-GCA-1.11 is an ordinary architecture/policy work package. No runtime chart service or shared executable integration was introduced.

The HZ-GCA-1 Level-2 milestone remains **HZ-GCA-1.20**.

## Intentionally deferred Level 3

Deferred to HZ-GCA-17:

- canonical full Solidity inventory;
- Genesis/address-authority qualification;
- 420 Integrated/global qualification;
- repository-wide Docs/global reconciliation;
- retained 420Hz app suite;
- affected clients/services/Indexer/Search/RPC/frontend/backend suites;
- full adversarial/invariant/static/security qualification;
- deployment/config verification.

At Level 3, Solidity Contracts owns the canonical full Foundry inventory. Genesis/address-authority verification remains separate and must not duplicate it.

## Limitations

HZ-GCA-1.11 intentionally does not implement:

- a playback event collector;
- actual qualified-play runtime threshold;
- production listener dedupe service;
- chart persistence/runtime API;
- Search/Analytics production adapter;
- anti-bot runtime classifier;
- chart frontend;
- testnet/production deployment.

Those remain later implementation/testnet work.

## Blockers

None for HZ-GCA-1.11.

## Completion state

**HZ-GCA-1.11 — COMPLETE (Level 1).**

Parent **HZ-GCA-1 remains IN PROGRESS**.

Next canonical work package:

**HZ-GCA-1.12 — Define Awards architecture**
