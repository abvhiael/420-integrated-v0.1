# ID-AUDIT-9 — Production-Equivalent Testnet Deployment Qualification

**Status:** NOT YET COMPLETE — BLOCKED ON OFFICIAL PUBLIC TESTNET  
**Repository-side implementation:** IMPLEMENTED — Level 1 harness/readiness qualification pending exact-head CI  
**Repository:** `abvhiael/420-integrated-v0.1`  
**Working PR:** #438  
**Canonical roadmap:** `docs/audit/420IDENTITY-AUDIT-REMEDIATION-ROADMAP.md`

## Canonical requirement

ID-AUDIT-9 requires qualification **on the approved public-testnet release candidate**:

- verify chain ID/genesis identity;
- verify runtime code/hash/storage at `0x0000000000000000000000000000000000000436`;
- verify GovernanceTimelock immutable value;
- execute representative profile/issuer/credential lifecycle;
- verify Wallet, Indexer, Search and Explorer against the same deployment;
- exercise negative authorization, expiry, revocation, reorg/restart and dependency-failure cases;
- retain receipts/logs/manifests tied to the exact release SHA.

**Canonical exit:** `TESTNET READY = YES`.

Repository-only, local, Anvil, mock or CI-generated passing fixtures are not live-deployment evidence and cannot satisfy this exit criterion.

## Current external blocker

Repository truth does not contain an official public-testnet network manifest:

`developer-hub/manifests/testnet.json` — **ABSENT**

The broader testnet infrastructure remains unprovisioned/placeholder-bound. Existing service readiness records explicitly keep live-network completion false. The repository must therefore remain fail-closed and must not fabricate a public RPC, Genesis hash, service endpoint, transaction receipt or live Identity evidence package.

Current readiness signal expected from the repository verifier:

```
ID_AUDIT_9_READINESS=BLOCKED_OFFICIAL_TESTNET_MANIFEST
liveQualificationComplete=false
```

## Repository implementation completed

### 1. Live evidence contract

Added:

`420-indexer/src/identity-testnet-qualification.ts`

The evidence contract requires one coherent live deployment and rejects contradictory or incomplete evidence.

It validates:

- official manifest environment `testnet`;
- positive manifest/live chain ID equality;
- HTTPS RPC, Indexer, Search and Explorer endpoints without embedded credentials;
- canonical Identity420 address `0x0436`;
- exact runtime hash `0xda0fcd565d7aea6590b3e0ec468f7b99af50138b62527e770ca367a57e6cfd86`;
- `systemName() == "Identity420"`;
- `protocolVersion() == 3`;
- GovernanceTimelock `0x0429`;
- explicit storage witnesses;
- exact repository SHA binding;
- non-local official manifest provenance.

### 2. Representative Identity lifecycle evidence

The required lifecycle evidence covers real transaction receipts for:

- profile creation;
- profile update/activity;
- controller nomination;
- controller acceptance;
- governance issuer configuration;
- credential issuance;
- subject credential rejection;
- second credential issuance;
- issuer/controller credential revocation;
- finite-expiry credential issuance and later invalidity;
- governance issuer deactivation;
- governance issuer reactivation.

It additionally requires proof that:

- unauthorized profile mutation was rejected;
- unauthorized issuer use was rejected;
- unauthorized credential revocation was rejected;
- final profile controller is the accepted recipient;
- final profile is active;
- rejected credentials are invalid;
- revoked credentials are invalid;
- expired credentials are invalid;
- issuer deactivation dynamically invalidates credentials;
- issuer reactivation is observed after the compromise/deactivation drill.

Governance transactions are **not impersonated by CI**. Their real transaction hashes must come from the canonical GovernanceTimelock execution path and are independently verified by the live runner.

### 3. Wallet / Indexer / Search / Explorer agreement

Live evidence must prove:

#### Wallet

- Wallet Identity client reads the same profile/controller state from the qualified deployment;
- rejected/revoked credential validity agrees with canonical Identity420 state;
- wrong-chain behavior is covered by the dependency-failure drill.

#### 420Indexer

- chain ID agrees with the live deployment;
- protocol is `420Identity`;
- profile object key is `profileId:<profileId>`;
- issuer object key is `issuerId:<issuerId>`;
- credential object key is `credentialId:<credentialId>`;
- final profile/issuer/credential lifecycle events are present with live block provenance.

#### 420Search

- same profile ID/controller;
- final active profile is publicly resolvable;
- provenance identifies 420Identity;
- private payload exposure remains false.

#### 420Explorer

- a real Identity lifecycle transaction is presented;
- Identity address is `0x0436`;
- block/transaction provenance is retained;
- Explorer remains explicitly non-authoritative.

