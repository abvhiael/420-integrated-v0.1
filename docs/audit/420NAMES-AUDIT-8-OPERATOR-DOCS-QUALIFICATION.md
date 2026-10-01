# NAMES-AUDIT-8 — Deployment/operator documentation qualification

Status: **COMPLETE**

Qualification: **Level 1 + Level 2 app-integration milestone**

Qualified implementation SHA: `7bb313a9004573f003e9b826572ad4500d4413fd`

420Names qualification run: `36800266744` — **SUCCESS**

Qualification job: `110172811158`

## Canonical requirement

**NAMES-AUDIT-8 — deployment/operator documentation** requires Names-specific:

- deployment order;
- configuration;
- verification;
- recovery;
- monitoring;
- threat model;
- known limitations.

This step is also the documented NAMES-AUDIT-7/8 app-specific integration boundary. The broader retained 420Names suite therefore ran once here without invoking repository-wide Level 3 qualification.

## Implementation

Published:

- `docs/apps/names/deployment-operations.md`

Linked from:

- `docs/apps/names/index.md`

Added repository verifier:

- `scripts/verify-names-audit-8-operator-docs.py`

Extended the Names audit workflow so operator-document changes trigger the 7–8 app milestone suite.

## Operator runbook coverage

The runbook now records the frozen Names deployment identity:

- canonical address `0x0000000000000000000000000000000000000435`;
- retired address `0x0000000000000000000000000000000000000445` is prohibited;
- governance timelock immutable `0x0000000000000000000000000000000000000429`;
- Solidity `0.8.24`, optimizer 200, Cancun;
- runtime code hash `0xa974fffd3a40e7f28db41e4ae30656b33789d2483b18b47c809ce2385de709b7`;
- empty Genesis storage root `0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421`;
- source/artifact/descriptor identities;
- 60-second minimum and 24-hour maximum commitment age;
- 30–365 day registration/renewal duration per operation.

It defines deployment ordering through chain candidate freeze, GovernanceTimelock materialization, artifact/state regeneration, installation at `0x0435`, live verification, Indexer/Search enablement and finally Wallet deployment binding.

It explicitly documents that ProtocolRegistry is not a direct Names420 runtime dependency and that `serviceId` remains a reference requiring independent consumer validation.

## Verification and fail-closed operator model

The runbook distinguishes:

1. offline deterministic release-tree verification; and
2. live production-equivalent chain verification owned by NAMES-AUDIT-9.

Operators are prohibited from treating source compilation, a reserved address, offline manifest, Indexer result or Wallet configuration as live deployment proof.

The source contract exposes no operator/admin name mutation, pause, migration, arbitrary-call or upgrade function. Recovery procedures therefore do not invent an administrative repair path. A bad predeploy candidate is rejected/rebuilt; derived services are rebuilt from canonical history; Wallet bad bindings are removed until requalified.

## Monitoring

The runbook defines monitoring for:

- code/runtime identity at `0x0435`;
- system name/version/governance immutable;
- RPC canonicality disagreements;
- Names lifecycle/event anomalies;
- stale transfer/profile/service associations;
- reverse/forward disagreement;
- expired-name presentation;
- Indexer readiness/finality/reorg state;
- descriptor mismatch;
- Search incomplete/unordered-history failures;
- Wallet deployment-binding/version failures.

Derived services remain non-authoritative.

## Threat model

The documented threat/control matrix covers:

- copied commitments/front-running;
- reveal timing;
- active-name overwrite;
- unauthorized mutation/transfer;
- stale transfer associations;
- stale reverse resolution;
- resolver ABI confusion;
- wrong chain/contract;
- descriptor drift;
- reorg-derived stale Search state;
- Unicode/lookalike presentation;
- Identity/Registry over-trust;
- operator overreach.

## Known limitations

The runbook explicitly retains limitations including:

