# CMP-2.5 — Qualification evidence

Status: **COMPLETE — Level 1 exact-head qualified.**

## Scope

Canonical roadmap step: **CMP-2.5 — Capacity-aware assignment**

Canonical requirement: **Consume CMP-1.3 capacity reservations atomically.**

Qualification level: **Level 1**. No new Level 2 milestone is required for CMP-2.5; Level 3 remains deferred to CMP-2.8 phase closeout.

## Exact implementation SHA

`61e40c8928138bd3b6676df0dfbe46dac4dc9e0b`

Branch: `cmp-2.1-worker-offers-20261002`

PR: **#490**

Main observed at closeout: `1b9330871f7e9d0e79014955a61599baf70134fa`

## Qualification runs

### Compute Market Qualification #198

Run ID: `37173532429`

Job: `fast-qualification` — job ID `111351281315`

Result: **SUCCESS**

Exact-head checkout was explicitly verified against `61e40c8928138bd3b6676df0dfbe46dac4dc9e0b`.

Retained Compute Market Solidity suite:

- 70 suites
- 463 tests passed
- 0 failed
- 0 skipped
- CMP-2.5 targeted tests included and passed

Mechanical verification:

- CMP-2.3 verifier: PASS
- CMP-2.4 verifier: PASS
- CMP-2.5 verifier: PASS

SDK qualification:

- 24 tests passed
- 0 failed
- TypeScript build passed

### Solidity Contracts #4591

Run ID: `37173532457`

Classification job: `111351281404` — **SUCCESS**

Compute-fast job: `111351305550` — **SUCCESS**

Retained Compute Market Solidity suite:

- 70 suites
- 463 tests passed
- 0 failed
- 0 skipped

Full Foundry and PR-shard jobs were skipped as intended for this Level 1 app-scoped qualification.

## CMP-2.5 exit criteria

- accepted CMP-2 market matches can be linked into the canonical JobRegistry flow;
- CMP-2 request evidence is exposed through an exact JobRegistry-compatible read-only proof;
- WorkerSnapshot remains the sole controller of CMP-1.3 capacity reservations;
- worker assignment consumes capacity through the existing atomic reserve -> assignment transaction boundary;
- capacity exhaustion reverts without leaving partial assignment or stranded reservation state;
- direct scheduler capacity mutation is rejected;
- stale resource revision / eligibility drift blocks assignment before capacity mutation;
- schedulers remain proposal-only and do not gain custody, reservation, or assignment authority;
- exact-head retained regressions, CMP verifiers, and SDK tests pass.

## Qualification disposition

**CMP-2.5 COMPLETE.**

No Level 2 run is required for this ordinary roadmap step. Full phase-level Level 3 reconciliation and qualification remain deferred to **CMP-2.8 — Phase closeout**.

Next canonical roadmap step: **CMP-2.6 — Scheduler redundancy and non-authority**.
