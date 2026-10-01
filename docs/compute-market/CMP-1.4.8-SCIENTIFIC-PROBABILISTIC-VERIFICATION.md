# CMP-1.4.8 — Scientific/probabilistic verification

Status: **COMPLETE — LEVEL 1 + LEVEL 2 QUALIFIED. NO LIVE DEPLOYMENT/PUBLICATION CLAIM.**

## Canonical definition

> Support workload-specific validation where full recomputation is impractical.

The user-facing shorthand “for workloads where full recalculation is economically unreasonable” is consistent with the purpose, but the repository's canonical roadmap wording above remains authoritative.

## Repository baseline and roadmap-order note

Baseline `main`: `8d6df0e53220bdd3d9b6e3cbd2f467927a65d4f1`, the merge of qualified CMP-1.4.7.

CMP-1.4.4 remains open. This step does not claim signed-verdict provenance completion or contiguous completion of every earlier CMP-1.4 substep.

The retained CMP-0.9 protocol specification requires nondeterministic workloads to use an accepted objective tolerance/test protocol rather than byte equality or a majority vote assumed reliable. It also distinguishes decision-level `PASS`, `FAIL` and `INCONCLUSIVE` from canonical job states.

## Gap analysis

Before CMP-1.4.8 the repository had deterministic exact-recomputation adapters and replicated N-of-M evidence, but no generic scientific/probabilistic adapter architecture.

Missing capabilities were:

- exact workload-specific scientific protocol identity;
- versioned scientific adapter routing with runtime code-hash pinning;
- pre-execution sample-plan commitment;
- authenticated sampled evidence against a committed population;
- explicit inconclusive outcomes;
- semantic separation between deterministic and scientific adapter families;
- a reference workload demonstrating bounded validation without full recomputation.

## Implementation

### Scientific adapter interface

`IComputeScientificVerificationAdapter420` defines:

- explicit scientific adapter kind;
- workload type;
- profile ID;
- output schema;
- exact protocol commitment;
- evaluation against canonical input/output commitments plus a frozen sample-seed commitment;
- explicit `INCONCLUSIVE=0`, `PASS=1`, `FAIL=2` result semantics supplied by the concrete adapter;
- sample count, coverage basis points and a transcript commitment.

The interface deliberately does not expose job mutation, verifier selection, custody, settlement or slashing.

### Versioned scientific registry

`ComputeScientificAdapterRegistry420` publishes exact workload/profile routes under governance and freezes:

- adapter address;
- runtime code hash;
- output-schema commitment;
- scientific protocol commitment;
- monotonically increasing revision;
- activation state for new bindings.

Publication requires the explicit scientific adapter-kind discriminator. CMP-1.4.8 also adds an explicit deterministic adapter-kind discriminator to the CMP-1.4.7 interface/registry. Cross-family publication therefore fails before a job can bind the wrong method family.

### Pre-execution scientific binding

`ComputeScientificVerificationRouter420.bindAdapter` is restricted to one dedicated sampling authority and must run while the job remains `ACCEPTED` and before a worker is assigned.

It freezes:

- workload/profile;
- exact scientific adapter revision/address/runtime code hash;
- exact output schema and protocol commitment;
- a nonzero sample-seed commitment;
- accepted job revision;
- accepted verification-policy ID/revision/commitment;
- domain-separated binding reference.

The seed commitment prevents a sampling plan from being chosen after seeing the worker result. The router also rejects a sampling authority that is the job owner and rejects evaluation when that authority is the executing worker. It does not by itself prove seed secrecy, randomness, payer independence, or beneficial-controller separation; those remain operational/selection evidence requirements.

### Post-result evaluation

After `RESULT_COMMITTED`, the router:

1. rechecks workload/schema/policy against the frozen binding;
2. rejects adapter runtime-code drift;
3. reads the actual strict worker assignment and output commitment;
4. requires adapter protocol commitment to match the frozen route;
5. invokes the exact scientific adapter against the canonical job input, worker output and frozen seed commitment;
6. records sample count, coverage, outcome and adapter evidence.

