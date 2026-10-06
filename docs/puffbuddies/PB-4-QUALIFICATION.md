# PB-4 qualification evidence

## Step
**PB-4 — Discovery engine — COMPLETE**

## Qualification level
**Level 1 — ordinary app-scoped roadmap-step fast qualification**

## Qualified implementation SHA
`8db6d94c374513b37d386ab9ca68888d55ad0039`

## Repository relationship
- branch: `puffbuddies-pb4-discovery-20261006`
- PR: #541
- current `main` / PR base: `ba7b9c2067877bf1ec9093f251928089420350b5`
- PB-3 was merged before PB-4 branch creation, so PB-4 is not stacked on an unmerged prior phase
- PR was mergeable when qualification was inspected

## Canonical-definition reconciliation
The current canonical roadmap reserves **PB-4 — Discovery** and **PB-5 — Likes and matching**. The older PB-0.19 planning map combined both under its legacy PB-3 “Discovery and matching” scope. PB-4 carries forward only discovery/recommendation behavior. Likes, passes, reciprocal consent, match formation and stale-rematch semantics remain PB-5. No consent or phase authority is silently moved into PB-4.

## Implementation summary
PB-4 implements a private, policy-bounded discovery engine that composes:
- PB-2 current eligibility/lifecycle/block/generation authority;
- PB-3 profile completeness and field-level visibility;
- private discovery preferences;
- mutual Dating/Buddy/Both compatibility;
- coarse-distance-only proximity input;
- private cannabis compatibility;
- exclusion-before-ranking;
- deterministic non-canonical ranking;
- safe deterministic fallback when ranking is unavailable;
- bounded private discovery results;
- storage-neutral private discovery-preference persistence.

The engine cannot create likes, passes, matches, messaging authorization, notifications, public profiles, public Search/Explorer/Indexer records, or external/public authority.

## Files changed
- `puffbuddies/domain/discovery.py`
- `puffbuddies/tests/test_pb_4_discovery.py`
- `docs/puffbuddies/PB-4-DISCOVERY.md`
- `docs/puffbuddies/PUFFBUDDIES-ROADMAP.md`
- `docs/puffbuddies/PB-0.19-MASTER-IMPLEMENTATION-ROADMAP.md`
- `.github/workflows/puffbuddies-pb4.yml`

## Requirements satisfied
- current viewer/candidate eligibility, lifecycle, block and discovery-generation authority are enforced;
- hard exclusions execute before ranking;
- self-discovery is excluded;
- incomplete profiles are excluded;
- mutual Dating/Buddy/Both compatibility is enforced;
- private discovery preferences are canonical and persist through the existing private preferences table;
- proximity is represented only as a bounded coarse distance band;
- UNKNOWN proximity fails closed;
- precise coordinates/address/GPS history are not accepted or returned;
- private cannabis compatibility may filter candidates without requiring cannabis use;
- candidate-side cannabis preference is also honored;
- missing/private/stale PB-3 visibility policies fail closed;
- discovery returns only currently authorized DISCOVERABLE presentation fields;
- stale derived generation is rejected;
- ranking is deterministic and non-canonical;
- ranking failure degrades only after the same hard exclusions;
- ranking inputs exclude wallet wealth, token/staking/payment state, moderation/report/block counts, raw identity evidence, precise location and hidden sensitive inference;
- result count is bounded;
- results expose no relationship/match/messaging authority;
- optimistic concurrency remains enforced for preference persistence;
- no public-chain/public-wallet/Search/Explorer discovery surface is introduced;
- PB-5 remains owner of likes, passes, reciprocal intent and match formation.

## Exact-SHA Level 1 CI evidence

### PuffBuddies PB-4 Qualification
- run: `37525302396` — **SUCCESS**
- run number: `2`
- job: `112480659864` (`pb4-fast`) — **SUCCESS**
- exact qualification head — PASS
- PuffBuddies compile — PASS
- PB-4 targeted discovery engine — PASS
- complete retained PuffBuddies regression inventory — PASS
- discovery privacy/public-chain negative gate — PASS

### PuffBuddies PB-0 Qualification
Directly applicable because PB-4 reconciles the current phase split against the older PB-0.19 planning map.
- run: `37525302387` — **SUCCESS**
- run number: `343`
- job: `112480660624` (`pb0-fast`) — **SUCCESS**
- frozen PB-0 documentation/invariant checks remain green

### 420Docs Qualification
Directly applicable because canonical roadmap/master documentation was materially reconciled.
- run: `37525302388` — **SUCCESS**
- run number: `6349`
- job: `112480660590` (`qualify`) — **SUCCESS**
- exact-head documentation qualification — PASS
- retained documentation reconciliation — PASS

## Other auto-triggered workflows
PB-1, PB-2, PB-3 and unrelated Oracle workflows were automatically triggered by repository path policies. They are not required PB-4 Level-1 evidence because PB-4's own workflow already runs the complete retained PuffBuddies regression inventory, and PB-4 does not materially change those separate workflow authorities.

## Security / adversarial / invariant results
PASS for:
- self-discovery exclusion;
- current eligibility/lifecycle/block gate;
- stale discovery generation;
- incomplete profile exclusion;
- mode incompatibility;
- coarse-distance exclusion and location non-disclosure;
- unknown proximity fail-closed;
- cannabis preference incompatibility in both directions;
- missing/private/stale visibility;
- ranking-after-filter ordering;
- deterministic safe ranking fallback;
- bounded result enumeration;
- absence of relationship/messaging authority;
- private preference persistence/concurrency;
- absence of wealth/payment/precise-location/moderation-count ranking inputs;
- retained PB-0 privacy, consent, matching and visibility invariants.

## Milestone status
PB-4 does **not** trigger Level 2. The meaningful accumulated discovery/matching integration boundary remains after **PB-5 — Likes and matching** has converged with PB-4.

## Intentionally deferred Level 3
Canonical full Solidity inventory, Genesis/address-authority qualification, 420 Integrated/Geth/fault/soak, unrelated app audits, deployment/config qualification and repository-wide phase-closeout reconciliation remain deferred. PB-4 changes no contract/address/deployment state requiring them now.

## Limitations
PB-4 intentionally does not implement:
- likes or passes;
- reciprocal match formation;
- stale-rematch relationship transitions;
- messaging or notifications;
- production recommendation/ML service;
- feature store;
- public Search/Explorer/Indexer discovery;
- production API/database topology;
- web/mobile UI;
- testnet/mainnet deployment.

## Blockers
**None for PB-4.**

## Completion state
**COMPLETE** against exact Level-1 implementation SHA `8db6d94c374513b37d386ab9ca68888d55ad0039`.

## Evidence inheritance
This qualification document and roadmap COMPLETE marker are evidence-only bookkeeping after the exact implementation SHA passed every required PB-4 Level-1 check. They change no executable source, tests, workflows, dependencies, configuration, generated/runtime artifacts, interfaces, deployment state or substantive requirements and therefore do not require recursive qualification.

## Next canonical roadmap step
**PB-5 — Likes and matching**
