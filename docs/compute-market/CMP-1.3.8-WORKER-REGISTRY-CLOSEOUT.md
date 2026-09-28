# CMP-1.3.8 — ComputeWorkerRegistry phase reconciliation and repository closeout

Status: **IMPLEMENTATION COMPLETE; FINAL EXACT-HEAD PHASE QUALIFICATION REQUIRED.**

CMP-1.3.8 is the final repository closeout slice for the original CMP-1.3 ComputeWorkerRegistry deliverable. It introduces no new runtime authority. Its job is to reconcile the complete 1.3.0–1.3.7 implementation against the frozen baseline, correct historical qualification gaps, freeze the invariant/test evidence ledger, and establish the exact boundary between repository completion and later live-release dependencies.

## Why this step exists

The controlling CMP-1 roadmap defines the WorkerRegistry responsibility but did not previously define a 1.3.8 runtime feature. After 1.3.7, all implementation categories frozen by CMP-1.3.0 exist:

- canonical worker identity and lifecycle;
- execution-key possession and revision history;
- bounded capability detail;
- independent capability attestation;
- policy-scoped 420Trust reputation references;
- typed fail-closed compute-stake references;
- accepted-job immutable worker snapshots;
- deployment/code-hash/wiring/publication qualification package.

The remaining work is phase-level reconciliation and exact-head proof.

## Historical evidence reconciliation

CMP-1.3.4 candidate code qualified, and its final evidence head `ba11ab000f819e7d34408536ef58cf6ef20b5692` passed Docs and Solidity. Its 420 Integrated run #5793 was cancelled, so that historical head is **not** independently promoted to a fully qualified exact-head closeout.

The accumulated CMP-1.3 implementation continued unchanged through later descendants whose retained Integrated suites passed. CMP-1.3.8 therefore does not rewrite history. Instead, it requires one new exact final phase head containing all 1.3.1–1.3.7 work and reruns the retained qualification suite over that complete state. A green CMP-1.3.8 head supersedes the incomplete historical 1.3.4 evidence-head closeout for phase qualification purposes.

CMP-1.3.5 final evidence head `4d95792fc8fd0a144ef484294927bc5936de2cd5` passed Docs, Solidity and Integrated.

CMP-1.3.6 final evidence head `56523d6a869fd1730b6c94607861df2ae70e7db0` passed Docs, Solidity and Integrated.

CMP-1.3.7 repository candidate `c7dc959d19c798ff587edf1da9106a81ae772e7a` passed Docs, Solidity 16/16, Integrated and Genesis Address Authority. The unrelated 420Indexer workflow failure was caused by missing EXP evidence upload directories and is not a WorkerRegistry protocol failure.

## Frozen phase component set

Repository closeout requires the retained presence and compilation of:

- `ComputeWorkerRegistry420`;
- `ComputeWorkerAttestation420`;
- `ComputeWorkerCapabilityProfile420`;
- `ComputeWorkerCapabilityEligibility420`;
- `ComputeWorkerTrust420`;
- `ComputeWorkerStake420`;
- `ComputeJobWorkerSnapshotEvidence420`;
- `ComputeWorkerCanonicalWiring420`.

These components preserve the authority boundaries established by CMP-1.3.0. No worker-registry component gains general custody, settlement, correctness, verifier, bridge, validator, wallet, or governance authority.

## Frozen acceptance coverage

The retained Foundry suites cover the baseline's required positive and adversarial classes, including:

- deterministic/domain-separated worker identity;
- immutable provider/node/resource ancestry;
- execution-key possession and rotation;
- exact revision reconstruction;
- lifecycle transitions and terminal retirement;
- parent/resource fail-closed eligibility;
- bounded architecture/CPU/GPU/software/scalar capability matching;
- prevention of capability broadening beyond canonical resource state;
- independent attestation policy, expiry, revocation and replay protection;
- policy-scoped Trust evidence without universal-score authority;
- rejection of validator stake, wallet balance or payer deposits as compute collateral;
- fail-closed stake-required admission while CMP-1.5 is unbound;
- immutable accepted-job worker/execution snapshot;
- protection against duplicate assignment/result replay;
- preservation of accepted historical identity after later suspension or profile change;
- exact deployment graph and runtime code-hash verification.

## Invariant disposition

CMP-1.3 repository implementation now has explicit retained coverage for:

- CMP-INV-002 / 003 / 004 — identity separation, non-reassignment and immutable ancestry;
- CMP-INV-005 — worker registration/admission grants no unrelated authority;
- CMP-INV-007 / 008 — worker/capability selection cannot broaden accepted resource constraints;
- CMP-INV-019 — assignment/evidence cannot be replayed across workers/jobs;
- CMP-INV-020 — later suspension cannot rewrite accepted execution identity or automatically confiscate settlement;
- CMP-INV-021 / 022 — worker collateral is only through the typed CMP-1.5 source/policy path and otherwise fails closed;
- CMP-INV-023 — Trust remains evidence rather than execution/settlement authority;
- CMP-INV-026 — accepted execution identity remains historically reconstructable;
- CMP-INV-028 / 029 — capability/key/resource/dependency changes cannot silently alter accepted semantics;
- CMP-INV-030 — the WorkerRegistry remains provider-neutral and general-purpose.

CMP-INV-021/022 repository coverage does **not** claim a live stake/slash implementation. Actual collateral custody, exit, slash and reward authority belongs to CMP-1.5.

## Machine-readable closeout ledger

`contracts/config/compute-market/cmp-1.3.8-closeout-ledger.json` records:

- every 1.3.0–1.3.7 disposition;
- required retained source and test files;
- invariant disposition;
- the historical 1.3.4 qualification caveat;
- external live-release blockers.

`scripts/verify-cmp-1-3-8-closeout.py` fails closed if required source/tests, substep dispositions, invariant entries, or explicit release blockers disappear.

## What CMP-1.3.8 may close

A successful exact-head CMP-1.3.8 qualification permits:

**CMP-1.3 ComputeWorkerRegistry — REPOSITORY IMPLEMENTATION COMPLETE.**

It does not permit:

- claiming live deployment;
- claiming a functioning live CMP-1.5 stake/slash source;
- claiming ProtocolRegistry publication;
- claiming production/testnet release;
- inventing deployment addresses, transaction hashes, block numbers or runtime hashes.

Those remain external release gates already frozen by CMP-1.3.7.

## Final qualification gate

The CMP-1.3.8 candidate head must pass, on the same exact SHA:

- Solidity Contracts, all required shards;
- 420 Integrated Qualification;
- 420Docs Qualification;
- Genesis Address Authority if triggered by the closeout diff;
- the closeout ledger verifier at repository scope.

After candidate evidence is recorded, the evidence-recording head must again pass the retained exact-head suite before CMP-1.3.8 and the repository portion of CMP-1.3 are marked COMPLETE.
