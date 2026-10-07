# CMP-6.4 — Research reward pools

Status: **IMPLEMENTED; QUALIFICATION PENDING.**

## Canonical definition

> Research reward pools

Examples: cancer research, protein folding, climate simulation, astronomy, drug discovery.

CMP-6 provides application-layer incentives for verified useful compute. Compute rewards must not replace chain consensus.

CMP-6.4 introduces project-bound research reward pools that classify separately funded CMP-6.1 capital and identify compatible CMP-6.3 verified contribution records. It does not spend that capital.

## Canonical project authority

Research identity remains owned by `ComputeResearchProjectRegistry420`.

A pool can only be created by the canonical project owner and only against the exact current acceptable project revision and commitment. The pool freezes:

- project ID;
- project revision;
- project commitment;
- research domain;
- owner.

Later project revisions do not rewrite an existing pool.

The canonical roadmap examples are represented through the project registry's `researchDomain`, including cancer research, protein folding, climate simulation, astronomy and drug discovery. CMP-6.4 does not hard-code a closed list of scientific domains.

## Metric-policy binding

Every pool is also bound to one exact CMP-6.3 contribution-policy revision.

The pool freezes:

- policy ID;
- policy revision;
- policy commitment;
- metric kind;
- metric ID.

This prevents one research pool from silently accepting a different measurement scheme after creation.

## Pool funding

CMP-6.1 remains the sole source of useful-computation funding provenance.

The pool contract derives the CMP-6.1 `TARGET_POOL` key and reports the amount separately attributed to its pool ID.

`fundedAmount(poolId)` is reporting only.

CMP-6.4 cannot:

- deposit;
- reserve;
- debit;
- consume;
- withdraw;
- claim;
- transfer;
- or otherwise move pool funds.

## Contribution compatibility

`eligibleContribution(poolId, contributionId)` is a read-only classifier.

A contribution is compatible only when:

- the pool exists;
- the pool is accepting contributions;
- the pool has non-zero CMP-6.1 funding;
- the CMP-6.3 contribution exists;
- the contribution project matches the pool project;
- the contribution policy ID and revision match;
- the contribution policy commitment matches;
- the contribution metric kind and ID match;
- the contribution amount is non-zero.

CMP-6.3 already guarantees that accepted contribution records were created against a currently verified CMP-6.2 gate at record time.

Compatibility does **not** create a payout entitlement and does not consume pool capital.

## Pool admission control

The project owner may pause or resume contribution admission.

Changing acceptance does not mutate the pool's frozen project or metric semantics.

## Authority boundaries

CMP-6.4 does not:

- mint native $420;
- replace consensus rewards;
- move or reserve Vault value;
- create/release/cancel/claim Vault obligations;
- debit payer escrow;
- choose a payout amount;
- choose a payout beneficiary;
- perform sponsor matching;
- implement anti-Sybil / anti-farming economics;
- settle Compute jobs;
- alter CMP-6.2 verification state;
- alter CMP-6.3 contribution records;
- rewrite research project identity or history.

## Qualification level

CMP-6.4 is an ordinary **Level 1** step.

It composes already-established authorities without introducing a new value-moving lifecycle:

- CMP-4.2 project identity;
- CMP-6.1 pool funding provenance;
- CMP-6.3 contribution accounting.

The next meaningful broader app integration milestone should occur when a later step introduces sponsor matching or reward-allocation economics. Repository-wide Level 3 remains deferred to **CMP-6.8 — Phase closeout**.

## Focused qualification

Coverage must prove:

- distinct pools for the roadmap's example research domains;
- exact project revision and commitment freeze;
- exact policy revision and commitment freeze;
- metric kind/ID freeze;
- separately funded pool capital is reported without consumption;
- compatible CMP-6.3 contributions are recognized;
- project/policy/metric mismatches fail closed;
- stale project revisions cannot create pools;
- duplicate pool identity is rejected;
- only the project owner can control pool admission;
- paused or unfunded pools are not eligible for contribution classification;
- no reward amount, sponsor match, payout, Vault movement or consensus authority is introduced.

## Exit criteria

CMP-6.4 is COMPLETE only when:

- pool identity is bound to canonical research-project identity;
- exact project revision/commitment is immutable;
- exact contribution-policy revision/commitment is immutable;
- canonical research domains can create distinct pools;
- CMP-6.1 pool funding is observable without spend authority;
- CMP-6.3 contribution compatibility is deterministic and fail-closed;
- stale/replayed/mismatched pool state is rejected;
- focused Level 1 tests and repository verifier pass;
- exact-head Compute Market qualification passes;
- durable repository evidence records the qualified implementation SHA.

Durable evidence: [CMP-6.4 qualification](CMP-6.4-QUALIFICATION-EVIDENCE.md).

Next canonical step:

**CMP-6.5 — Sponsor matching**
