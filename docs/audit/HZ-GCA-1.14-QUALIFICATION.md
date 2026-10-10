# HZ-GCA-1.14 — Moderation & dispute boundaries qualification evidence

Status: **COMPLETE — Level 1**

Canonical parent step: **HZ-GCA-1 — Scope, threat model and authority map**

Work package: **HZ-GCA-1.14 — Define moderation & dispute boundaries**

## Qualification identity

- Repository: `abvhiael/420-integrated-v0.1`
- PR: **#565 — Add 420Hz Generate, Community & Awards roadmap phase**
- Branch: `feature/420hz-generate-community-awards-roadmap`
- Current `main` / base SHA: `d112b2eb55b50a3a4f52a5e2a5364374595efe71`
- Qualified implementation SHA: `e1607cdecc8de14e0c9da3e8cae3818c6551558d`
- Qualification level: **Level 1 — per-roadmap-step fast qualification**
- Level 2 milestone: **NOT REQUIRED for HZ-GCA-1.14**
- Level 3: **DEFERRED to HZ-GCA-17 phase closeout**

## Canonical definition

HZ-GCA-1.14 freezes the 420Hz moderation and dispute boundary across Generate, Community and Awards.

The step defines:

- report/evidence/decision/appeal/restoration lifecycle;
- HIDE / LOCK / SUSPEND / BLOCK / MUTE semantics;
- moderator authority and no-escalation rules;
- comments/replies enablement boundary;
- Rights/Creative dispute handling;
- Awards challenge and correction handling;
- vote-abuse review/invalidation boundaries;
- optional explicit 420Arbitration integration;
- bounded ruling consumption and remedy allowlist;
- evidence privacy/retention;
- Search/Notifications non-authority.

## Implementation completed

Added:

- `hz/config/gca-moderation-dispute-v1.json`
- `docs/architecture/420hz/HZ-GCA-1.14-MODERATION-DISPUTE-BOUNDARIES.md`
- `scripts/verify-420hz-gca-1-14.py`

Updated:

- `docs/420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md`
- `.github/workflows/420hz-gca.yml`

## Requirements satisfied

### Moderation vocabulary

Frozen application actions:

- REPORT
- HIDE
- LOCK
- SUSPEND
- BLOCK
- MUTE
- MODERATOR_DECISION
- APPEAL
- RESTORE

Frozen dispute classifications:

- RIGHTS_DISPUTE
- AWARD_CHALLENGE
- VOTE_ABUSE_CHALLENGE
- ARBITRATION_REFERENCE

### Report and evidence lifecycle

Reports are allegation/intake only and do not become canonical findings by themselves.

Evidence remains commitment-oriented and may stay encrypted/access-controlled off-chain.

Evidence commitments never authorize disclosure.

Appeal/dispute retention is scoped and follows HZ-GCA-1.8 rather than creating indefinite evidence retention.

### Application enforcement

HIDE, LOCK and SUSPEND alter only application visibility/interactivity/participation inside exact scope.

BLOCK and MUTE are user/application relationship controls.

They cannot fabricate:

- Rights/Creative mutations;
- Identity changes;
- Wallet authority changes;
- payment/custody changes;
- Governance effects;
- unrelated follow/favorite/membership state.

RESTORE preserves prior moderation history.

### Moderator / appeal authority

Moderation decisions require explicit scoped moderator capability/role.

Reporter, provider, chart operator, target owner or ordinary user cannot self-promote to moderator.

Appeal is append-only and cannot overwrite prior report/decision history.

Only affected or otherwise policy-authorized parties may appeal.

### Comments/replies boundary

Comments/replies remain disabled until the surface has qualified:

- reporting;
- block/mute;
- hide/lock;
- appeal;
- stable actor/target binding;
- replay protection;
- visibility rules.

### Rights disputes

A Rights/provenance complaint may temporarily hide/lock or place publication into review.

420Hz cannot choose a legal winner or rewrite Creative/Rights state.

Where an Arbitration domain is explicitly adopted, a case may bind the exact originating component/object; a finalized ruling still cannot directly rewrite Rights.

### Awards challenges

Challenge types cover:

- eligibility;
- nomination;
- ballot integrity;
- vote abuse;
- result correction.

Moderation cannot hand-edit tally totals, valid vote choices, winners or finalized result bytes.

Post-finalization correction uses explicit superseding result/history rather than in-place mutation.

### Vote abuse

Replay/Sybil/manipulation evidence may flag/quarantine/challenge an input.

Vote invalidation requires objective ballot/policy-bound reason/evidence and durable history.

Rate/anomaly scores are evidence inputs, not automatic canonical findings unless a frozen policy explicitly defines an objective threshold.

Corrections retally deterministically from accepted/invalidated canonical vote state.

### 420Arbitration integration

Arbitration adoption is **OPTIONAL_EXPLICIT_ONLY**.

An ordinary moderation/report/appeal/challenge never auto-opens Arbitration.

If adopted, integration must use:

- canonical `420/service/arbitration/v1`;
- registered dispute domain;
- exact origin component/object;
- snapshotted Arbitration policy;
- exact parties where relevant;
- explicit 420Hz remedy-consumption path.

Case opening is not a ruling.

A finalized ruling remains a bounded input.

Before consumption, 420Hz must validate domain/origin/parties/finality/ruling/remedy/replay.

### Arbitration remedy allowlist

Frozen architecture-level allowed dispositions:

- NO_ACTION
- RESTORE_APPLICATION_VISIBILITY
- MAINTAIN_APPLICATION_ENFORCEMENT
- MARK_AWARDS_CHALLENGE_UPHELD
- MARK_AWARDS_CHALLENGE_REJECTED
- REQUEST_EXPLICIT_AWARDS_CORRECTION_PATH