The router does **not** call `recordVerification`, mutate the job to VERIFIED/FAILED, settle, refund, slash or move funds. CMP-1.4.4 remains responsible for canonical signed verdict provenance and later orchestration must decide how accepted evidence maps into a verdict.

## Reference sampled-mean protocol

`ComputeSampledMeanScientificAdapter420` is a deliberately bounded reference profile for a **public/non-sensitive** committed integer dataset.

It commits a dataset as:

`keccak256(abi.encode(INPUT_DOMAIN, datasetMerkleRoot, elementCount))`

and the worker mean as:

`keccak256(abi.encode(OUTPUT_DOMAIN, claimedMean))`.

The protocol:

- requires a power-of-two dataset size from 16 through 2,147,483,648 elements, bounding Merkle depth to at most 31;
- authenticates exactly four seed-derived unique sample indices;
- verifies every sampled `(index,value)` against the committed Merkle root;
- limits values to `1,000,000,000`;
- computes a sampled mean;
- marks evidence `INCONCLUSIVE` when sample range exceeds 25% of sampled mean;
- otherwise `PASS` when claimed mean is within 5% of sampled mean and `FAIL` when outside that tolerance;
- reports sample coverage rather than inventing a statistical confidence claim.

This profile is an executable example of an objective accepted test protocol. Four samples and these thresholds are not asserted to be scientifically appropriate for arbitrary workloads. A real workload must publish its own reviewed profile/methodology.

Because the concrete reference proof reveals sampled values and Merkle paths in transaction calldata, it is **not** a private-data profile. Private scientific workloads require a different adapter using committed/private evidence, ZK/TEE/oracle methods, or another reviewed mechanism without requiring raw private data as canonical plaintext.

## Level 1 qualification

Required on one exact implementation SHA:

- affected Compute contracts compile;
- dedicated scientific/probabilistic tests pass;
- retained deterministic and scientific adapter tests pass;
- seed/proof/output/replay/upgrade/authority negatives pass;
- mechanical CMP-1.4.8 verifier passes;
- focused Compute Market and Solidity workflows pass.

## Level 2 milestone

CMP-1.4.8 is the **CMP-1.4 verification-method integration** milestone.

Level 2 requires the retained full Compute Market Solidity suite on the same SHA plus explicit deterministic/scientific cross-family tests proving:

- deterministic adapters cannot be published as scientific routes;
- scientific adapters cannot be published as deterministic routes;
- both method families retain their own frozen semantics;
- neither evidence path silently becomes job/verdict/settlement authority.

No repository-wide Level 3 reconciliation is required here.

## Security and invariant disposition

CMP-1.4.8 preserves CMP-INV-005, 014, 016, 017, 020, 022, 023, 024, 025, 026, 027 and 030.

Most importantly:

- a provider signature or sampled majority is not represented as correctness;
- verification semantics are explicit/versioned/bound before settlement could consume them;
- slashing remains outside this adapter and requires later objective policy-bound adjudication;
- private data is not generically required on-chain;
- historical scientific bindings remain reconstructable after route upgrades;
- non-AI scientific workloads remain first-class.

## Exit criteria

CMP-1.4.8 is COMPLETE only when every machine-readable exit criterion passes and Level 1 + the Level 2 verifier-method integration milestone are green on the same exact implementation SHA.

## Qualification evidence

Qualified implementation SHA: `6dd84b9b642dc320f80f03a696901ff4492ff6ea`.

- Compute Market Qualification #51 — run `36815090895` — **success**; retained Compute suite **316 passed, 0 failed**
- Solidity Contracts #3537 — run `36815090892` — **success**
- 420Docs Qualification #3733 — run `36815090861` — **success**
- 420Indexer #1153 — run `36815090815` — **success**
- Genesis Address Authority #348 — run `36815090831` — **success**
- 420Registry REG-AUDIT-4 #183 — run `36815090925` — **success**

## Completion

**COMPLETE at Level 1 and the CMP-1.4 verification-method Level 2 milestone.** Level 3 remains intentionally deferred to complete Compute app-phase closeout.
