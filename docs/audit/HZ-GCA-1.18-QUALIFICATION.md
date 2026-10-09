# HZ-GCA-1.18 — Architecture documentation consolidation qualification evidence

Status: **COMPLETE — Level 1**

Canonical parent step: **HZ-GCA-1 — Scope, threat model and authority map**

Work package: **HZ-GCA-1.18 — Architecture documentation consolidation**

## Qualification identity

- Repository: `abvhiael/420-integrated-v0.1`
- PR: **#565 — Add 420Hz Generate, Community & Awards roadmap phase**
- Branch: `feature/420hz-generate-community-awards-roadmap`
- Current `main` / base SHA: `d112b2eb55b50a3a4f52a5e2a5364374595efe71`
- Qualified implementation SHA: `bed14c7fbdd1e2671833e8c0f492dfc0f3ff7b42`
- Qualification level: **Level 1 — per-roadmap-step fast qualification**
- Level 2 milestone: **NOT REQUIRED for HZ-GCA-1.18**
- Level 3: **DEFERRED to HZ-GCA-17 phase closeout**

## Canonical definition

HZ-GCA-1.18 consolidates HZ-GCA-1.1 through HZ-GCA-1.17 into one human-readable normative architecture entry point plus one machine-readable source-of-truth index.

It preserves subordinate qualified semantics and does not reinterpret field-level policy.

## Implementation completed

Added:

- `docs/architecture/420hz/HZ-GCA-1-ARCHITECTURE.md`
- `docs/architecture/420hz/index.md`
- `hz/config/gca-architecture-consolidation-v1.json`
- `scripts/verify-420hz-gca-1-18.py`

Updated:

- `docs/420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md`
- `docs/architecture/index.md`
- `.github/workflows/420hz-gca.yml`

## Requirements satisfied

### Complete source-of-truth index

The consolidation manifest indexes exactly:

- HZ-GCA-1.1 through HZ-GCA-1.17;
- each subordinate machine-readable manifest;
- each subordinate normative architecture document;
- qualification level/milestone classification;
- consolidated entry point and architecture index.

The verifier requires the exact ordered package set and rejects missing/duplicate/reordered subordinate work packages.

### Normative architecture entry point

`docs/architecture/420hz/HZ-GCA-1-ARCHITECTURE.md` consolidates:

- authority map;
- authoritative vs derived state;
- canonical object domains;
- Generate lifecycle;
- AI disclosure/provenance;
- Rights/consent;
- privacy;
- storage/retention;
- generation economics;
- Community;
- Charts;
- Awards;
- nomination/voting;
- moderation/disputes;
- threat model;
- API/event/interface contracts;
- failure/recovery.

The master document explicitly states that subordinate manifests remain normative for exact field-level policy.

### Authority ledger

The consolidated authority ledger covers:

- Wallet / Smart Accounts;
- 420Identity;
- 420AI / Compute Market;
- Creative Protocol;
- 420 Rights;
- 420Hz private Generate project state;
- Resource/storage providers;
- canonical generation economics;
- 420Hz Community;
- Charts;
- 420Hz Awards;
- 420Hz moderation;
- optional 420Arbitration;
- Indexer/Search;
- Analytics;
- Notifications;
- Governance.

### Authoritative vs derived state

The consolidation explicitly marks:

**Authoritative source state:**

- Wallet/SmartAccount authorization;
- Identity eligibility source state;
- AI/Compute job/match/verification/settlement state;
- Creative publication IDs/state;
- Rights/license/provenance;
- private Generate workflow state;
- Community source relations;
- Awards product-domain state;
- moderation application-enforcement state;
- storage manifests/integrity state under their owner.

**Derived state:**

- ChartSnapshot;
- Indexer projection;
- Search discovery/ranking;
- Analytics aggregates;
- Notification delivery state.

Derived state cannot authorize protected writes or override authoritative source state.

### Cross-domain separation

The master architecture explicitly preserves:

- AI transformation permission != training permission;
- Generate success != Creative registration/publication;
- raw play != qualified play;
- Community relation != Chart credit;
- Chart rank != Awards eligibility/result;
- AwardVote != Chart/Community/Civic vote;
- moderation != Creative/Rights/Identity/Wallet/payment/governance authority;
- Arbitration ruling != ambient cross-domain execution;
- Notifications/Search/Indexer/Analytics != canonical source authority;
- partial output != verified success/publication/settlement;
- payer refund state != provider earning/payment state.

