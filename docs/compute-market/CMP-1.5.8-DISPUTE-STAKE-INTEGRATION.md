# CMP-1.5.8 — Dispute/stake integration

Status: **COMPLETE. LEVEL 1 + LEVEL 2 QUALIFIED.**

## Canonical definition

> Dispute/stake integration

CMP-1.5.8 connects the already-qualified Compute dispute lifecycle to the already-qualified ComputeStake objective slash path without collapsing those authorities.

The dispute system remains responsible for challenge, response, adjudication, appeal, finality and provider/payer economic disposition. ComputeStake remains responsible for collateral custody semantics, objective slash authorization, bounded amount calculation and slash distribution.

A dispute by itself does not authorize punishment.

## Repository gap closed by this step

Before CMP-1.5.8, two gaps remained between the qualified dispute and stake phases.

First, dispute review preserved the original verifier **address**, while verifier collateral is canonically keyed by a **verifierId**. The earlier CMP-1.5.5 verifier evidence adapter intentionally treated adverse review only as a candidate signal and used an address-derived subject reference. That was sufficient to prove the candidate boundary, but it was not sufficient for a production stake hand-off.

Second, verifier collateral withdrawal was blocked only after an objective slash authorization already existed. A verifier could therefore reach collateral maturity while a dispute was still active or between objective finality and slash authorization.

CMP-1.5.8 closes both gaps.

## Canonical verifier identity freeze

When CMP-1.5.8 wiring is bound, `ComputeDisputeResolution420.openDispute(...)` resolves the original verifier authority through the canonical `ComputeVerifierRegistry420`.

It freezes the resulting `verifierId` under the immutable dispute ID.

The dispute does not later recompute that verifier ID from a current authority mapping. This matters because verifier authority may rotate after the original verdict or during later protocol operation.

If bound CMP-1.5.8 wiring cannot resolve a canonical verifier identity, dispute opening fails closed.

Existing dispute deployments/tests that have not bound the optional CMP-1.5.8 integration retain their preexisting semantics; no live deployment/publication is claimed here.

## Stake-preservation hold

A bound verifier dispute increments a verifier-scoped stake-hold count.

`ComputeStakeVerifierCollateral420.withdraw(...)` now checks that dispute hold independently of the existing `outstandingSlash(positionId)` hold.

Therefore:

- an active dispute can preserve slashable verifier collateral;
- no active dispute can itself move or slash the collateral;
- multiple simultaneous verifier disputes cannot accidentally release one another's hold;
- requestExit remains allowed, but matured withdrawal remains blocked while the hold exists.

The hold is keyed to the verifier authority frozen in the dispute, not to a caller-selected recipient.

## Terminal disposition rules

Non-punitive terminal cases release the dispute stake hold automatically:

- provider win;
- claimant withdrawal;
- timeout;
- generic adverse disposition that is not the explicit objective verifier-error ground.

An objective stake candidate remains held only when all of the following are true:

- the dispute reaches `FINAL`;
- the provider/result loses;
- the frozen ground is `OBJECTIVE_VERIFIER_ERROR_GROUND`;
- CMP-1.5.8 canonical verifier identity was captured.

This preserves collateral between final dispute disposition and objective slash reservation without relabeling timeout, allegation or generic payer victory as misconduct.

## Objective stake evidence

`ComputeVerifierDisputeStakeEvidence420` is the CMP-1.5.8 production stake-evidence adapter.

Each deployment is bound to:

- one exact dispute engine;
- one immutable `stakePolicyId`.

For an evidence reference it requires:

- terminal `FINAL` disposition;
- explicit objective verifier-error ground;
- final disposition adverse to the original verification;
- provider/result loss;
- frozen canonical `verifierId`;
- nonzero original verifier, verification, result, evidence, decision and resolution references;
- independent initial adjudicator;
- if appealed, resolved appeal with a different appeal adjudicator and a nonzero appeal decision.

It outputs objective slash evidence whose:

- `subjectRef` is the frozen canonical verifier ID;
- `subjectAccount` is the original verifier authority;
- `stakePolicyId` is the adapter's immutable stake policy;
- verification-policy ID/revision/commitment are the original frozen dispute tuple.

This removes address-cast identity substitution and cross-policy ambiguity from the CMP-1.5.8 path.

## Atomic slash hand-off

`ComputeVerifierDisputeStakeIntegration420.authorizeFinalDispute(...)` performs the hand-off in one transaction:

