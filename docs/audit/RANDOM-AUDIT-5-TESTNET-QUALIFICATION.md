# RANDOM-AUDIT-5 production-equivalent testnet qualification

Step: **RANDOM-AUDIT-5 — production-equivalent testnet qualification**  
Canonical step status: **ACTIVE — LIVE PUBLIC TESTNET BLOCKED**  
Repository-side harness status: **QUALIFIED**  
Qualification model: **Level 1 retained Randomness + Level 2 app-focused integration milestone**

## Canonical requirement

RANDOM-AUDIT-5 requires the exact RANDOM-AUDIT-4 deployment bundle to be exercised on a production-equivalent testnet:

1. deploy the exact route registry, profile registry and router artifacts;
2. verify live runtime/code and frozen RandomnessRegistry storage/identity;
3. publish the exact Randomness router component and canonical `420/service/randomness/v1` service through ProtocolRegistry;
4. bind `RandomnessRegistry@0x0428` once to that exact published router;
5. configure qualified primary/fallback routes and profile;
6. execute primary, fallback and expiry/void smoke paths plus negative/failure paths;
7. verify the deployed event surface is projected correctly by 420Indexer.

The repository-side harness necessary to perform and retain that qualification is complete. The live exit criteria are not yet executable because the official public testnet is not live/frozen.

## Repository truth for the blocker

At this qualification point:

- `config/protocol.json` declares `step5.public_testnet_live = false` and the launch package as implemented but not authorized;
- `testnet/public/metadata/chain.json` keeps chain ID 420 as `CANDIDATE_UNTIL_FINAL_PREFLIGHT_FREEZE`;
- public RPC, WebSocket, Explorer, Faucet, Status, bootnode, genesis-hash and release-checksum values remain `REPLACE_*` placeholders;
- `testnet/services/endpoints.json` contains placeholder endpoints;
- there is no official `developer-hub/manifests/testnet.json`.

No live deployment, transaction, code-hash, route/profile, smoke-test or Indexer evidence is fabricated to satisfy this step.

## Repository-side implementation completed

### Generalized Randomness Indexer descriptor

Added:

- `420-indexer/descriptors/randomness-v1.json`
- `420-indexer/src/randomness-descriptors.ts`
- `420-indexer/test/randomness420-release-descriptor.test.ts`

The descriptor pins the actual generalized Randomness event surface:

**RandomnessRegistry @ frozen `0x0428`:**
- `RandomnessRouterBound(address)`
- `RandomnessRequested(bytes32,bytes32,uint64)`
- `RandomnessFulfilled(bytes32,bytes32,bytes32,bytes32,uint64)`

**Registry-resolved RandomnessRouter420:**
- `RandomnessRequestCreated(...)`
- `RandomnessFallbackActivated(bytes32,bytes32)`
- `RandomnessRequestVoided(bytes32)`
- `RandomnessResolved(bytes32,bytes32,bytes32,bytes32)`

The descriptor refuses zero router addresses, refuses router/registry address collision, and binds the router event surface only after an explicit deployed router address is supplied.

### Canonical Indexer lifecycle correction

Updated `420-indexer/src/lifecycle-reducer.ts` to recognize the actual generalized router events and to use `requestId` as the canonical 420Randomness object identity before `profileId` or `routeId`.

This prevents one randomness request from being split into multiple derived lifecycle objects.

### Live evidence contract

Added:

- `docs/audit/RANDOM-AUDIT-5-LIVE-EVIDENCE-DRAFT.example.json`
- `scripts/qualify-randomness-testnet.py`
- `scripts/verify-random-audit-5-testnet-readiness.py`
- `.github/workflows/randomness-live-testnet.yml`
- `.github/workflows/randomness-audit-5.yml`

The live verifier requires real non-secret evidence and verifies:

- exact repository SHA;
- official HTTPS RPC;
- chain ID, genesis hash and evidence block/hash;
- live code and runtime-code hashes for RandomnessRegistry, route registry, profile registry and router;
- frozen `RandomnessRegistry@0x0428` runtime identity;
- GovernanceTimelock `0x0429`;
- router constructor bindings;
- live `RandomnessRegistry.randomnessRouter()` binding;
- successful ProtocolRegistry component/service publication receipts;
- component/service active runtime identity agreement;
- qualified route/profile IDs, revisions, operators and verifiers;
- primary success, fallback success and expiry/void transactions;
- required negative/failure-path evidence;
- 420Indexer descriptor, request identity, lifecycle terminal-state and canonical block-provenance agreement.

The readiness verifier fails closed while the public testnet remains non-live/candidate/placeholder. A retained PASS evidence file is itself rejected while the network is not live.

## Exact-SHA qualification

Concurrent unrelated Oracle audit work advanced the primary audit branch during RANDOM-AUDIT-5 qualification. Those changes were executable and therefore could not be treated as evidence-only.

A frozen qualification branch/PR was created solely to establish one exact implementation SHA:

- qualification branch: `audit/420randomness-audit-5-qualification`
- temporary draft PR: **#499 — RANDOM-AUDIT-5 exact-head qualification**
- exact qualified implementation SHA: `c867398cfe640064f09e0fac65f83f4551ab59de`
- qualification base `main`: `d37d751dfa232b20c8158d55c20c13cc1d7a10ef`

The Step-5 implementation blobs on the qualification branch and primary `audit/420randomness-remediation` branch were compared and match for the Randomness descriptor, descriptor binder, lifecycle reducer, descriptor tests, live evidence template, live verifier, readiness verifier, live workflow, Step-5 workflow and retained Randomness verifier/workflow material.

### Level 2 app-integration qualification

Workflow: **420Randomness RANDOM-AUDIT-5**  
Run: **37102627093**  
Job: **111145006199**  
Exact SHA: `c867398cfe640064f09e0fac65f83f4551ab59de`  
Conclusion: **SUCCESS**

Results:

- exact-head verification: **PASS**
- Python live/readiness verifier compilation: **PASS**
- fail-closed readiness state: **PASS**
- hostile placeholder/template rejection: **PASS**
- 420Indexer dependency install: **PASS**
- 420Indexer build: **PASS**
- focused generalized Randomness descriptor/lifecycle qualification: **PASS, 0 skipped**
- complete directly affected 420Indexer regression: **229 passed / 0 failed / 1 environment-dependent PostgreSQL skip**
- manual-live-workflow and secret/template guards: **PASS**

The single skipped full-regression case is the pre-existing PostgreSQL-backed query-service integration test. It is unrelated to the Randomness descriptor/lifecycle changes and requires an external PostgreSQL fixture that this app-focused workflow does not provision. The focused Randomness suite has no skipped required checks.

### Retained Randomness Level 1 qualification

Workflow: **420Randomness audit qualification**  
Run: **37102627109**  
Job: **111145007450**  
Exact SHA: `c867398cfe640064f09e0fac65f83f4551ab59de`  
Conclusion: **SUCCESS**

Results:

- exact-head verification: **PASS**
- canonical Randomness inventory / Genesis wiring verifier: **PASS**
- RANDOM-AUDIT-4 deployment-bundle verifier: **PASS**
- retained Randomness Solidity formatting: **PASS**
- canonical Randomness graph build: **PASS**
- RANDOM-AUDIT-3 deterministic Genesis materialization regression: **PASS**
- all `Randomness*.t.sol` tests: **24 passed / 0 failed / 0 skipped**
- forbidden `tx.origin` / `selfdestruct` / `delegatecall` scan: **PASS**

## Superseded integration failure and root cause

The first frozen Step-5 integration run:

- run `37102416578`
- job `111144402205`
- SHA `65d99ab3b82a817ce87c093399c838dd4fabd514`

failed the focused generalized-Randomness Indexer test after the readiness guards and TypeScript build had passed.

The failure proved a real integration defect:

- a router request was keyed by `profileId` instead of `requestId`;
- a registry request/fulfillment lifecycle split into two objects because fulfillment preferred `routeId`.

The root cause was the generic lifecycle key priority. The implementation was corrected so `420Randomness` explicitly prioritizes `requestId`, then the new exact SHA was fully requalified. No tests or assertions were weakened.

## Live exit criteria

| Criterion | State |
| --- | --- |
| official production-equivalent public testnet live and frozen | **BLOCKED** |
| exact deployment-bundle artifacts deployed | **NOT RUN — network unavailable** |
| `RandomnessRegistry@0x0428` live code/storage identity verified | **NOT RUN — network unavailable** |
| route/profile/router live code identities verified | **NOT RUN — network unavailable** |
| ProtocolRegistry router component publication retained | **NOT RUN — network unavailable** |
| canonical randomness service publication retained | **NOT RUN — network unavailable** |
| one-time live `bindRouter` transaction retained | **NOT RUN — network unavailable** |
| qualified primary/fallback route configuration retained | **NOT RUN — network unavailable** |
| qualified profile configuration retained | **NOT RUN — network unavailable** |
| primary request/fulfillment smoke | **NOT RUN — network unavailable** |
| fallback activation/fulfillment smoke | **NOT RUN — network unavailable** |
| expiry/void smoke | **NOT RUN — network unavailable** |
| live negative/failure-path evidence | **NOT RUN — network unavailable** |
| deployed 420Indexer projection agreement | **NOT RUN — network unavailable** |

## Milestone and phase status

- Level 1 repository qualification: **PASS**
- Level 2 app-focused repository integration qualification: **PASS**
- actual live production-equivalent integration milestone: **BLOCKED by unavailable official testnet**
- Level 3 full app-phase closeout: **intentionally deferred**
- RANDOM-AUDIT-5 canonical completion: **NOT COMPLETE**
- RANDOM-AUDIT-6 eligibility: **NOT YET ELIGIBLE**

The repository implementation and qualification harness are complete. The remaining blocker is external to the Randomness repository work: the official production-equivalent public testnet must be launched, frozen and given real endpoints/chain identity before this step can be completed.

**Current canonical roadmap step remains: RANDOM-AUDIT-5 — production-equivalent testnet qualification.**
