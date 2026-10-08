# CMP-7.10 — Qualification evidence

Status: **COMPLETE — Level 3 exact-head qualified.**

## Step

- roadmap step: **CMP-7.10 — Phase closeout**
- qualification level: **Level 3 — complete app-phase closeout**
- implementation SHA: `3e7ea3dca2d3f731b40155df2e5e48f13680d955`
- evidence commit: this evidence-only closeout commit
- PR: **#566 — CMP-7: SDK, API, CLI and indexer**
- branch: `cmp-7-sdk-api-cli-indexer-20261008`
- reconciliation base/current main: `d112b2eb55b50a3a4f52a5e2a5364374595efe71`
- reconciliation merge anchor: `7516fc8b9cd85eafb2c88ba013074074b5f70520`
- branch disposition at final qualification: **0 commits behind current main**
- next canonical phase: **CMP-8 — 420Compute application**

## Implementation summary

CMP-7 closes the developer-surface phase for Compute Market.

The accumulated implementation includes:

- typed Compute SDK client and canonical request validation;
- Wallet-authorized job-submission API;
- worker, verifier and research-project APIs;
- artifact-derived, reorg-safe Compute indexer projections;
- bounded historical analytics;
- developer documentation;
- `420 compute submit|worker|status|verify|rewards` CLI.

The phase preserves the protocol authority boundary: SDK/API/CLI do not sign or custody; writes remain canonical-contract + Wallet-authorized operations; indexer and analytics records remain explicitly non-authoritative.

## Canonical Level 3 evidence

Every required owner below qualified the same exact implementation SHA `3e7ea3dca2d3f731b40155df2e5e48f13680d955`.

| Owner | Run | Job(s) | Result |
| --- | --- | --- | --- |
| Solidity Contracts | #5508 / `37740557512` | classifier `113190045941`; shards: 0 `113190556652`, 1 `113190556566`, 2 `113190556587`, 3 `113190556600` | **SUCCESS** |
| Genesis Address Authority | #2584 / `37740557414` | cross-manifest-authority `113190043525` | **SUCCESS** |
| 420 Integrated Qualification | #6594 / `37740557424` | offline-core `113190368437`; geth-engine `113190368612`; fault-matrix `113190368629`; production-dependencies `113190368818` | **SUCCESS** |
| 420Docs Qualification | #7273 / `37740557474` | qualify `113190337040` | **SUCCESS** |
| Compute Market Qualification | #588 / `37740557516` | fast-qualification `113190043930` | **SUCCESS** |
| Compute Developer Surfaces | #51 / `37740557482` | classify `113190045336`; level3-integration `113190190988` | **SUCCESS** |
| 420Indexer | #1342 / `37740557579` | test `113190041627` | **SUCCESS** |
| 420Indexer | #2661 / `37740557591` | qualify `113190567359` | **SUCCESS** |
| 420 Genesis Contract Hardening | #1763 / `37740557554` | hardening `113190344298` | **SUCCESS** |

## Level 1 / Level 2 prerequisite disposition

The accumulated CMP-7 prerequisites were already qualified before Level 3:

- CMP-7.1 — SDK: exact-head Level 1 qualified;
- CMP-7.2 — job submission API: exact-head Level 1 qualified;
- CMP-7.3 — worker API: exact-head Level 1 qualified;
- CMP-7.4 — verifier API: exact-head Level 1 qualified;
- CMP-7.5 — research project API: Level 1 + first Level 2 API-convergence milestone qualified;
- CMP-7.6 — Compute indexer: exact-head Level 1 qualified;
- CMP-7.7 — historical analytics: exact-head Level 1 qualified;
- CMP-7.8 — developer documentation: documentation qualification complete;
- CMP-7.9 — CLI: Level 1 + second/final Level 2 developer-surface milestone qualified.

The Level-3 candidate then reran the retained SDK/API/Indexer/CLI integration through the dedicated `level3-integration` owner on the same exact SHA.

## Solidity / Genesis ownership

Solidity Contracts selected the canonical four balanced PR shards and ran the repository Foundry inventory once. All four shards passed. The ordinary monolithic `foundry` job and Compute-only fast shortcut were skipped intentionally because the four-shard Level-3 owner supplied the canonical full inventory.

Genesis Address Authority passed independently for canonical address/namespace/collision/predeploy/frozen-manifest authority without duplicating the full Foundry inventory.

## Developer-surface qualification

Compute Developer Surfaces #51 passed the dedicated Level-3 retained integration job on the exact closeout SHA.

The retained developer-surface gate covered:

- `@420/sdk`;
- `@420/compute-api`;
- 420Indexer;
- `@420/cli`.

The four ordinary per-surface jobs were intentionally skipped at Level 3 to avoid duplicate execution.

## Indexer / analytics disposition

Both Indexer owners passed on the exact closeout SHA:

- direct 420Indexer test workflow;
- shared-consumer / qualification workflow.

This preserves the reorg/replay, projection, API transport and shared-consumer guarantees for the new Compute read-model and historical analytics surfaces.

## Security / adversarial / invariant disposition

The exact-head Level-3 candidate passed:

- canonical full repository Solidity inventory;
- retained Compute Market verification;
- Genesis address/namespace/predeploy/frozen-manifest authority checks;
- global runtime/build/Geth/fault qualification;
- production dependency checks;
- developer-surface retained integration;
- direct and shared-consumer Indexer qualification;
- production contract size checks;
- invariant/fuzz campaigns;
- Slither high-severity static-analysis gate;
- phase-closeout config/verifier consistency.

No assertion was weakened, no authorization was broadened, and no safety gate was bypassed to obtain qualification.

## Authority and privacy invariants preserved

CMP-7 qualification confirms that:

- SDK/API/CLI do not request or store private keys, mnemonics or seed phrases;
- write plans remain unsigned until Wallet authorization;
- chain identity and canonical contract resolution fail closed;
- indexer and analytics records remain `authoritative:false`;
- reorg replay reconstructs indexed canonical state;
- duplicate reward identities cannot be silently double counted;
- API/CLI cannot manufacture verifier, settlement, worker or reward authority;
- private workload/dataset/credential/result bytes are excluded from public index projections.

## Deployment / live boundary

CMP-7.10 is a repository closeout. It does not claim live public deployment.

Deferred work remains:

- CMP-8 — human-facing 420Compute application;
- CMP-9 — canonical public-testnet deployment and real funded workloads;
- CMP-10 — external/adversarial security campaign;
- CMP-11 — mainnet release.

Those deferred operational phases are not repository blockers for CMP-7.10.

## Exit criteria

- CMP-7.1–CMP-7.9 prerequisite qualification: **PASS**
- reconciliation with current main: **PASS**
- exact implementation SHA established: **PASS**
- canonical full Solidity inventory once, four balanced shards: **PASS**
- Genesis/address authority without duplicate Foundry: **PASS**
- 420 Integrated/global qualification: **PASS**
- global Docs qualification: **PASS**
- retained Compute Market qualification: **PASS**
- retained SDK/API/Indexer/CLI Level-3 integration: **PASS**
- direct and shared-consumer Indexer qualification: **PASS**
- contract hardening/static/invariant coverage: **PASS**
- durable repository evidence recorded: **PASS**
- remaining repository blockers: **NONE**

## Completion

**CMP-7.10 is COMPLETE.**

The complete CMP-7 SDK/API/Indexer/CLI phase is repository-qualified through its Level-3 exact-head closeout.

Next canonical phase:

**CMP-8 — 420Compute application**

No merge is authorized or performed by this evidence closeout.
