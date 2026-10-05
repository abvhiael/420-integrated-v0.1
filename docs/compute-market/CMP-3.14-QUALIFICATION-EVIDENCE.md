# CMP-3.14 — Qualification evidence

Status: **COMPLETE — Level 3 exact-head qualified.**

## Step

- roadmap step: **CMP-3.14 — Phase closeout**
- qualification level: **Level 3 — complete app-phase closeout**
- implementation SHA: `0fcb699e6270bc863538eacb08ba204ce2f41b6c`
- evidence commit: this evidence-only closeout commit
- PR: **#512 — CMP-3: node420 compute worker runtime**
- branch: `cmp-3.1-worker-daemon-20261004`
- reconciliation base/current main: `b338b9c9c140957b0ea8619b0b20bfed415f2c6d`
- branch disposition at qualification: **0 commits behind current main**
- GitHub test merge used for reconciliation: `c72d4795e178b66a1d4ae4737af8033f475a736a`
- reconciled anchor: `c62b01be3dfed2618e8b0bbedf8c8e73e5fd02b1`

## Implementation summary

CMP-3.14 reconciled the complete accumulated CMP-3.1–CMP-3.13 node420 worker runtime phase with current `main`, added a machine-readable phase-closeout inventory and verifier, and wired the phase boundary into repository CI ownership so the canonical Level 3 owners qualify one exact accumulated implementation SHA.

The closeout preserves all previously qualified worker authority boundaries. No canonical job, result-correctness, settlement, governance, bridge, wallet or deployment authority is invented by the worker.

## Canonical Level 3 evidence

All required gates below qualified the exact same implementation SHA `0fcb699e6270bc863538eacb08ba204ce2f41b6c`.

| Owner | Run | Job(s) | Result |
| --- | --- | --- | --- |
| Solidity Contracts | #4863 / `37273098217` | classifier `111644192507`; shards 0–3: `111644262701`, `111644262485`, `111644262537`, `111644262619` | **SUCCESS** |
| Genesis Address Authority | #1568 / `37273098100` | `111644121523` | **SUCCESS** |
| 420 Integrated Qualification | #6463 / `37273098239` | geth `111644194546`; fault/soak `111644194816`; deps `111644194873`; offline core `111644194945` | **SUCCESS** |
| 420Docs Qualification | #5410 / `37273098189` | `111644121723` | **SUCCESS** |
| Compute Market Qualification | #383 / `37273098241` | `111644185941` | **SUCCESS** |
| Compute Worker Fast Qualification | #358 / `37273098188` | `111644131840` | **SUCCESS** |
| Compute Worker Integration Qualification | #132 / `37273098207` | `111644121861` | **SUCCESS** |
| node420 Release Gate | #502 / `37273098147` | `111644121682` | **SUCCESS** |
| 420Indexer | #2368 / `37273098090` | `111644261075` | **SUCCESS** |

## Solidity/Genesis ownership

Solidity Contracts correctly classified CMP-3.14 as a Level 3 phase boundary and ran the canonical repository Foundry inventory once using four balanced PR shards. All four shards passed.

The monolithic `foundry` PR job and Compute-only fast shortcut were skipped intentionally because the four-shard Level 3 inventory owned the required coverage. Those expected skips are not treated as missing qualification.

Genesis Address Authority separately passed canonical address, namespace, collision, predeploy, frozen-address and manifest-authority verification without duplicating the full Foundry inventory.

## Worker qualification

Compute Worker Fast #358 passed:

- exact-head verification;
- Go worker/CLI tests, vet and build;
- real Docker sandbox isolation;
- real Docker checkpoint resume;
- real Docker result commitment;
- retained CMP-3.1 through CMP-3.12 verifiers;
- deterministic six-target CMP-3.13 package build;
- CMP-3.13 package verifier;
- CMP-3.14 phase-closeout verifier;
- package artifact upload.

Compute Worker Integration #132 passed the retained worker integration suite, node420-compute package tests, vet and build on the same exact SHA.

## Package artifact

- artifact ID: `11328847910`
- name: `node420-compute-packages-0fcb699e6270bc863538eacb08ba204ce2f41b6c`
- size: `8,981,935` bytes
- digest: `sha256:90525b8e031ac4fee22f2e234252bcd68391b46753170e7676e3cb8ed6751ddf`

The artifact remains repository qualification evidence only. It does not claim native Windows/macOS runtime certification, Authenticode, Apple notarization, production GPU support or live worker deployment.

## Security / adversarial / invariant disposition

The exact-head Level 3 run retained:

- malicious-workload admission/quarantine regressions;
- sandbox isolation;
- replay/authorization boundaries;
- checkpoint/resume integrity;
- content-addressed work-unit/result/evidence commitments;
- execution-key signed receipt invariants;
- local resource controls;
- retained Compute Market adversarial/invariant checks;
- global fault/soak qualification;
- full repository Solidity inventory;
- Genesis address-authority verification.

No assertion was weakened, no authorization was broadened, and no safety gate was bypassed to obtain qualification.

## Client/service disposition

- **420Indexer:** qualified successfully on the exact closeout SHA.
- **420RPC:** no CMP-3 RPC method/schema/backend surface was introduced; no direct CMP-3 suite applicable.
- **420Search:** no CMP-3 Search/indexing surface was introduced; no direct CMP-3 suite applicable.
- **frontend/backend:** no CMP-3 user-facing application/backend is implemented in this phase; the human-facing Compute application remains CMP-8.
- **Compute Market:** retained protocol suite passed because CMP-3 consumes its frozen authorization/protocol boundary.

## Deployment/config verification and limitations

Repository deployment/config/build/static qualification is green for this phase. CMP-3.14 remains a repository closeout, not a live-network claim.

Intentionally deferred operational evidence:

- public testnet worker deployment and funded jobs — CMP-9;
- native Windows/macOS workload-runtime qualification;
- Apple notarization and Authenticode;
- production GPU backend qualification;
- ProtocolRegistry live deployment/publication;
- real worker fleet/long-duration operational evidence.

These deferred live/external items are not repository blockers for CMP-3.14.

## Exit criteria

- accumulated CMP-3.1–CMP-3.13 work reconciled with current main: **PASS**
- exact implementation SHA established: **PASS**
- canonical full Solidity inventory once, four balanced shards: **PASS**
- Genesis/address authority without duplicate Foundry: **PASS**
- 420 Integrated/global qualification: **PASS**
- global Docs qualification: **PASS**
- retained Compute Market suite: **PASS**
- retained worker Fast suite: **PASS**
- retained worker Integration suite: **PASS**
- node420 release qualification: **PASS**
- affected Indexer/global consumer qualification: **PASS**
- security/adversarial/invariant/static/build/deployment/config checks: **PASS**
- durable repository evidence recorded: **PASS**
- remaining repository blockers: **NONE**

## Completion

**CMP-3.14 is COMPLETE.**

The complete CMP-3 node420 worker runtime phase is repository-qualified through its Level 3 closeout.

Next canonical phase:

**CMP-4 — Scientific compute framework**

No merge is authorized or performed by this evidence closeout.