- no live deployment evidence until NAMES-AUDIT-9;
- no operator repair key;
- lease expiry/reregistration semantics;
- time-bounded commitments;
- names are not identity/trust proof;
- derived services may lag/rebuild;
- Search cannot recover plaintext labels from on-chain history;
- lowercase-ASCII presentation canonicalization is a qualified-client boundary;
- stale reverse storage is possible but not authoritative in reads;
- profile/service references do not confer trust or permission.

## Level 1 qualification

On exact SHA `7bb313a9004573f003e9b826572ad4500d4413fd`:

- exact-head check — PASS
- Genesis interface verifier — PASS
- Names dependency verifier — PASS
- Solidity formatting — PASS
- NAMES-AUDIT-8 operator-doc verifier — **PASS**
- verified canonical address — `0x0435`
- verified runtime hash — `0xa974fffd3a40e7f28db41e4ae30656b33789d2483b18b47c809ce2385de709b7`
- verified storage root — `0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421`
- verified descriptor SHA-256 — `74602adfdde367c82fcefcd35a89a5b0e415e92721289cca9e827be32299b3be`
- required operator sections — **9/9**

## Level 2 milestone qualification

The NAMES-AUDIT-7/8 app milestone ran on the same exact implementation SHA:

### Contracts / hardening

- `Names420DependencyModelTest` — 2/2 PASS
- `Names420AuditTest` — 8/8 PASS
- `RegistryIdentityNames420Test` — 10/10 PASS
- `Names420InvariantTest` — 1/1 PASS
  - invariant runs: 128
  - calls: 8192
  - reverts: 0
- `Names420HardeningTest` — 9/9 PASS
- total retained Solidity suites — **30/30 PASS**
- targeted Slither — **no high-severity Names420 findings**

### Frozen release material

- NAMES-AUDIT-5 artifact verifier — PASS
- NAMES-AUDIT-5 adversarial generator tests — 10 PASS
- NAMES-AUDIT-6 deterministic Genesis verifier — PASS
- NAMES-AUDIT-6 adversarial state tests — 8 PASS

### Indexer / Search

- frozen Names descriptor regeneration — PASS
- descriptor event count — 7
- targeted Indexer descriptor/lifecycle/query tests — **19/19 PASS**
- Search discovery tests — PASS
- Search Indexer-client tests — PASS

### Wallet

- retained Names resolver/send/management/UI tests — **23/23 PASS**
- Names Wallet static qualification — PASS

### Static authority check

- Names authority/opcode scan — PASS

## Current main

Main observed at closeout:

`df8f639d8f43b763298c8750ef49d3e5849c597c`

The audit branch is diverged because substantial unrelated work has accumulated, but reverse comparison found no newer main changes in the Names operator documentation, Names contract/artifact, Names audit workflow, frozen Names descriptor, or Search Names surfaces. Early reconciliation is not required by NAMES-AUDIT-8.

## Deferred Level 3

Intentionally deferred:

- final reconciliation with then-current `main`;
- complete repository Solidity/Genesis inventories;
- full 420 Integrated Qualification;
- repository-wide Docs/global reconciliation;
- Geth/global fault/soak suites;
- production-equivalent live chain evidence;
- final accumulated release-candidate qualification.

## Exit criteria

- deployment order published — **SATISFIED**
- configuration published — **SATISFIED**
- verification procedure published — **SATISFIED**
- recovery procedure published — **SATISFIED**
- monitoring requirements published — **SATISFIED**
- threat model published — **SATISFIED**
- known limitations published — **SATISFIED**
- runbook linked from Names app docs — **SATISFIED**
- runbook values reconciled to frozen repository artifacts — **SATISFIED**
- Level 1 exact-head qualification — **SATISFIED**
- NAMES-AUDIT-7/8 Level 2 milestone qualification — **SATISFIED**

## Next canonical roadmap step

**NAMES-AUDIT-9 — production-equivalent testnet deployment** — once the official testnet exists, verify chain ID, code at 0x0435, runtime hash, storage, governance binding, Registry discovery, Wallet resolution, indexer/search state, and full user workflows.