### 4. Restart, reorg and dependency-failure evidence

The live evidence contract requires retained operational drill evidence for:

#### Restart

- checkpoint before/after;
- bounded replay gap;
- repeated restart idempotence with zero additional processing.

#### Reorg

- positive recovered bounded reorg depth;
- final canonical checkpoint;
- hostile/deep reorg rejected without state mutation.

#### Dependency failure

- wrong-chain source rejected;
- stale Indexer rejected;
- Search unavailability fails closed;
- Explorer outage cannot become canonical authority;
- Wallet wrong-chain state rejected.

These must be real production-equivalent deployment drill results. CI booleans alone are insufficient to complete the live gate.

### 5. Hostile evidence-contract tests

Added:

`420-indexer/test/identity-testnet-qualification.test.ts`

The suite covers:

- valid official testnet manifest;
- rejection of local environment;
- rejection of HTTP/insecure RPC;
- rejection of embedded endpoint credentials;
- missing derived-service endpoints;
- wrong Identity address;
- wrong live chain;
- wrong runtime hash;
- wrong system name/version;
- wrong GovernanceTimelock;
- malformed storage witness;
- valid complete lifecycle;
- missing authorization rejection;
- missing expiry evidence;
- rejected/revoked credential incorrectly valid;
- issuer recovery not completed;
- Wallet disagreement;
- Indexer object-key/chain disagreement;
- Search privacy violation;
- Explorer incorrectly claiming canonical authority;
- restart idempotence failure;
- missing reorg recovery;
- missing deep-reorg fail-closed behavior;
- dependency-failure gaps;
- exact repository-SHA binding;
- local-example provenance rejection;
- empty deployed bytecode rejection.

### 6. Production-equivalent live verifier

Added:

`420-indexer/scripts/qualify-identity-testnet.mjs`

The runner:

1. loads the official public-testnet manifest;
2. requires secure RPC, Indexer, Search and Explorer origins;
3. verifies RPC chain ID and Genesis block;
4. verifies live code at `0x0436` and exact runtime hash;
5. verifies Identity system name/version/GovernanceTimelock;
6. verifies all submitted lifecycle/governance transaction receipts;
7. verifies final profile/issuer/credential state;
8. checks historical issuer deactivation state at the actual deactivation block;
9. proves credential invalidity while the issuer was inactive;
10. proves expiry from live chain time/state;
11. reads live storage witnesses;
12. reads the same deployment through the Wallet Identity client;
13. polls 420Indexer for profile/issuer/credential object histories;
14. polls 420Search for final active public profile state and privacy boundary;
15. verifies a real Identity transaction through 420Explorer;
16. incorporates reviewed restart/reorg/dependency-failure drill evidence;
17. validates the complete evidence package against the exact repository SHA;
18. writes retained PASS JSON only after all checks succeed.

The runner consumes no private signing key and performs no governance impersonation. Lifecycle/governance actions must already have been executed through their canonical authorities, with non-secret transaction hashes retained in the evidence draft.

### 7. Manual live workflow

Added:

`.github/workflows/identity-live-testnet.yml`

The workflow is deliberately `workflow_dispatch` only.

It requires:

- the official testnet manifest path;
- a reviewed non-secret ID-AUDIT-9 evidence draft containing real transaction/drill evidence;
- exact checkout SHA.

It builds and tests the evidence contract before the live verification runner executes, and uploads the resulting evidence artifact.

### 8. Evidence draft template

Added:

`docs/audit/ID-AUDIT-9-LIVE-EVIDENCE-DRAFT.example.json`

The template contains only `REPLACE_*` placeholders and false/unqualified recovery flags. It is not PASS evidence and cannot satisfy the live gate.

Once the official testnet exists, operators must create:

`docs/audit/ID-AUDIT-9-LIVE-EVIDENCE-DRAFT.json`

using real non-secret transaction IDs and recovery drill outputs. Private keys and credential-bearing endpoints must never be committed.

### 9. Fail-closed readiness verifier

Added:

`scripts/verify-id-audit-9-testnet-readiness.py`

It enforces both sides of the deployment boundary.

While the official testnet manifest is absent:

- retained PASS evidence must not exist;
- launch metadata must not claim a frozen public network identity;
- public service endpoints must remain visibly unresolved/placeholder-bound;
- the repository returns `BLOCKED_OFFICIAL_TESTNET_MANIFEST`.

Once the official manifest exists:

- environment must be `testnet`;
- RPC/Indexer/Search/Explorer must be secure and non-placeholder;
- Identity420 must be bound to canonical `0x0436`;
- retained ID-AUDIT-9 PASS evidence becomes mandatory.