### Object/lifecycle consolidation

The master document indexes the Generate, Community, Charts and Awards object domains and freezes the Generate lifecycle:

`DRAFT -> QUOTED -> SUBMITTED -> RUNNING -> SUCCEEDED -> REVIEWED -> REGISTERED -> PUBLISHED`

with exact-run terminal FAILED/CANCELLED states.

### Privacy / storage / economics consolidation

The master records:

- PUBLIC / UNLISTED / PRIVATE / SECRET privacy classes;
- private generation inputs/drafts by default;
- storage integrity and tombstone precedence;
- separate quote/funding/accepted price/provider earning/payer refund states;
- no hidden 420Hz surcharge.

### Community / Charts / Awards consolidation

The master preserves the qualified separation between source social relations, derived chart scoring and Awards product-domain voting/results.

### Moderation / security / API / recovery consolidation

The master links application moderation boundaries, bounded Arbitration, the 24-class threat model, logical API/event/interface contracts and canonical-first failure/recovery behavior.

### No unresolved authority duplication

Machine-readable state:

`unresolvedAuthorityDuplication: []`

Human-readable state:

**Unresolved authority duplication: NONE.**

The verifier fails if the machine-readable duplication list becomes non-empty.

## Level-1 qualification

Dedicated workflow:

**420Hz GCA Qualification**

Successful exact-head run:

- Run ID: **37796152239**
- Run number: **#226**
- Job: **HZ-GCA Level 1**
- Job ID: **113376006578**
- Exact tested SHA: `bed14c7fbdd1e2671833e8c0f492dfc0f3ff7b42`
- Result: **PASS**

Successful checks:

1. exact PR-head checkout/verification;
2. all GCA JSON manifest syntax validation;
3. retained HZ-GCA-1.1 through HZ-GCA-1.17 verifiers;
4. HZ-GCA-1.18 architecture-consolidation verifier.

No required check was skipped or cancelled.

## Directly relevant documentation qualification

The same exact implementation SHA also passed:

- **420Docs Qualification #7337**
- **420Hz Web Qualification #140**

The Docs result is useful collateral for the architecture/index changes and confirms the new documentation/index surface did not break the repository documentation qualification.

It does not replace the required HZ-GCA Level-1 exact-head verifier.

## Security / consistency result

Result: **PASS**

The HZ-GCA-1.18 verifier proves:

- all 17 subordinate work packages are present exactly once and in order;
- every indexed document/manifest exists;
- every subordinate manifest remains HZ-GCA-1 / Level 1 / non-milestone;
- authority ledger contains all required domains;
- Charts/Search/Indexer/Analytics/Notifications remain derived where defined;
- canonical source domains are not mislabeled as derived;
- object/lifecycle/disclosure/privacy vocabularies remain aligned;
- required cross-domain separations remain explicit;
- no unresolved authority duplication exists;
- no 420Hz service ID, production URL or deployed address is invented;
- global Architecture index links the 420Hz architecture set.

## Level 2 status

**Not run / not required.**

HZ-GCA-1.18 is an ordinary documentation-consolidation step and does not introduce a runtime shared integration milestone.

The documented HZ-GCA-1 Level-2 milestone remains **HZ-GCA-1.20**.

## Intentionally deferred Level 3

Deferred to HZ-GCA-17:

- canonical full Solidity inventory;
- Genesis/address-authority qualification;
- 420 Integrated/global qualification;
- final Docs/global reconciliation;
- retained 420Hz app suite;
- affected client/service/Indexer/Search/RPC/frontend/backend qualification;
- full adversarial/invariant/security/static-analysis qualification;
- deployment/config verification.

Solidity Contracts remains the canonical owner of the full Foundry inventory. Genesis/address-authority remains separate and must not duplicate that inventory.

## Limitations

HZ-GCA-1.18 intentionally does not implement or claim:

- live generation services;
- runtime provider adapters;
- a canonical 420Hz Registry service ID;
- production endpoints;
- deployed addresses;
- live Awards/Charts/moderation adapters;
- live testnet recovery/security evidence;
- production deployment.

Those remain later canonical work.

## Blockers

None for HZ-GCA-1.18.

## Completion state

**HZ-GCA-1.18 — COMPLETE (Level 1).**

Parent **HZ-GCA-1 remains IN PROGRESS**.

Next canonical work package:

**HZ-GCA-1.19 — Phase-1 adversarial review**
