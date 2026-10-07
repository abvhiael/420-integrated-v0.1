# CMP-6.2 — Verification-gated rewards

Status: **IMPLEMENTED; QUALIFICATION PENDING.**

## Canonical definition

> Verification-gated rewards

CMP-6 provides application-layer incentives for verified useful compute. Compute rewards must not replace chain consensus.

CMP-6.2 adds the canonical verification gate between CMP-6.1 funding and later CMP-6 reward economics. It does not calculate rewards, choose beneficiaries, release funds or replace the Compute verification system.

## Purpose

CMP-6.2 answers:

> Has a funded useful-computation job reached the canonical VERIFIED state under the exact verification evidence currently bound to that job?

It does not answer:

> How much should be rewarded, which policy metric applies, which research pool pays, whether sponsors match, or how payout occurs?

Those remain CMP-6.3 through CMP-6.7.

## Canonical verification authority

CMP-6.2 reuses the existing Compute JobRegistry verification path:

- the job must be in `VERIFIED`;
- the expected job revision must match;
- the job must carry a non-zero result commitment;
- the job must carry a non-zero verification reference;
- the job must carry a non-zero verifier;
- the JobRegistry-bound `IComputeJobVerificationEvidence420` source must still return `verified(..., true)` for that exact job/result/verifier/decision tuple.

CMP-6.2 does not publish verification policy, appoint verifiers, evaluate results or accept self-asserted verification.

## Funding prerequisite

A reward gate may only be created for a CMP-6.1-funded `TARGET_JOB`.

The gate snapshots the aggregate funded amount for that job at gating time. This amount is evidence of available CMP-6.1 funding provenance only. It is **not** the reward amount and grants no spending authority.

## Gate identity

Each accepted job receives at most one immutable gate commitment binding:

- chain;
- CMP-6.2 contract;
- CMP-6.1 funding contract;
- JobRegistry;
- job ID;
- exact verification reference;
- exact result commitment;
- exact verifier;
- exact job revision;
- CMP-6.1 funded snapshot.

The caller cannot supply a beneficiary or reward amount.

## Current verification semantics

`currentlyVerified(gateId)` is intentionally live/fail-closed.

A historical gate remains recorded, but it is not currently actionable unless the canonical job still:

- remains in `VERIFIED`;
- retains the exact gated verification reference;
- retains the exact gated result commitment;
- retains the exact gated verifier;
- and the bound verification evidence still confirms approval.

Therefore a later dispute, failure, verification revocation or identity drift cannot silently remain reward-ready.

A provider-favourable dispute resolution may restore the job to `VERIFIED`, but later payout logic must still evaluate the live CMP-6.2 gate at the time it acts.

## External computation boundary

CMP-5.7 owns external-result attestation and CMP-5.6 owns one-time external-work consumption.

CMP-6.2 does not silently map external canonical work into a research reward pool. That mapping belongs with later CMP-6 pool/economic policy, especially CMP-6.4, where the sponsor/research-pool target can be defined explicitly without conflating an external-work identity with a funding-pool identity.

## Authority boundaries

CMP-6.2 does not:

- mint native $420;
- call or replace consensus rewards;
- move Vault value;
- create/release/cancel/claim Vault obligations;
- withdraw CMP-6.1 funding;
- debit payer escrow;
- settle Compute jobs;
- select or appoint verifiers;
- evaluate workload correctness;
- choose a beneficiary;
- choose or calculate a reward amount;
- consume CMP-5 external work;
- define contribution metrics;
- define research reward pools;
- perform sponsor matching;
- implement anti-Sybil economics.

## Qualification level

CMP-6.2 is the **first CMP-6 Level 2 integration milestone**.

Reason: it is the first point where two independently qualified CMP authorities converge:

1. CMP-6.1 canonical useful-computation funding; and
2. the canonical JobRegistry verification lifecycle.

Level 1 covers the changed contract, focused negative/adversarial tests, repository verifier, compilation and directly applicable checks.

Level 2 uses the retained Compute Market application suite on the same exact implementation SHA because funding and verification lifecycle now converge.

Repository-wide Level 3 remains deferred to **CMP-6.8 — Phase closeout**.

## Focused qualification

Coverage must prove:

- a funded canonical VERIFIED job can create one gate;
- unfunded jobs cannot create a gate;
- RESULT_COMMITTED or other non-VERIFIED states fail closed;
- stale job revisions fail closed;
- rejected/unproven verification evidence fails closed;
- duplicate gate creation fails closed;
- gate identity freezes result/verifier/verification reference;
- dispute transition makes the live gate non-actionable;
- verification evidence revocation makes the live gate non-actionable;
- exact restoration of canonical approved verification can restore live eligibility;
- result, verifier or verification-reference drift fails closed;
- no beneficiary or reward amount is caller-controlled;
- no payout/custody/settlement/consensus authority is introduced.

## Exit criteria

CMP-6.2 is COMPLETE only when:

- CMP-6.1 funded-job provenance is required;
- canonical JobRegistry VERIFIED state is required;
- the bound verification evidence source independently confirms the exact approved tuple;
- one immutable gate is created at most once per job;
- live dispute/evidence/identity drift invalidates current eligibility;
- no reward amount or beneficiary is selected;
- no Vault movement or job settlement occurs;
- focused Level 1 qualification passes;
- retained Compute Market Level 2 qualification passes on the same exact implementation SHA;
- durable repository evidence records the qualified SHA.

Next canonical step:

**CMP-6.3 — Contribution accounting**
