# CMP-2.3 Qualification Evidence

## Step

- Step: CMP-2.3 — Replaceable matching engine
- Status: COMPLETE
- Qualification: Level 1 + Level 2
- Qualified implementation SHA: `103791e7c700ccd53607613b7d0cd2b6ab376902`
- PR: #490
- Branch: `cmp-2.1-worker-offers-20261002`
- PR common/base SHA: `c3fbda60247e76f26a7e183069dd6782ed0da038`
- Current `main` observed at closeout: `b58b09a17e641a42b81d832bad913a83c7caada9`

CMP-2.3 is the first CMP-2 offers/requests/matching convergence milestone, so it is qualified at Level 1 and Level 2. Level 3 remains reserved for CMP-2.8 phase closeout.

## Implemented surface

The qualified head introduces the authoritative `ComputeMatch420` matching contract, focused matching tests, frozen CMP-2.3 configuration, design documentation, a mechanical verifier, retained workflow coverage, and roadmap integration.

Schedulers may propose compatible request/offer pairs without receiving execution or acceptance authority. Acceptance remains contract-authoritative and request-owner controlled. Proposal acceptance revalidates exact request/offer revisions, commitments, effectiveness, compatibility, and the at-most-one accepted match invariant. Accepted matches freeze reconstructable immutable request/offer identity and economic snapshots.

CMP-2.4 pricing expansion, CMP-2.5 atomic capacity reservation/consumption, CMP-2.6 scheduler service redundancy policy, CMP-2.7 full adversarial market qualification, and CMP-2.8 Level 3 closeout remain deliberately deferred.

## Exact-head qualification

### Compute Market Qualification #182

- Run ID: `37087520276`
- Job: `fast-qualification` / `111100774053`
- Result: SUCCESS
- Exact-head checkout: SUCCESS
- Exact-head verification: SUCCESS
- Compute Market build: SUCCESS
- Retained Compute Market Solidity suite: SUCCESS
- Result: **454 passed, 0 failed, 0 skipped across 69 suites**
- CMP-2.1 verifier: SUCCESS
- CMP-2.2 verifier: SUCCESS
- CMP-2.3 verifier: **PASS**
- Affected `@420/sdk` Compute build/test: SUCCESS

### Solidity Contracts #4407

- Run ID: `37087520333`
- Classifier job: `111100774276` — SUCCESS
- `compute-fast` job: `111100792662` — SUCCESS
- Exact-head checkout: SUCCESS
- Exact-head verification: SUCCESS
- Compute Market build: SUCCESS
- Retained Compute Market Solidity suite: SUCCESS
- Full `foundry` inventory: SKIPPED by intended compute-only classification
- PR shards: SKIPPED by intended compute-only classification

No Level 3 full-repository qualification was launched for CMP-2.3.

## Exit-criterion reconciliation

| Exit criterion | Evidence | Status |
| --- | --- | --- |
| two independent schedulers can propose the same eligible pair without gaining authority | focused `ComputeMatchingEngine420Test` coverage + retained suite green | PASS |
| contract revalidates all implemented request/offer compatibility constraints | `ComputeMatch420.proposalEligible` / acceptance revalidation + mechanical verifier | PASS |
| stale request or offer revision invalidates a proposal | focused request-revision and offer-revision tests | PASS |
| resource/offer drift invalidates a proposal | focused resource-drift test | PASS |
| only the request owner can accept in CMP-2.3 | focused scheduler/non-owner rejection coverage | PASS |
| a request can be accepted at most once | focused competing-proposal acceptance test | PASS |
| accepted match freezes reconstructable request/offer commitments and identities | immutable accepted snapshot assertions | PASS |
| failed proposal/acceptance is atomic | focused incompatible-price and failed-acceptance atomicity coverage | PASS |
| retained offers/requests/matching integration passes at Level 2 | Compute Market #182 and Solidity #4407 compute-fast both green on exact head | PASS |

All original frozen CMP-2.3 exit criteria are satisfied on the qualified implementation SHA.

## Qualification incident resolved before final pass

The prior implementation head `7478896fd5c0ea42638c1cd245d5a47a24009ee7` failed both retained suites solely because the new test fixture consumed `vm.prank(OPERATOR)` on a preceding external constant getter before calling `resources.register(...)`. The registry correctly reverted `UnauthorizedOperator()`. The fixture was corrected without weakening authorization or matching semantics, producing the final qualified implementation head `103791e7c700ccd53607613b7d0cd2b6ab376902`.

## Deferred work

- CMP-2.4 — Pricing model
- CMP-2.5 — Capacity-aware assignment
- CMP-2.6 — Scheduler redundancy and non-authority
- CMP-2.7 — Market adversarial qualification
- CMP-2.8 — Phase closeout / Level 3

## Conclusion

CMP-2.3 is **COMPLETE** at Level 1 + Level 2 against exact implementation SHA `103791e7c700ccd53607613b7d0cd2b6ab376902`.

The next canonical roadmap step is **CMP-2.4 — Pricing model**.
