# CMP-6.3 — Contribution accounting

Status: **IMPLEMENTED; QUALIFICATION PENDING.**

## Canonical definition

> Verified work units, CPU/GPU hours, project credit and other policy-defined metrics.

CMP-6 provides application-layer incentives for verified useful computation. Compute rewards must not replace chain consensus.

CMP-6.3 creates typed, replay-safe accounting for verified contribution measurements without assigning reward rates or moving value.

## Purpose

CMP-6.3 answers:

> What verified contribution was measured, under which exact measurement policy, for which contributor, job, project and metric?

It does not answer:

> What is the contribution worth, which reward pool should pay it, whether a sponsor matches it, or when/how value is distributed?

Those remain CMP-6.4 through CMP-6.7.

## Measurement policy authority

`ComputeUsefulContributionPolicy420` is an append-only governance-controlled policy registry.

Each policy revision freezes:

- policy ID;
- metric kind;
- metric ID/unit identity;
- exact contribution source address;
- source runtime code hash;
- maximum accepted amount for one contribution;
- publication timestamp;
- revision;
- chain and policy-contract domain commitment.

A later policy revision does not rewrite prior measurement semantics.

The policy registry cannot record contributions or move value.

## Canonical metric classes

CMP-6.3 explicitly supports the roadmap's required metric families:

1. `METRIC_WORK_UNITS`;
2. `METRIC_CPU_MILLISECONDS`;
3. `METRIC_GPU_MILLISECONDS`;
4. `METRIC_PROJECT_CREDIT`;
5. `METRIC_CUSTOM` for other policy-defined metrics.

CPU/GPU time is stored in integer milliseconds rather than floating-point hours. Consumers may render hours by dividing by 3,600,000. This keeps on-chain arithmetic deterministic while preserving the roadmap's CPU/GPU-hour semantics.

`metricId` freezes the exact unit/scheme identity inside each policy. Metric-kind equality alone is not sufficient.

## Typed contribution evidence

An authorized source returns one exact final measurement tuple:

- CMP-6.2 gate ID;
- contributor;
- project reference;
- metric kind;
- metric ID;
- amount;
- observation timestamp;
- evidence commitment;
- final-measured flag.

The relay caller supplies none of those values.

Contribution sources may wrap canonical runtime receipts, scientific provenance, external credit/resource evidence or later specialized measurement adapters, but CMP-6.3 does not itself trust raw caller-supplied measurements.

## Verification prerequisite

A contribution can only be recorded while its CMP-6.2 gate returns `currentlyVerified == true`.

The gate is also resolved into its canonical job ID.

The contribution observation timestamp must not predate the gate. This prevents a later reward gate from retroactively blessing an unrelated earlier measurement.

If the job becomes disputed, verification evidence is revoked, or the CMP-6.2 gate otherwise becomes non-current, new contribution records fail closed.

Historical contribution records remain immutable evidence of what was accepted under the exact policy/gate state at record time; later economic action must still apply its own live gates.

## Replay and aggregation

Consumption is keyed by exact authorized source plus contribution reference.

Each contribution ID additionally commits to:

- chain;
- accounting contract;
- source and contribution reference;
- CMP-6.2 gate and canonical job;
- contributor;
- project;
- metric kind and metric ID;
- exact amount;
- observation timestamp;
- evidence commitment;
- policy ID/revision/commitment.

Accepted metrics aggregate independently by:

- contributor + metric;
- project + metric;
- job + metric;
- global metric.

Different metric IDs never share an accounting bucket.

## Authority boundaries

CMP-6.3 does not:

- mint native $420;
- replace consensus rewards;
- move Vault value;
- create, release, cancel, claim or withdraw Vault obligations;
- debit payer escrow;
- choose a reward beneficiary;
- assign a token-per-unit or other reward rate;
- consume a research reward pool;
- perform sponsor matching;
- implement anti-Sybil or anti-farming economics;
- settle a Compute job;
- validate workload correctness independently of CMP-6.2;
- treat a raw external credit/resource record as verified merely because it exists.

## Relationship to external contribution evidence

CMP-5 adapters already normalize project credit and resource-usage commitments, while CMP-5.7 attests external result identity and CMP-5.6 protects one-time external-work reward opportunity.

CMP-6.3 deliberately provides a typed measurement-accounting surface that later authorized source adapters may feed. It does not bypass CMP-5.6/CMP-5.7 or invent external truth.

## Qualification level

CMP-6.3 is an ordinary **Level 1** step.

CMP-6.2 already established the first CMP-6 Level 2 convergence milestone between funding and canonical verification. CMP-6.3 adds measurement/accounting authority behind that qualified gate but does not yet introduce pool allocation or monetary reward calculation.

A later meaningful integration boundary may trigger another Level 2 milestone. Repository-wide Level 3 remains deferred to **CMP-6.8 — Phase closeout**.

## Focused qualification

Coverage must prove:

- verified work-unit accounting;
- CPU-time accounting;
- GPU-time accounting;
- project-credit accounting;
- custom policy-defined metrics;
- metric classes and metric IDs remain isolated;
- only code-hash-pinned policy-authorized sources may provide measurements;
- policy revisions are append-only;
- contribution measurements must be final, non-zero and within policy cap;
- measurement policy kind/ID mismatches fail closed;
- CMP-6.2 current verification is mandatory;
- pre-gate measurements fail closed;
- exact source/reference replay fails closed;
- contributor/project/job/global aggregates remain exact;
- no reward-rate, payout, pool-debit, Vault, payer-escrow or consensus authority is introduced.

## Exit criteria

CMP-6.3 is COMPLETE only when:

- all canonical metric families are represented;
- other policy-defined metrics are supported without weakening type isolation;
- measurement sources are explicit, versioned and runtime-code pinned;
- caller cannot choose contributor/project/metric/amount;
- every accepted contribution references a currently verified CMP-6.2 gate;
- pre-gate, non-final, zero, over-cap and policy-mismatched measurements fail closed;
- replay cannot double count contribution totals;
- aggregate accounting remains deterministic and metric-separated;
- focused Level 1 tests and repository verifier pass;
- exact-head Compute Market qualification passes;
- durable repository evidence records the implementation SHA.

Durable evidence: [CMP-6.3 qualification](CMP-6.3-QUALIFICATION-EVIDENCE.md).

Next canonical step:

**CMP-6.4 — Research reward pools**
