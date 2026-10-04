# CMP-2.6 — Qualification evidence

Status: **COMPLETE — Level 1 exact-head qualified.**

## Scope

Canonical roadmap step: **CMP-2.6 — Scheduler redundancy and non-authority**

Qualification level: **Level 1**

Implementation SHA: `ed0e1ec81ff3888db60e53ef511b66b7cf8c32ad`

Branch: `cmp-2.1-worker-offers-20261002`

PR: **#490**

Main observed at durable closeout: `1b9330871f7e9d0e79014955a61599baf70134fa`

## Implementation summary

CMP-2.6 preserves the CMP-2.3 proposal-only scheduler model and adds explicit executable qualification for scheduler replacement and non-authority:

- replacement scheduler can submit a fresh proposal after an older scheduler proposal becomes stale;
- replacement scheduler cannot accept the match;
- requester can self-propose through the same permissionless proposal surface when external schedulers are unavailable;
- competing schedulers preserve the same canonical request/offer commitments and quote for the same pair;
- once one proposal is accepted, a losing scheduler cannot rewrite or double-accept the winner;
- CMP-2.5 capacity-controller protections remain retained: a scheduler cannot link the accepted market match into the canonical job or reserve capacity directly;
- no scheduler registry, allowlist, custody role, settlement privilege, or hidden protocol authority was introduced.

## Files changed in implementation

- `contracts/test/ComputeMatchingEngine420.t.sol`
- `contracts/config/compute-market/cmp-2.6-scheduler-redundancy.json`
- `docs/compute-market/CMP-2.6-SCHEDULER-REDUNDANCY.md`
- `scripts/verify-cmp-2-6-scheduler-redundancy.py`
- `docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md`
- `.github/workflows/compute-market.yml`

## Exact-head qualification

### Compute Market Qualification #200

Run ID: `37175507309`

Job: `fast-qualification` — job ID `111357206071`

Result: **SUCCESS**

Retained Compute Market Solidity suite:

- 70 suites
- 466 tests passed
- 0 failed
- 0 skipped

Mechanical verification:

- CMP-2.5 verifier: PASS
- CMP-2.6 verifier: PASS

Affected SDK qualification:

- TypeScript build passed
- 24 tests passed
- 0 failed

### Solidity Contracts #4615

Run ID: `37175507242`

Classification job: `111357205033` — **SUCCESS**

Compute-fast job: `111357261320` — **SUCCESS**

Retained Compute Market Solidity suite:

- 70 suites
- 466 tests passed
- 0 failed
- 0 skipped

Full Foundry and PR-shard jobs were skipped as intended for this Level 1 app-scoped step.

## Security / adversarial results

- stale scheduler proposal fails closed after offer revision;
- replacement scheduler receives no acceptance authority;
- requester self-proposal requires no privileged scheduler service;
- competing scheduler proposals cannot alter canonical request/offer commitments or accepted quote;
- losing scheduler cannot create a second accepted match or rewrite the winner;
- existing scheduler rejection at the CMP-2.5 job/capacity boundary remains retained;
- no new authorization, custody, settlement, verification, or capacity authority is granted to scheduler identity.

## Milestone / deferred qualification

No new Level 2 milestone is required for this ordinary hardening step. The offers/requests/matching convergence milestone was already qualified at CMP-2.3.

Intentionally deferred to CMP-2.8 Level 3 phase closeout:

- reconciliation with then-current `main`;
- canonical full Solidity repository inventory;
- Genesis/address-authority qualification;
- 420 Integrated/global qualification;
- Docs/global reconciliation;
- complete phase-level security/static/deployment/config/client/service qualification.

## Exit-criterion disposition

All CMP-2.6 exit criteria are satisfied:

- scheduler replacement is executable and fail-closed;
- external scheduler outage does not block protocol matching because requester self-proposal remains available;
- scheduler identity has proposal-only authority;
- canonical request/offer constraints remain contract-enforced;
- one accepted match per request remains authoritative;
- capacity and job assignment authority remain outside scheduler control;
- exact-head Level 1 tests and verifier evidence are green.

## Completion

**CMP-2.6 COMPLETE.**

Next canonical roadmap step: **CMP-2.7 — Market adversarial qualification**.
