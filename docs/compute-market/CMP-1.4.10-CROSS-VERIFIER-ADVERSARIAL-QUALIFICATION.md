# CMP-1.4.10 — Cross-verifier adversarial qualification

Status: **COMPLETE — LEVEL 1 + LEVEL 2 QUALIFIED. NO LIVE DEPLOYMENT/PUBLICATION CLAIM.**

## Canonical definition

> Cover forged/replayed verdicts, stale policy, wrong job/worker/attempt, verifier collusion, authority drift and failure atomicity.

The user shorthand “false verifier, colluding verifier, replayed verdict, altered output, wrong worker, wrong job, stale policy, etc.” is treated as examples of the canonical threat classes above.

## Repository baseline

Baseline `main`: `9465fba9249f41a879e227c09f362f4f6a3f6c87`, containing qualified CMP-1.4.9.

CMP-1.4.4 remains open. CMP-1.4.10 qualifies the current accumulated verifier architecture adversarially; it does not silently mark the separate signed-verdict minimum-binding roadmap step complete.

## Gap analysis

The repository already had substantial hostile tests distributed across verifier components, but there was no single CMP-1.4.10 artifact proving that every canonical threat class remained covered across the accumulated verifier stack.

One concrete coverage weakness was tightened: stale/duplicate verification-policy rebinding was rejected, but the test did not explicitly prove that rejection left the frozen policy tuple and job revision unchanged. CMP-1.4.10 now asserts that failure atomicity directly.

No production verifier contract change was required by the gap analysis.

## Threat campaign

### Forged or false verifier

Qualified by hostile signature/field tests plus the real independence gate and independent-selector controls.

A forged signature, job owner, worker, payer, outsider or self-selected verifier cannot create a canonical accepted verdict merely by possessing another capability.

### Replayed verdict or wrong domain

Verdict nonce replay, duplicate submission, expiry and changed-chain/domain replay fail closed. Rejection does not burn a nonce that belongs to an invalid verdict or release payer backing.

### Wrong job, result, assignment or altered output

The signed verdict path rejects wrong request, manifest, match, assignment and result commitments. Deterministic/scientific adapters separately reject tampered inputs, output preimages, seed/proof evidence and cross-job/profile substitution.

A valid verifier signature cannot repair a mismatched canonical worker result.

### Wrong worker or wrong attempt

Authoritative WorkerSnapshot qualification rejects:

- wrong worker revision;
- wrong resource/operator;
- cross-job and cross-worker execution-signature replay;
- stale or duplicate attempt replay;
- wrong attempt transition signatures and duplicate close.

The verifier path binds the canonical assignment reference rather than accepting caller-selected worker/attempt metadata.

### Stale policy

Verification policy is frozen before execution. Later policy publication does not rewrite the accepted job.

Stale revision and duplicate rebind attempts fail closed, and CMP-1.4.10 now explicitly checks that rejected rebinding leaves:

- job revision;
- policy ID;
- policy revision;
- policy commitment

unchanged.

Deterministic and scientific adapter upgrades likewise cannot rewrite a frozen accepted route.

### Verifier collusion and friendly selection

Shared-controller aliases against owner, payer or operator fail independence checks.

Replicated verification rejects duplicate/shared-controller committees and counts quorum only for independently qualified members voting for the same result. Split votes do not magically combine into quorum.

### Authority drift

Current-eligibility gates fail closed under:

- verifier identity withdrawal/suspension;
- appointment revocation;
- attestor/selector rotation;
- party-controller drift;
- committee-member suspension;
- canonical wiring authority drift.

Historical records remain reconstructable without turning stale authority into current authorization.

### Cross-method substitution and replay

Scientific adapters cannot be published as deterministic adapters and vice versa.

Deterministic/scientific evaluations are single-use and cannot be replayed into a second evidence outcome.

### Challenge/appeal authority confusion

Unauthorized/interested adjudicators cannot resolve held cases.

Challenge and appeal preserve the original verifier provenance and cannot themselves create stake/slash authority or bypass the held entitlement.

### Failure atomicity and economic isolation

Rejected hostile verification actions must leave canonical state unchanged except explicitly permitted audit evidence.

Retained tests assert no:

- invalid job transition;
- decision insertion;
- improper nonce consumption;
- payer-reserve release;
- cross-job entitlement reuse;
- cross-payer liability bleed;
- frozen-policy mutation.

## Level 1 qualification

Level 1 requires on one exact implementation SHA:

1. Compute contracts compile;
2. strengthened stale-policy failure-atomicity test passes;
3. all mapped adversarial test functions remain present;
4. the CMP-1.4.10 mechanical threat-matrix verifier passes;
5. focused Compute Market and directly applicable Solidity qualification pass.

## Level 2 milestone

CMP-1.4.10 is the **CMP-1.4 cross-verifier adversarial integration** milestone.

The complete retained Compute Market Solidity suite must pass on the same exact implementation SHA because this step spans signed verdicts, policy binding, worker evidence, independent selection, quorum, deterministic/scientific adapters, dispute hooks and economic isolation.

This is not Level 3 repository-wide closeout.

## Invariant disposition

CMP-1.4.10 directly or transitively exercises CMP-INV-005, 009, 010, 013, 014, 016, 017, 018, 020, 022, 023, 024, 025, 026, 027 and 030.

The campaign specifically reinforces that verifier identity does not imply unrelated authority, signatures alone do not prove correctness, verification semantics are versioned and frozen, duplicate earning is blocked, dispute/stake boundaries remain separate, and rejected hostile paths preserve historical reconstruction and economic isolation.

## Limitations

This step does not create live deployment evidence, fixed Genesis addresses, ProtocolRegistry publication, secure confidential-compute guarantees or objective CMP-1.5 slash execution.

It also does not close CMP-1.4.4. The adversarial campaign can only qualify the bindings actually implemented in the current repository.

## Exit criteria

CMP-1.4.10 is COMPLETE only when every machine-readable exit criterion passes and Level 1 plus the cross-verifier Level 2 retained Compute suite are green on the same exact implementation SHA.

## Qualification evidence

Qualified implementation SHA: `edeba8393ab1ec2b2b247cdb5b658a3f4b060e32`.

- Compute Market Qualification #65 — run `36877413661` — **success**
- Solidity Contracts #3584 — run `36877413569` — **success**
- Genesis Address Authority #392 — run `36877413171` — **success**
- 420Registry REG-AUDIT-4 #227 — run `36877413240` — **success**
- 420Docs Qualification #3784 — run `36877413545` — **success**
- 420Indexer #1200 — run `36877413248` — **success**

The same exact implementation SHA passed the CMP-1.4.10 Level 1 adversarial qualification and the Level 2 cross-verifier integration milestone.

## Completion

**COMPLETE at Level 1 and the CMP-1.4 cross-verifier adversarial Level 2 milestone.** Level 3 remains intentionally deferred to complete Compute app-phase closeout. This documentation update is evidence-only and does not require recursive qualification reruns.
