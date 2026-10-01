# CMP-1.4.7 — Deterministic verification adapters

Status: **COMPLETE — LEVEL 1 QUALIFIED. NO LIVE DEPLOYMENT/PUBLICATION CLAIM.**

## Canonical definition

> For workloads whose result can be independently recomputed.

## Repository baseline and roadmap-order note

Baseline current `main`: `df8f639d8f43b763298c8750ef49d3e5849c597c`.

CMP-1.4.6 is complete on this baseline. CMP-1.4.4 remains open; this step does not claim canonical signed-verdict completion or contiguous completion of every earlier CMP-1.4 substep.

CMP-1.4.0 explicitly retained `ComputeJobIntegerProfileVerification420` as a bounded deterministic example only. CMP-1.4.7 therefore must provide a reusable adapter architecture rather than relabel that single profile as the general solution.

## Gap analysis

Before CMP-1.4.7:

- one deterministic integer profile existed;
- there was no generic deterministic adapter interface;
- no versioned adapter registry pinned exact adapter code hashes;
- no per-job pre-execution adapter snapshot existed;
- no generic router proved that an output preimage matched the worker's actual committed output before recomputation;
- later adapter upgrades could not be represented as versioned routes because no generic route existed.

The existing integer profile therefore demonstrated one deterministic workload but did not satisfy the general adapter architecture.

## Implementation

### Adapter interface

`IComputeDeterministicVerificationAdapter420` defines the minimal deterministic semantics surface:

- exact workload type;
- exact profile ID;
- exact output schema;
- canonical input commitment from a full input preimage;
- canonical output commitment from a full output preimage;
- independent deterministic evaluation returning correctness, independently computed expected-output commitment and a nonzero evaluation-evidence commitment.

Adapters expose read-only computation semantics and have no job, verdict, settlement or custody mutation surface.

### Versioned adapter registry

`ComputeDeterministicAdapterRegistry420` publishes exact workload/profile routes under governance.

Each route records:

- adapter address;
- deployed runtime code hash;
- output-schema commitment;
- monotonically increasing route revision;
- current activation state.

Publication validates that adapter-reported workload/profile/schema exactly match the route. New publication creates a new revision rather than rewriting old routes. Activation controls only new job binding.

### Worker output binding

`ComputeJobMatchedWorkerEvidence420.Assignment` now retains the exact `outputHash` already supplied to `commitResult()`.

This closes a generic verification gap: a deterministic router can now prove the supplied output preimage corresponds to the worker's actual committed output rather than merely accepting a caller-provided value.

### Per-job adapter freeze

`ComputeDeterministicVerificationRouter420.bindAdapter` is callable only by the job owner while the job remains `ACCEPTED`, before a worker has started.

The binding freezes:

- exact job revision;
- workload/profile;
- adapter registry revision;
- adapter address and runtime code hash;
- output schema;
- accepted verification-policy ID/revision/commitment;
- domain-separated binding reference.

Only the current active adapter revision may be newly frozen. Later registry publication or deactivation cannot rewrite an already frozen job route.

### Deterministic evaluation

After `RESULT_COMMITTED`, the router:

1. rechecks job workload/schema/policy against the frozen binding;
2. rejects adapter code-hash drift;
3. recomputes the canonical input commitment from the full input preimage;
4. recomputes the canonical output commitment from the full output preimage;
5. requires that output commitment to equal the strict worker evidence's stored `outputHash`;
6. requires strict worker assignment/result/receipt provenance to match the canonical job;
7. invokes the exact frozen adapter;
8. records positive or negative deterministic evidence.

The router deliberately leaves the job in `RESULT_COMMITTED`. CMP-1.4.4 remains responsible for canonical signed verdict provenance and any later verdict-to-job-state transition.

## Reference adapter

`ComputeIntegerSumSquaresAdapter420` implements the retained bounded integer workload:

`[x0,x1,x2,x3] -> x0² + x1² + x2² + x3²`

with each `uint64 <= 1,000,000,000`.

It retains the previously documented workload/profile/input/output/schema domains and serves as an executable reference for the generic interface. It does not claim correctness for arbitrary GPU, AI, probabilistic, scientific or externally dependent workloads.

## Authority separation

CMP-1.4.7 does not grant or exercise:

- verifier identity/lifecycle;
- verifier class/workload capability;
- verifier selection/appointment;
- signed verdict authority;
- job VERIFIED/FAILED transition;
- settlement or Vault movement;
- beneficiary/amount selection;
- stake/slash;
- worker/provider/resource lifecycle;
- governance substitution, validation, bridge or wallet authority.

## Level 1 qualification

Required:

1. affected Compute contracts compile;
2. retained `Compute*.t.sol` suite passes;
3. dedicated tests cover route publication, owner-only pre-execution binding, exact code hash/schema, positive/negative deterministic evaluation, tampered input/output, frozen-route upgrade safety, inactive/unknown routes and replay;
4. retained integer-profile tests remain green;
5. CMP-1.4.7 mechanical verifier passes;
6. focused Compute Market and Solidity workflows pass on the exact implementation SHA.

## Level 2 status

Level 2 is not required for CMP-1.4.7. The next sensible integration milestone is after CMP-1.4.8, when deterministic and scientific/probabilistic verification coexist and must remain semantically separated.

## Exit criteria

CMP-1.4.7 is COMPLETE only when every machine-readable exit criterion is satisfied and exact-head Level 1 qualification is green.

## Qualification evidence

Qualified implementation SHA: `ff8a4ca1e0d19f859be27a9718c8b768c99ea308`.

- Compute Market Qualification #38 — run `36809487492` — **success**
- Solidity Contracts #3480 — run `36809487506` — **success**
- Genesis Address Authority #300 — run `36809487464` — **success**
- 420Docs Qualification #3676 — run `36809487489` — **success**
- 420Indexer #1103 — run `36809487521` — **success**
- 420Registry REG-AUDIT-4 #135 — run `36809487500` — **success**

The implementation SHA includes the compatibility repair that preserves dispute handling for both legacy verified jobs with an all-zero verification-policy tuple and policy-bound jobs with a complete nonzero tuple; partial tuples remain fail-closed.

## Completion

**COMPLETE at Level 1.** Level 2 remains intentionally deferred to the CMP-1.4.8 deterministic/scientific verification integration milestone. Level 3 remains deferred to complete Compute app-phase closeout.