## Repository-side Level 1 qualification

Dedicated workflow:

`.github/workflows/identity-id-audit-9.yml`

Required checks:

1. exact-head checkout/assertion;
2. 420Indexer dependency install/build;
3. focused ID-AUDIT-9 hostile evidence-contract suite;
4. live-runner syntax validation;
5. fail-closed official-testnet readiness verification;
6. retained ID-AUDIT-8 operator-readiness verification;
7. retained Wallet Identity client/UI tests;
8. full directly affected 420Indexer regression;
9. live workflow/manual-gate and secret-placeholder guard.

## Qualification level and milestone status

Repository harness/readiness work is **Level 1**.

No synthetic Level 2 run is appropriate merely because a live evidence harness was added. The actual ID-AUDIT-9 production-equivalent execution is itself a material cross-component integration event and must use the real candidate chain/services.

ID-AUDIT-6 remains the last completed repository-side Identity cross-service Level 2 milestone.

## Live exit-criterion status

| Canonical criterion | Status |
| --- | --- |
| approved production-equivalent public testnet exists | **BLOCKED** |
| chain ID / Genesis identity verified live | **NOT RUN — BLOCKED** |
| live code/hash/storage at `0x0436` | **NOT RUN — BLOCKED** |
| live GovernanceTimelock immutable | **NOT RUN — BLOCKED** |
| representative profile lifecycle | **NOT RUN — BLOCKED** |
| representative issuer lifecycle | **NOT RUN — BLOCKED** |
| representative credential lifecycle | **NOT RUN — BLOCKED** |
| negative authorization | **NOT RUN — BLOCKED** |
| expiry | **NOT RUN — BLOCKED** |
| revocation/rejection | **NOT RUN — BLOCKED** |
| Wallet same-deployment verification | **NOT RUN — BLOCKED** |
| Indexer same-deployment verification | **NOT RUN — BLOCKED** |
| Search same-deployment verification | **NOT RUN — BLOCKED** |
| Explorer same-deployment verification | **NOT RUN — BLOCKED** |
| restart/reorg recovery | **NOT RUN — BLOCKED** |
| dependency-failure drills | **NOT RUN — BLOCKED** |
| retained receipts/logs/manifests tied to exact release SHA | **NOT RUN — BLOCKED** |
| repository live-qualification harness | **IMPLEMENTED — qualification pending** |
| TESTNET READY = YES | **NO** |

## Blocker removal / exact continuation

Do **not** advance to ID-AUDIT-10 while ID-AUDIT-9 remains live-blocked under the canonical ordering.

When the official public testnet candidate exists:

1. publish the official `developer-hub/manifests/testnet.json` with non-placeholder RPC/Indexer/Search/Explorer endpoints and canonical Identity420 `0x0436`;
2. execute the representative profile/controller/credential transactions using disposable testnet accounts;
3. execute issuer setup, deactivation and reactivation through the actual GovernanceTimelock process;
4. execute unauthorized/failure-path attempts and retain rejected transaction/call evidence;
5. allow the finite-expiry credential to cross its expiry boundary;
6. execute the Indexer restart/idempotence and bounded/deep-reorg drills;
7. execute wrong-chain/stale/unavailable dependency drills across Wallet/Indexer/Search/Explorer;
8. populate the reviewed evidence draft with the resulting non-secret IDs/results;
9. dispatch **420Identity live testnet qualification** on the exact candidate SHA;
10. retain the generated PASS artifact as `docs/audit/ID-AUDIT-9-LIVE-TESTNET-EVIDENCE.json` after independent review;
11. rerun the readiness verifier;
12. only then set **TESTNET READY = YES** and mark ID-AUDIT-9 COMPLETE.

## Level 3 disposition

Full current-main reconciliation and complete app-phase qualification remain ID-AUDIT-10 work, but ID-AUDIT-10 must not be started as a substitute for the missing live ID-AUDIT-9 exit criterion.

## Exact-head repository qualification evidence

Qualification trigger branch created from audit implementation SHA `61265cc81aab15d232848fa4daff430685ea1a29`. This branch differs only by this evidence note and exists solely to obtain pull-request-triggered exact-head CI for the identical ID-AUDIT-9 harness/readiness implementation tree.

## Current roadmap state

**ID-AUDIT-9 remains the active canonical roadmap step until the production-equivalent live criteria pass.**

The next canonical step is therefore not yet eligible to begin.

After ID-AUDIT-9 closes, the next canonical roadmap step is:

**ID-AUDIT-10 — phase closeout, reconciliation and retained evidence**