1. require the dispute's stake disposition to be pending;
2. call the existing `ComputeStakeSlashAuthorization420.authorize(...)` path for verifier subject kind;
3. require a nonzero authorization reference and amount;
4. acknowledge that authorization back to the dispute engine;
5. only then release the dispute stake hold.

If step 2 fails for policy, identity, code hash, chronology, finality, replay, amount, distribution or any other reason, the whole transaction reverts and the stake hold remains.

Once authorization succeeds, the ordinary `outstandingSlash(positionId)` hold already exists before the dispute hold is released. There is therefore no withdrawal gap between dispute finality and slash reservation.

## Authority boundaries preserved

CMP-1.5.8 does not:

- let a claimant slash stake merely by opening a dispute;
- make timeout objective misconduct;
- make a generic payer win objective verifier fault;
- derive verifier identity from an address cast;
- let the dispute engine calculate slash amount;
- bypass the frozen slash-policy revision or code-hash checks;
- choose slash recipients;
- move payer escrow;
- rewrite provider/payer entitlement disposition;
- convert Trust/reputation into sanction authority;
- grant Governance arbitrary confiscation power;
- replace CMP-1.5.6 slash distribution.

The existing slash authorizer remains the only component that converts objective evidence into a bounded reserved sanction.

## Qualification

Focused CMP-1.5.8 tests cover:

- canonical verifier-ID binding in objective dispute evidence;
- immutable stake-policy binding;
- missing verifier ID rejection;
- generic/nonfinal dispute rejection;
- unresolved and non-independent appeal rejection;
- atomic slash hand-off;
- authorizer failure preserving pending stake disposition;
- nonpending dispute rejection;
- mature verifier withdrawal blocked by dispute stake hold;
- release of that hold permitting ordinary withdrawal again.

Existing retained Compute tests continue to cover dispute holds/finality, verifier lifecycle, collateral exit, objective slash authorization, slash distribution and replay/failure atomicity.

CMP-1.5.8 is a **Level 2 Compute app milestone** because it crosses dispute lifecycle, verifier identity, collateral and slash authority. Repository-wide Level 3 remains deferred to **CMP-1.5.13 — Phase closeout**.

## Exit criteria

CMP-1.5.8 is COMPLETE only when:

- canonical verifier identity is frozen for the dispute stake path;
- active dispute holds preserve verifier collateral without authorizing slash;
- non-objective terminal cases release the hold without sanction;
- objective adverse finality keeps collateral held until slash reservation succeeds;
- objective evidence binds exact verifier ID, authority, stake policy and verification-policy tuple;
- failed slash hand-off leaves the stake hold intact;
- successful hand-off creates the normal outstanding-slash hold before releasing the dispute hold;
- verifier collateral withdrawal enforces the dispute hold;
- payer escrow/settlement and slash-distribution authority remain separate;
- focused Level 1 qualification passes;
- retained Compute Level 2 qualification passes on the same exact implementation SHA;
- durable evidence records that SHA.

Next canonical step:

**CMP-1.5.9 — WorkerRegistry stake-source integration**


## Completion evidence

CMP-1.5.8 is **COMPLETE**.

Qualified implementation SHA:

`ceecba734b057c031f5e5a6ee8a9c91f84839ab8`

Exact-head qualification:

- Compute Market Qualification #125 — run `36973429348` — **PASS**;
- Solidity Contracts #4072 — Compute fast job `110733119601` — **PASS**;
- retained `Compute*.t.sol` app integration suite — **PASS**;
- CMP-1.5.8 mechanical verifier — **PASS**;
- 420Docs Qualification #4285 — **PASS**;
- 420Indexer #1671 — **PASS**;
- 420Registry REG-AUDIT-4 #688 — **PASS**;
- Genesis Address Authority #853 — **PASS**.

Durable machine-readable evidence:

`docs/compute-market/CMP-1.5.8-QUALIFICATION-EVIDENCE.json`

This closeout sequence is evidence/documentation-only relative to the qualified implementation SHA above. It does not modify executable source, tests, workflows, dependencies, configuration, interfaces, deployment state or generated/runtime artifacts.

Repository-wide Level 3 remains intentionally deferred to **CMP-1.5.13 — Phase closeout**.

Next canonical step:

**CMP-1.5.9 — WorkerRegistry stake-source integration**
