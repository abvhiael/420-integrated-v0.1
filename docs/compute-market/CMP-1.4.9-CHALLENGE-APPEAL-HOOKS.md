# CMP-1.4.9 — Challenge and appeal hooks

Status: **IMPLEMENTATION COMPLETE; LEVEL 1 + LEVEL 2 QUALIFICATION PENDING. NO LIVE DEPLOYMENT/PUBLICATION CLAIM.**

## Canonical definition

> Integrate verifier decisions with dispute holds and later stake/slash adjudication.

The shorthand “Connect disputed results to the dispute layer” describes the same intent, but the canonical roadmap wording above remains authoritative.

## Repository baseline and gap analysis

Baseline current `main`: `cbff831984df5d57540a26c879663cf95bcf61c9`, containing qualified CMP-1.4.8.

CMP-1.4.4 remains open. CMP-1.4.9 therefore preserves the verification tuple that the current canonical job already recorded, but does not claim the still-open minimum signed-verdict binding work is complete.

The repository already had a real dispute engine from CMP-1.2.6:

- authorized challenge within an accepted challenge window;
- contested provider-entitlement hold;
- claimant/respondent roles;
- independent adjudicator authorization;
- a different adjudicator for appeal;
- bounded response, decision and appeal windows;
- provider-win, payer-win, withdrawal and fail-closed timeout resolution;
- exact payer/provider Vault-liability isolation;
- immutable dispute snapshots of `verificationRef`, `resultCommitment`, verifier and verification-policy tuple.

It also had a minimal `verificationDisputeDisposition()` final-state getter. What CMP-1.4.9 lacked was a complete verifier-facing projection of active challenge/appeal state and an explicit, bounded hand-off signal for later stake/slash adjudication.

## Implementation

### Verification review hook

`ComputeDisputeResolution420.verificationReview(disputeId)` returns a read-only `VerificationReview` derived from the authoritative `DisputeCase`.

It exposes:

- original job, verification reference, result commitment and verifier;
- original verification-policy ID/revision/commitment;
- challenge grounds and evidence commitment;
- claimant/respondent;
- response commitment;
- initial adjudicator and decision commitment;
- appeal commitment, appeal adjudicator and appeal decision commitment;
- response/decision/appeal deadlines;
- authoritative case status and resolution reference;
- whether the contested verification is currently held;
- whether the case is final;
- whether final disposition is adverse to the originally approved verification.

The hook never writes case state.

### Job-scoped hold hook

`verificationHoldForJob(jobId)` returns the dispute ID, active-hold bit and the immutable original verification identity/policy tuple.

A job with no dispute returns an empty, non-held tuple. Once a dispute exists, the original verification provenance remains queryable after finality; only the hold bit changes.

### Hold semantics

A verification is actively held only while case status is:

- `OPEN`;
- `RESPONDED`;
- `DECIDED`;
- `APPEALED`.

The hold clears only after:

- `FINAL`;
- `WITHDRAWN`;
- `TIMED_OUT`.

This mirrors the existing provider-release gate and does not create a second source of dispute truth.

### Later stake/slash hand-off

`adverseToOriginalVerification` is true only when:

1. the dispute has reached a terminal disposition; and
2. the final result is adverse to the provider/result that had previously been approved.

This is intentionally a **candidate signal only**.

It does not establish verifier fault, does not name a slash amount or recipient, and does not call a stake contract. A later CMP-1.5 slash path must independently verify the exact policy, objective evidence, subject, authorization, finality and bounded sanction. An allegation, active dispute or inconclusive/nonfinal review cannot authorize punishment.

Withdrawal or provider-win finality is not labeled adverse.

## Original-verdict immutability

Challenge and appeal never delete, replace or flip the original verification record.

The tests capture the original canonical job verification tuple before opening a dispute, then prove the same `verificationRef`, result commitment, verifier and policy identity survive:

- challenge opening;
- response;
- initial decision;
- appeal;
- appeal decision;
- final resolution.

The dispute outcome may determine economic disposition through the existing qualified settlement layer, but it does not retroactively rewrite what the original verifier decided.

## Authority and privacy boundaries

CMP-1.4.9 grants no:

- Vault custody or arbitrary withdrawal;
- beneficiary/amount selection;
- settlement execution through the new hooks;
- stake/slash execution;
- verifier identity/capability/appointment;
- worker/provider/resource authority;
- governance, validator, bridge or wallet authority.

The hook exposes bounded commitments and chronology. Raw private dispute evidence remains off-chain under the accepted evidence-access policy.

## Level 1 qualification

Required on one exact implementation SHA:

1. affected Compute contracts compile;
2. focused challenge/appeal-hook tests pass;
3. existing dispute hold, payer/provider resolution, timeout, withdrawal and appeal tests remain green;
4. mechanical CMP-1.4.9 verifier passes;
5. focused Compute Market and Solidity workflows pass.

## Level 2 milestone

CMP-1.4.9 is the **CMP-1.4 verifier-dispute lifecycle integration** milestone because verifier provenance now feeds the shared dispute/entitlement lifecycle.

Level 2 requires the retained Compute Market Solidity suite on the same implementation SHA, covering verifier methods, dispute holds, appeal finality, payer/provider economic isolation, replay/failure paths and authority separation.

No repository-wide Level 3 reconciliation is required here.

## Invariant disposition

This step preserves CMP-INV-005, 009, 010, 013, 014, 016, 017, 018, 020, 022, 024, 025, 026, 027 and 030.

In particular:

- challenge evidence cannot become correctness or slash proof by assertion;
- verification semantics remain bound and historical;
- unsettled contested earnings remain held;
- duplicate settlement remains impossible through the existing entitlement path;
- stake sanctions remain unavailable without later objective policy-bound authorization;
- private evidence bytes are not made canonical plaintext;
- final review state remains reconstructable;
- non-AI workloads remain first-class.

## Exit criteria

CMP-1.4.9 is COMPLETE only when every machine-readable exit criterion passes and Level 1 plus the verifier-dispute Level 2 milestone are green on the same exact implementation SHA.

## Completion

**NOT YET COMPLETE.** Implementation and durable evidence are present; exact-head qualification remains pending.
