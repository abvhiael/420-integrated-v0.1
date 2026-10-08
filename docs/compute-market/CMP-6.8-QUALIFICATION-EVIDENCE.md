# CMP-6.8 — Qualification evidence

Status: **COMPLETE — Level 3 exact-head qualified.**

## Step

- roadmap step: **CMP-6.8 — Phase closeout**
- qualification level: **Level 3 — complete app-phase closeout**
- implementation SHA: `ba4b412d376a65d3ddbd2b1c16f471def100ada4`
- evidence commit: this evidence-only closeout commit
- PR: **#560 — CMP-6: useful-computation rewards (6.1–6.8 phase closeout)**
- branch: `cmp-6.1-funding-sources-20261007`
- reconciliation base/current main: `537525ebc636eabc76ff261f5b5ff5d236869b32`
- branch disposition at qualification: **0 commits behind current main**
- reconciled anchor: `d39f62e1a5e0ac5b646d851abe9d0a17fbf1450d`

## Implementation summary

CMP-6.8 closes the accumulated CMP-6.1–CMP-6.7 useful-computation reward phase after reconciliation with current `main`. The phase retains separately funded useful-computation jobs/pools, canonical verification-gated reward eligibility, contribution accounting, research reward pools, sponsor matching, anti-Sybil/anti-farming controls, and deterministic transparent reward accounting.

The closeout adds no new consensus issuance authority. CMP-6 rewards remain application-layer incentives; transparent reward accounting remains accounting-only and does not silently create Vault payout authority.

## Canonical Level 3 evidence

All required gates below qualified the exact same implementation SHA `ba4b412d376a65d3ddbd2b1c16f471def100ada4`.

| Owner | Run | Job(s) | Result |
| --- | --- | --- | --- |
| Solidity Contracts | #5496 / `37720627984` | classifier `113127195212`; shards 0–3: `113127242625`, `113127242582`, `113127242586`, `113127242561` | **SUCCESS** |
| Genesis Address Authority | #2530 / `37720627952` | cross-manifest-authority `113127195191` | **SUCCESS** |
| 420 Integrated Qualification | #6582 / `37720627763` | fault-matrix `113127194997`; offline-core `113127195083`; geth-engine `113127195240`; production-dependencies `113127195596` | **SUCCESS** |
| 420Docs Qualification | #7064 / `37720627842` | qualify `113127194955` | **SUCCESS** |
| Compute Market Qualification | #561 / `37720627838` | fast-qualification `113127194663` | **SUCCESS** |
| 420 Genesis Contract Hardening | #1757 / `37720627873` | hardening `113127356503` | **SUCCESS** |

Supporting exact-head workflows also passed:

- 420Oracle audit qualification #2397;
- Compute Worker Fast Qualification #538;
- 420Indexer #2640;
- 420Registry REG-AUDIT-4 #2303;
- EXP-1.9 CI Qualification Automation #319;
- EXP-1.10 Phase Closeout Qualification #325.

## Solidity / Genesis ownership

Solidity Contracts correctly selected the canonical four balanced PR shards and ran the repository Foundry inventory once. All four shards passed. The monolithic `foundry` job and Compute-only fast shortcut were skipped intentionally because the Level-3 shard owner provided the required full inventory.

Genesis Address Authority passed independently for canonical address, namespace, collision, predeploy, frozen-manifest and manifest-authority coverage without duplicating the full Foundry inventory.

## Compute Market qualification

Compute Market Qualification #561 passed on the exact implementation SHA after the CMP-6.8 verifier syntax repairs.

The retained Compute Market Solidity suite reported:

- **93 test suites**
- **633 tests passed**
- **0 failed**
- **0 skipped**

The same workflow compiled the CMP verification scripts and completed the retained CMP-1.4, CMP-1.5, CMP-2, CMP-4, CMP-5 and CMP-6 verifier chain, including the CMP-6.8 phase-closeout verifier.

## Security / adversarial / invariant disposition

The exact-head Level-3 candidate passed:

- canonical repository Solidity inventory;
- retained Compute Market authorization, replay, accounting and failure-path coverage;
- Genesis address/namespace/predeploy/frozen-manifest authority checks;
- global runtime/build/Geth/fault qualification;
- production contract size checks;
- invariant campaigns;
- Slither high-severity static-analysis gate;
- phase-closeout config/verifier consistency.

No assertion was weakened, no authorization was broadened, and no safety gate was bypassed to obtain qualification.

## Client / service disposition

CMP-6 introduced no direct implementation changes to the future CMP-7/CMP-8 client surfaces:

- `@420/compute-sdk` remains CMP-7.1;
- job/worker/verifier/research APIs remain CMP-7.2–CMP-7.5;
- Compute indexer feature work remains CMP-7.6;
- CLI remains CMP-7.9;
- human-facing 420Compute remains CMP-8.

Those future implementation suites are not repository blockers for CMP-6.8. Existing supporting Indexer and worker workflows that triggered on the exact head passed.

## Deployment / configuration verification and limitations

Repository deployment/config/static qualification is green. CMP-6.8 is a repository closeout and does not claim live/testnet reward execution.

Intentionally deferred operational evidence:

- deployment/publication of CMP-6 components;
- funded end-to-end payout using canonical Vault settlement authority;
- sponsor/research onboarding;
- real workload demonstrations and live economic telemetry;
- SDK/API/CLI/indexer integration in CMP-7;
- human-facing participation/earnings experience in CMP-8;
- public testnet operational qualification in CMP-9.

These deferred external/live items are not repository blockers for CMP-6.8.

## Exit criteria

- CMP-6.1–CMP-6.7 durable prerequisite evidence: **PASS**
- reconciliation with current main: **PASS**
- exact implementation SHA established: **PASS**
- canonical full Solidity inventory once, four balanced shards: **PASS**
- Genesis/address authority without duplicate Foundry: **PASS**
- 420 Integrated/global qualification: **PASS**
- global Docs qualification: **PASS**
- retained Compute Market suite and CMP-6.8 verifier: **PASS**
- contract hardening/static/invariant coverage: **PASS**
- supporting affected workflows: **PASS**
- durable repository evidence recorded: **PASS**
- remaining repository blockers: **NONE**

## Completion

**CMP-6.8 is COMPLETE.**

The complete CMP-6 useful-computation rewards phase is repository-qualified through its Level-3 exact-head closeout.

Next canonical phase:

**CMP-7 — SDK, API, CLI and indexer**

No merge is authorized or performed by this evidence closeout.
