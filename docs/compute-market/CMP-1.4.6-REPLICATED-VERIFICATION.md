# CMP-1.4.6 — Replicated / N-of-M verification

Status: **IMPLEMENTATION COMPLETE; LEVEL 1 + LEVEL 2 QUALIFICATION PENDING. NO LIVE DEPLOYMENT/PUBLICATION CLAIM.**

## Canonical definition

> Support independent recomputation and quorum verification.

## Repository baseline and roadmap-order note

Baseline current `main`: `53b38901a2d7ead875eb606625ae99bf3c1e1069`.

CMP-1.4.5 is complete on this baseline. CMP-1.4.4 remains open; this step does **not** claim signed-verdict completion or contiguous completion of all earlier CMP-1.4 steps.

## Gap analysis

CMP-1.4.0 explicitly recorded that no existing primitive completed replicated / N-of-M verification. CMP-1.4.5 introduced a single independent-verifier selection path, but its one-live-appointment model intentionally does not represent a multi-member quorum.

The repository therefore lacked:

- an exact pre-execution verifier committee;
- an explicit N-of-M threshold;
- pairwise committee-controller independence;
- one-vote-per-member recomputation evidence;
- same-result vote aggregation;
- insufficient/split-quorum fail-closed behavior;
- a canonical quorum evidence reference that is not itself a verdict or settlement action.

The CMP-1.4.6 requirement was therefore missing.

## Implementation

`ComputeReplicatedVerification420` adds the canonical replicated-verification evidence layer.

### Committee freeze

The separately designated selection authority freezes the committee while the job is still `ACCEPTED`, after its exact verification policy has been bound and before worker execution starts.

The committee binds:

- chain ID and replicated-verification contract;
- job ID and accepted job revision;
- exact workload class;
- verification profile ID;
- accepted verification-policy ID, revision and commitment;
- reviewed committee-selection evidence commitment;
- explicit threshold `N`;
- committee size `M`;
- exact verifier IDs, verifier revisions, authorities and controller IDs;
- expiry.

V1 bounds `M` to 2–16 and requires `2 <= N <= M`.

### Member eligibility

Every committee member must be:

- the exact current ACTIVE verifier revision in `ComputeVerifierRegistry420`;
- qualified for the exact workload as both `INDEPENDENT_VERIFIER` and `COMMITTEE_VERIFIER`;
- directly distinct from job owner, actual payer, matched operator and selection authority;
- backed by a current non-suspended controller attestation;
- controller-independent from owner, payer and operator;
- controller-distinct from every other committee member.

The exact owner, payer and operator controller IDs are frozen into the committee record and revalidated when every recomputation vote is cast. Later party-controller drift therefore invalidates new votes rather than silently converting an independent committee into a conflicted one.

Duplicate verifier IDs, duplicate authority addresses and duplicate controller IDs fail closed.

### Independent recomputation

The committee is frozen before execution, but votes cannot be submitted until the canonical job reaches `RESULT_COMMITTED`.

Each frozen member may submit exactly one pair:

- nonzero result commitment;
- nonzero recomputation-evidence commitment.

The vote is domain-separated and bound to job, committee, verifier identity/revision and result/evidence commitment.

### Quorum

Votes aggregate only by exact result commitment.

A quorum finalizes only when at least `N` distinct committee members attest the **same** result commitment. Split votes remain auditable but do not combine. After quorum finalization, further votes fail closed.

A quorum result may agree with or conflict with the worker's committed result. CMP-1.4.6 deliberately records the replicated evidence without converting that evidence into PASS/FAIL/INCONCLUSIVE or a job-state transition.

## Authority separation

Replicated quorum evidence is not:

- a signed verdict;
- a correctness verdict by itself outside the frozen verification method;
- a `ComputeJobRegistry420` transition;
- settlement or Vault authority;
- beneficiary or amount selection;
- worker/provider/resource mutation;
- stake/slash authority;
- governance, validator, bridge or wallet authority.

CMP-1.4.4 remains responsible for canonical signed verdict provenance. CMP-1.4.7 remains responsible for deterministic verification adapters that define objective recomputation semantics.

## Security and invariant disposition

This step preserves CMP-INV-005, 014, 016, 017, 020, 023, 025, 026, 027 and 030.

In particular:

- committee selection does not mint unrelated authority;
- vote and quorum references are domain-separated;
- quorum is not correctness by signature/majority alone outside the preaccepted method;
- frozen verification policy cannot be rewritten by later configuration;
- suspension blocks new voting without rewriting historical votes;
- committee/vote/quorum state remains reconstructable;
- no AI dependency is introduced.

No fixed Genesis predeploy, live deployment, ProtocolRegistry publication, Vault grant, settlement grant or stake/slash grant is introduced.

## Level 1 qualification

Required:

1. affected Compute Solidity compiles;
2. retained `Compute*.t.sol` suite passes;
3. dedicated tests cover exact 2-of-3 success, insufficient quorum, split results, duplicate member/controller rejection, missing committee capability, job-party-controlled selector rejection, unauthorized committee freeze, voting before result commitment, party-controller drift, unauthorized voters, duplicate votes, suspended verifier and post-finalization rejection;
4. CMP-1.4.6 mechanical verifier passes;
5. focused Compute Market and Solidity workflows are green on the exact implementation SHA.

## Level 2 milestone

CMP-1.4.6 is the documented selector/quorum integration boundary.

Level 2 therefore requires the retained full Compute Market Solidity suite on the same implementation head, validating accumulated verifier lifecycle, capability, policy, selection and quorum behavior together.

Repository-wide 420 Integrated/Geth/fault/soak/Genesis inventories remain deferred unless independently required by a changed dependency.

## Exit criteria

CMP-1.4.6 is COMPLETE only when every machine-readable exit criterion is satisfied and exact-head Level 1 + Level 2 qualification is green.

## Completion

**NOT YET COMPLETE.** Implementation and evidence artifacts are present; exact-head Level 1 and Level 2 qualification remain pending.
