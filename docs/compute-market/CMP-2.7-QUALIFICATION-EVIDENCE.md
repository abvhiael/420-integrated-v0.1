# CMP-2.7 — Qualification evidence

Status: **COMPLETE — Level 1 + Level 2 exact-head qualified.**

## Scope

Canonical roadmap step: **CMP-2.7 — Market adversarial qualification**

Canonical purpose: **Attack matching/pricing/capacity behavior for replay, stale offers, race conditions, overbooking, manipulation, authorization failures and economic abuse.**

Qualification level: **Level 1 + Level 2 app-integration milestone**

Qualified implementation SHA: `c20d14a06c0787ac76f58b925d94b1625969105b`

Branch: `cmp-2.1-worker-offers-20261002`

PR: **#490**

Current `main` observed at documentation closeout: `834fcdd58bbe597716657bf69d3f302897f7227f`

The PR is no longer mergeable at this documentation closeout because `main` advanced after the qualified implementation SHA. That does not invalidate CMP-2.7 exact-head qualification; reconciliation belongs to CMP-2.8 Level 3 phase closeout.

## Implementation summary

CMP-2.7 adversarially qualifies the accumulated CMP-2 marketplace without changing production contracts.

The campaign retains the previously-qualified CMP-2.1–CMP-2.6 authority and compatibility boundaries and adds explicit hostile sequencing for:

- outsider acceptance attempts followed by legitimate owner recovery;
- resurrection attempts against a cancelled request using an already-created proposal;
- provider settlement-account/beneficiary drift after accepted market economics are frozen;
- metered-price multiplication overflow with no proposal allocation;
- stale request, offer and resource revisions;
- competing/replacement scheduler races and scheduler non-authority;
- duplicate acceptance/double-match attempts;
- request authorization replay and malformed terms;
- offer authorization/scope failures;
- fixed and variable price overbid/bounds/rounding failures;
- capacity exhaustion/overbooking with no partial assignment or stranded reservation.

## Files changed in implementation

- `contracts/test/ComputeMatchingEngine420.t.sol`
- `contracts/config/compute-market/cmp-2.7-market-adversarial.json`
- `docs/compute-market/CMP-2.7-MARKET-ADVERSARIAL-QUALIFICATION.md`
- `scripts/verify-cmp-2-7-market-adversarial.py`
- `docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md`
- `.github/workflows/compute-market.yml`

## Requirements satisfied

- replay and authorization abuse fail closed;
- stale offers/requests/resources cannot be accepted through stale proposals;
- terminal request state cannot be resurrected;
- competing schedulers cannot double-accept or rewrite the winner;
- scheduler identity grants no acceptance, capacity, custody, settlement or canonical-term authority;
- pricing overbid, malformed bounds, rounding edge cases and multiplication overflow fail closed;
- accepted provider/resource/beneficiary snapshots resist later registry drift;
- capacity exhaustion cannot overbook or leave partial assignment/reservation state;
- hostile rejection paths preserve canonical state and failure atomicity.

## Level 1 exact-head qualification

### Compute Market Qualification #202

Run ID: `37177056717`

Job: `fast-qualification` — job ID `111361804776`

Result: **SUCCESS**

Retained Compute Market Solidity suite:

- 70 suites
- 470 tests passed
- 0 failed
- 0 skipped

Mechanical verification:

- CMP-2.7 market adversarial qualification: **PASS**

Affected SDK:

- TypeScript build: **PASS**
- 24 tests passed
- 0 failed

### Solidity Contracts #4641

Run ID: `37177056715`

Classification job: `111361805106` — **SUCCESS**

Compute-fast job: `111362665371` — **SUCCESS**

Retained Compute Market Solidity suite:

- 70 suites
- 470 tests passed
- 0 failed
- 0 skipped

Repository-wide `foundry` and `pr-shards` jobs were skipped as intended; CMP-2.7 is an app-scoped Level 2 integration milestone, not the Level 3 repository-wide phase closeout.

## Level 2 milestone

CMP-2.7 is the **CMP-2 accumulated market adversarial integration** milestone.

The retained full Compute Market app suite passed on the same exact implementation SHA as Level 1. Therefore Level 2 is **PASS**.

## Security / adversarial / invariant results

The qualified campaign demonstrates:

- unauthorized actors cannot accept proposals;
- failed unauthorized acceptance leaves the proposal usable by the legitimate owner;
- cancelled requests cannot be resurrected through existing proposals;
- stale request/offer/resource revisions fail closed;
- later provider beneficiary changes cannot rewrite an already accepted match;
- provider drift prevents new matching through a stale offer;
- metered-price multiplication overflow fails before proposal allocation;
- over-budget/malformed pricing fails atomically;
- scheduler replacement and requester self-proposal preserve non-authority;
- competing schedulers cannot create a second accepted match;
- capacity exhaustion leaves the job, reservation and live-capacity state unmodified.

## Milestone status

- Level 1: **PASS**
- CMP-2 Level 2 adversarial integration milestone: **PASS**
- Level 3: **intentionally deferred to CMP-2.8 — Phase closeout**

## Intentionally deferred

CMP-2.8 owns:

- reconciliation of the accumulated CMP-2 graph against then-current `main`;
- one exact merge-candidate implementation SHA;
- canonical full repository Solidity qualification;
- Genesis/address-authority qualification without duplicating full Foundry;
- 420 Integrated/global qualification where applicable;
- Docs/global reconciliation;
- retained Compute app qualification and affected clients/services;
- security/static/deployment/config/build/lint/type qualification;
- final roadmap/evidence reconciliation and CMP-3 handoff readiness.

Live/testnet funded-chain behavior remains owned by later canonical public-testnet phases and is not a CMP-2.7 completion blocker.

## Limitations / blockers

No CMP-2.7 implementation or qualification blockers remain.

At documentation closeout, `main` had advanced to `834fcdd58bbe597716657bf69d3f302897f7227f`, making PR #490 non-mergeable until CMP-2.8 reconciliation. That is a **CMP-2.8 reconciliation condition**, not a failure of CMP-2.7.

## Completion

**CMP-2.7 COMPLETE.**

Next canonical roadmap step: **CMP-2.8 — Phase closeout**.
