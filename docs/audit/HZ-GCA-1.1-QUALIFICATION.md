# HZ-GCA-1.1 — Product boundaries qualification evidence

Status: **COMPLETE — Level 1**

Canonical parent step: **HZ-GCA-1 — Scope, threat model and authority map**

Work package: **HZ-GCA-1.1 — Define product boundaries**

## Qualification identity

- Repository: `abvhiael/420-integrated-v0.1`
- PR: **#565 — Add 420Hz Generate, Community & Awards roadmap phase**
- Audit/implementation branch: `feature/420hz-generate-community-awards-roadmap`
- Current `main` / base SHA: `537525ebc636eabc76ff261f5b5ff5d236869b32`
- Qualified implementation SHA: `2ec1af79f6b8f2fc64b39883ec0598c863b630f3`
- Qualification level: **Level 1 — per-roadmap-step fast qualification**
- Level 2 milestone: **NOT REQUIRED for HZ-GCA-1.1**
- Level 3: **DEFERRED to HZ-GCA-17 phase closeout**

## Canonical definition reconciliation

At the baseline, the repository had canonical top-level **HZ-GCA-1** but did not yet contain the previously discussed HZ-GCA-1.x implementation decomposition. This change formalized HZ-GCA-1.1 through HZ-GCA-1.20 as subordinate work packages while explicitly preserving the canonical top-level HZ-GCA-1 requirements and exit criteria.

HZ-GCA-1.1 requires:

- one explicit product/authority boundary for each integrated system;
- a normative trust/authority map;
- a machine-readable boundary manifest;
- direct authoritative-vs-derived state classification;
- no-escalation invariants;
- a targeted exact-head Level-1 verifier;
- no false live/testnet/deployment claims.

## Implementation completed

Added:

- `docs/architecture/420hz/HZ-GCA-1.1-PRODUCT-BOUNDARIES.md`
- `hz/config/gca-product-boundaries-v1.json`
- `scripts/verify-420hz-gca-1-1.py`
- `.github/workflows/420hz-gca.yml`

Updated:

- `docs/420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md`

The authority map explicitly reconciles:

- 420 Wallet / SmartAccount
- 420Identity
- 420AI
- 420 ComputeMarket
- 420 Creative Protocol
- 420Pay
- 420ResourceProtocol / 420Store
- 420Indexer
- 420Search
- 420Notifications
- 420Commons
- 420Governance / Civic
- 420Arbitration
- 420Registry / ProtocolRegistry

## Requirements satisfied

### Product authority

420Hz is frozen as the user-facing music product/application layer. It may own replaceable product orchestration, private draft/project metadata, explicit review/publish intent, 420Hz-specific social records, and later Awards-domain records only within their explicitly defined product boundary.

420Hz may not absorb or duplicate:

- signing/spending/account execution authority;
- Identity credential authority;
- AI model/request/result authority;
- compute execution/economic authority;
- Work/Recording/rights/license/royalty authority;
- payment/refund authority;
- storage proof/settlement authority;
- chain/indexer/search canonical truth;
- governance execution authority;
- arbitration remedy authority;
- Commons space/channel membership authority;
- Registry publication/discovery authority.

### Authoritative vs derived state

The manifest and architecture document explicitly classify canonical protocol state separately from:

- web rendering;
- cached project/read models;
- Indexer projections;
- Search rankings;
- charts/trending;
- Notifications delivery state;
- analytics;
- projected award presentation/badges.

### No-escalation invariants

The manifest freezes **HZGCA-BND-001 through HZGCA-BND-014**, covering:

- wallet-connection non-authority;
- Generate intent vs AI request authority;
- AI result vs Compute settlement authority;
- generation vs Creative rights/publication;
- transformation vs training permission;
- Pay/Compute settlement integrity;
- private prompt/draft exclusion from public indexing;
- non-authoritative projections;
- Notifications non-execution;
- Commons community authority;
- Governance non-fabrication;
- Arbitration bounded remedy consumption;
- Registry discovery non-authorization;
- product Awards voting vs Civic governance separation.

## Level-1 qualification

Dedicated workflow:

**420Hz GCA Qualification**

Successful run:

- Run ID: **37720825735**
- Run number: **#4**
- Job: **HZ-GCA Level 1**
- Job ID: **113127799728**
- Exact tested SHA: `2ec1af79f6b8f2fc64b39883ec0598c863b630f3`
- Result: **PASS**

Checks:

1. exact pull-request HEAD checkout validation;
2. JSON syntax validation for `hz/config/gca-product-boundaries-v1.json`;
3. required-system boundary inventory;
4. unique system IDs;
5. explicit authority / 420Hz role / forbidden-authority text for each system;
6. HZGCA-BND-001..014 numbering/completeness;
7. authoritative/derived classification non-overlap;
8. required non-authority coverage;
9. retained source-document existence;
10. normative boundary tokens;
11. roadmap parent-step preservation;
12. Level-1 / non-milestone classification.

### Diagnosed failed attempt

The first exact-head run on `dcb82c7925b73ef4c51c33d0a4f39eb9dada7f01` failed only because the verifier expected the phrase `does not replace` while the roadmap correctly used plural grammar `do not replace`.

Classification: **test-harness wording defect**, not an architecture or protocol failure.

Repair:

- updated only the verifier phrase match;
- no assertions were removed;
- no boundary semantics were weakened;
- the repaired SHA was requalified exactly and passed.

## Security / adversarial result

For this documentation/architecture-only step, the applicable security requirement is prevention of authority escalation or duplication.

Result: **PASS**

The machine-readable boundary checks explicitly fail if required systems disappear, required non-authorities are removed, invariant numbering drifts, authoritative/derived classifications collapse, or the roadmap decomposition stops preserving canonical HZ-GCA-1.

Full threat-model/adversarial implementation remains correctly assigned to later HZ-GCA-1.15 / HZ-GCA-1.19.

## Level 2 status

**Not run / not required.**

HZ-GCA-1.1 is explicitly an ordinary Level-1 work package and does not introduce executable cross-component behavior requiring the retained milestone integration suite.

The HZ-GCA-1 Level-2 milestone remains assigned to **HZ-GCA-1.20** after the complete architecture/rules package converges.

## Intentionally deferred Level 3

Deferred to HZ-GCA-17:

- canonical full Solidity inventory;
- Genesis/address-authority qualification;
- 420 Integrated/global qualification;
- repository-wide Docs reconciliation;
- full app integration suite;
- broad client/service/Indexer/Search/RPC qualification;
- full adversarial/invariant/static/security qualification;
- deployment/config verification.

None is required to close this ordinary architecture-only Level-1 work package.

## Blockers

None for HZ-GCA-1.1.

Live/testnet/provider readiness is not required and is not claimed.

## Completion state

**HZ-GCA-1.1 — COMPLETE (Level 1).**

Parent **HZ-GCA-1 remains IN PROGRESS**.

Next canonical work package:

**HZ-GCA-1.2 — Define canonical object model**