No deployed remedy executor is claimed.

Forbidden ambient remedies include direct:

- payment/refund;
- Rights mutation;
- Wallet capability mutation;
- Identity credential mutation;
- Civic/Governance execution;
- provider slashing;
- finalized AwardResult byte mutation.

### Search / Notifications

Search may suppress hidden/ineligible derived presentation but cannot mutate moderation/source truth.

Notifications are delivery only.

Delivery failure never rolls back moderation or Arbitration state, and deep links cannot bypass authorization.

## Moderation/dispute invariants

The manifest freezes **HZGCA-MOD-001 through HZGCA-MOD-018**.

The targeted verifier checks:

- exact moderation/dispute vocabulary;
- external authority ownership;
- report allegation/no-finding semantics;
- evidence privacy/retention;
- enforcement semantics;
- moderator authorization;
- append-only appeal history;
- comments deferral;
- Rights-dispute non-authority;
- Awards challenge no-manual-edit rules;
- vote-abuse evidence/deterministic retally;
- Arbitration optional-explicit adoption;
- exact Arbitration service identity;
- case-opening vs ruling separation;
- exact bounded ruling-consumption checks;
- explicit remedy allowlist and forbidden remedies;
- Search/Notifications non-authority;
- all 18 invariant IDs;
- HZ-GCA-1.10/1.12/1.13 prerequisite consistency;
- roadmap Level-1/non-milestone classification.

## Level-1 qualification

Dedicated workflow:

**420Hz GCA Qualification**

Successful exact-head run:

- Run ID: **37739432213**
- Run number: **#165**
- Job: **HZ-GCA Level 1**
- Job ID: **113186455993**
- Exact tested SHA: `e1607cdecc8de14e0c9da3e8cae3818c6551558d`
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
13. retained HZ-GCA-1.11 verifier;
14. retained HZ-GCA-1.12 verifier;
15. retained HZ-GCA-1.13 verifier;
16. HZ-GCA-1.14 moderation/dispute verifier.

The concurrently triggered **420Hz Web Qualification #107** also passed on the same exact implementation SHA. It is collateral evidence and does not substitute for required GCA Level 1.

## Diagnosed failed attempt

Initial exact-head run:

- SHA: `f432889682b33b58bf759962095aece8d5d0628a`
- Run ID: **37739348761**
- Job ID: **113186198361**
- Result: **FAIL**

Only the new HZ-GCA-1.14 verifier failed; every retained HZ-GCA-1.1 through HZ-GCA-1.13 check passed.

Reported failures:

- `rights dispute boundary missing: fails closed`
- `vote abuse rule missing: not sole canonical authority`
- `Arbitration integration rule missing: Opening an Arbitration case records a dispute and is not a ruling`

Diagnosis: **test-harness wording/case defects**.

The normative manifest already contained all three intended requirements:

- public 420Hz availability **may fail closed** under unresolved source-right policy;
- anomaly/rate scores are **never sole canonical authority** unless explicitly policy-defined;
- **opening** an Arbitration case records a dispute and is not a ruling.

Repair:

- aligned only verifier string matching;
- changed no moderation semantics;
- removed no authority check;
- weakened no evidence/privacy rule;
- changed no Rights/Awards/Arbitration boundary;
- changed no remedy allowlist.

The repaired exact SHA passed.

## Security / adversarial result

Result: **PASS**

The verifier rejects policies that:

- allow unscoped moderator action;
- let moderation rewrite Rights/Identity/Wallet/payment/Governance;
- let BLOCK/MUTE fabricate source social state;
- overwrite appeal history;
- enable comments without moderation support;
- allow operator tally/winner edits;
- invalidate votes without objective evidence/policy binding;
- mutate finalized AwardResult in place;
- auto-invoke Arbitration from ordinary moderation;
- consume a ruling without exact domain/origin/finality/replay validation;
- permit non-allowlisted Arbitration remedies;
- publish private evidence merely because a commitment exists.

## Level 2 status

**Not run / not required.**

HZ-GCA-1.14 is an ordinary architecture/policy substep and does not introduce a new shared executable moderation or Arbitration integration.

The HZ-GCA-1 Level-2 milestone remains **HZ-GCA-1.20**.

## Intentionally deferred Level 3

Deferred to HZ-GCA-17:

- canonical full Solidity inventory;
- Genesis/address-authority qualification;
- 420 Integrated/global qualification;
- Docs/global reconciliation;
- retained 420Hz app suite;
- affected client/service/Indexer/Search/RPC/frontend/backend suites;
- full adversarial/invariant/security/static-analysis qualification;
- deployment/config verification.

Solidity Contracts remains sole owner of the canonical full Foundry inventory. Genesis/address-authority remains separate and must not duplicate that inventory.

## Limitations

HZ-GCA-1.14 intentionally does not implement:

- moderation runtime/API/store;
- moderator role service;
- comments/replies;
- live report/appeal UI;
- an Awards challenge execution engine;
- an Awards correction executor;
- a registered 420Hz Arbitration domain;
- Arbitration case-opening adapter;
- ruling-consumption runtime;
- payment/Rights remedies;
- testnet/production deployment.

Those remain later canonical implementation/testnet work.

## Blockers

None for HZ-GCA-1.14.

## Completion state

**HZ-GCA-1.14 — COMPLETE (Level 1).**

Parent **HZ-GCA-1 remains IN PROGRESS**.

Next canonical work package:

**HZ-GCA-1.15 — Threat model**
