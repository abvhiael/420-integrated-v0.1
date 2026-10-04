# RANDOM-AUDIT-4 qualification evidence

Step: **RANDOM-AUDIT-4 — deployment bundle**  
Status: **COMPLETE**  
Qualification level: **Level 1 — per-roadmap-step fast qualification**

## Repository state

- Repository: `abvhiael/420-integrated-v0.1`
- Audit branch: `audit/420randomness-remediation`
- PR: **#496**
- Current `main` at qualification: `d37d751dfa232b20c8158d55c20c13cc1d7a10ef`
- Exact qualified implementation SHA: `5158e7f5505d51cfa7db0d778de3871dd2525653`
- Branch divergence at qualification: **45 ahead / 27 behind current main**
- Workflow: **420Randomness audit qualification**
- Run: **37101060785**
- Job: **111140517818**

## Canonical requirement satisfied

RANDOM-AUDIT-4 freezes the repository-side deployment bundle for the generalized 420 Random stack without claiming live-chain deployment.

The retained bundle defines the exact sequence:

1. deploy `RandomnessRouteRegistry420(GovernanceTimelock)`;
2. deploy `RandomnessProfileRegistry420(GovernanceTimelock)`;
3. deploy `RandomnessRouter420(RandomnessProfileRegistry420, RandomnessRouteRegistry420, RandomnessRegistry@0x0428)`;
4. register the exact router component in `ProtocolRegistry`;
5. publish the canonical `420/service/randomness/v1` service to the exact same router implementation;
6. after successful Registry publication, execute the one-time governance transaction `RandomnessRegistry@0x0428.bindRouter(RandomnessRouter420)`.

No new frozen router address or CREATE2 authority is invented. The router remains Registry-resolved.

## Files changed

- `contracts/config/randomness/random-audit-4-deployment-bundle.json`
- `contracts/test/RandomnessDeploymentBinding420.t.sol`
- `scripts/verify-random-audit-4-deployment.py`
- `scripts/verify-420randomness-audit.py`
- `.github/workflows/420randomness-audit.yml`

## Frozen authority and identities

- RandomnessRegistry: `0x0000000000000000000000000000000000000428`
- GovernanceTimelock: `0x0000000000000000000000000000000000000429`
- ProtocolRegistry: `0x0000000000000000000000000000000000000434`
- RandomnessRouter420 address policy: `REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS`
- Canonical service ID preimage: `420/service/randomness/v1`
- Router component ID preimage: `420/APP/420RANDOM/RANDOMNESS_ROUTER`
- Router component version: `1.0.0`
- Router component lifecycle: `ACTIVE`
- Service version: `1`
- Service active: `true`
- Component type: `SERVICE`
- RandomnessRegistry runtime code hash inherited from RANDOM-AUDIT-3: `0x0c921ab8b2282ea3ed2d7f64b5ca0f6ecb54c67d52e421a347a1449d43e8345a`

The Registry profile additionally freezes nonzero metadata, manifest and interface commitment preimages plus a dependency-root policy binding the route registry, profile registry, frozen RandomnessRegistry and router addresses/code hashes.

## Local deployment-binding qualification

`RandomnessDeploymentBinding420.t.sol` proves:

- route/profile governance constructor bindings;
- router constructor binding to the exact profile registry, route registry and RandomnessRegistry;
- ProtocolRegistry component registration to the exact router runtime identity;
- canonical randomness service publication to the same router and runtime code hash;
- registration profile commitments and active resolution;
- governance-only `bindRouter`;
- one-time `bindRouter`;
- the ProtocolRegistry-published router and RandomnessRegistry-bound router cannot diverge.

This is repository-local EVM evidence only. It is not live Genesis/testnet evidence.

## Exact-head Level 1 qualification

On exact SHA `5158e7f5505d51cfa7db0d778de3871dd2525653`, workflow run `37101060785`, job `111140517818`:

- exact qualification-head verification: **PASS**
- canonical Randomness inventory / Genesis wiring verifier: **PASS**
- RANDOM-AUDIT-4 deployment-bundle verifier: **PASS**
- full retained Randomness formatting including deployment-binding test: **PASS**
- canonical Randomness graph build: **PASS**
- RANDOM-AUDIT-3 deterministic Genesis materialization regression: **PASS**
- all `Randomness*.t.sol` tests: **PASS**
- forbidden `tx.origin` / `selfdestruct` / `delegatecall` scan: **PASS**

Foundry result:

- `RandomnessAudit420Test`: **5 passed / 0 failed / 0 skipped**
- `RandomnessDraw420Test`: **5 passed / 0 failed / 0 skipped**
- `Randomness420Test`: **10 passed / 0 failed / 0 skipped**
- `RandomnessDeploymentBinding420Test`: **4 passed / 0 failed / 0 skipped**
- total: **24 passed / 0 failed / 0 skipped**

## Superseded failure

Run `37101022650`, job `111140411687`, on SHA `a3959459845ab47d6d64e7d7f6354c3a185c5ce9` failed only the formatter gate for the newly-added deployment-binding test. Both Randomness verifiers passed before that failure. The exact formatter diff was applied without changing deployment semantics, authorization, Registry identities, assertions or safety rules. The resulting exact implementation SHA was then fully requalified.

## Milestone status

RANDOM-AUDIT-4 remains an ordinary Level 1 repository deployment-materialization step.

- Level 2 app integration milestone: **deferred to RANDOM-AUDIT-5**, the canonical production-equivalent testnet qualification boundary where the frozen bundle is actually deployed, published, bound and smoke-tested.
- Level 3 complete app-phase closeout: **deferred** until the complete Randomness audit phase is ready for current-main reconciliation and comprehensive qualification.

## Intentionally deferred live evidence

RANDOM-AUDIT-4 deliberately does not claim:

- testnet chain/genesis identity;
- route/profile/router live addresses;
- deployment transaction hashes;
- ProtocolRegistry publication transaction hashes;
- live `bindRouter` transaction;
- live runtime code-hash verification;
- qualified route/profile population;
- primary/fallback/void live smoke evidence;
- deployed Indexer lifecycle projection.

Those belong to RANDOM-AUDIT-5.

## Exit criteria

- deterministic deployment order frozen: **PASS**
- exact constructor arguments frozen: **PASS**
- frozen RandomnessRegistry `0x0428` dependency preserved: **PASS**
- no invented router fixed address: **PASS**
- exact ProtocolRegistry component registration defined: **PASS**
- canonical randomness service publication defined: **PASS**
- component/service runtime identity agreement tested: **PASS**
- one-time governance `bindRouter` transaction defined after publication: **PASS**
- wrong/rebinding behavior tested fail-closed: **PASS**
- bundle verifier retained and CI-enforced: **PASS**
- exact-head Level 1 build/tests/static qualification passed: **PASS**
- live-only evidence left explicitly empty and deferred: **PASS**
- durable evidence recorded: **PASS**

**RANDOM-AUDIT-4 is COMPLETE.**

Next canonical roadmap step: **RANDOM-AUDIT-5 — production-equivalent testnet qualification.**
