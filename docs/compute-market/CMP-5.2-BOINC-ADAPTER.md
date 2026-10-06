# CMP-5.2 — BOINC adapter

Status: **COMPLETE — LEVEL 1 + FIRST CMP-5 LEVEL 2 EXACT-HEAD QUALIFIED ON `f463deb41f5e9de396a81d5ffbe0fc205c72f5a0`.**

Canonical roadmap step: **CMP-5.2 — BOINC adapter**.

## Purpose

CMP-5.2 adds the second external distributed-compute family and normalizes externally supplied BOINC contribution material into stable 420Integrated commitments.

It does not claim that a BOINC project accepted or credited the record. External truth remains outside the adapter until CMP-5.7.

## Shared external-adapter surface

CMP-5.2 introduces `IComputeExternalContributionAdapter420`, limited to:

- adapter kind;
- external-system identity;
- protocol commitment.

The already-qualified CMP-5.1 Folding-at-home adapter is reconciled to this interface without changing its contribution or record commitment semantics.

The shared surface creates interoperability for later CMP-5 consumers without creating a registry, verifier, reward, settlement, stake/slash, or duplicate-prevention authority.

## BOINC normalized record

`ComputeBoincAdapter420.BoincRecord` binds:

- project identity commitment;
- application commitment;
- work-unit commitment;
- participant identity commitment;
- optional host identity commitment;
- assignment commitment;
- result commitment;
- issue timestamp;
- report deadline;
- reported timestamp;
- granted credit;
- evidence commitment.

Raw account names, host identifiers, project URLs, RPC credentials, result files and private service data remain off-chain.

## Contribution identity and record commitment

The stable contribution identity binds external system, project, work unit, participant, optional host and assignment.

The full record additionally binds application, result, timing, credit and evidence.

Application/result/credit observations therefore cannot manufacture a new contribution identity.

Zero granted credit remains normalizable because CMP-5.2 records external state; it does not decide reward eligibility. A host commitment may be omitted where host identity is unavailable or intentionally privacy-minimized, while all remaining bindings stay mandatory.

## Validation and failure behavior

The adapter rejects missing project/application/work-unit/participant/assignment/result/evidence commitments, zero issue time, report deadlines before issue time, and reports timestamped before issue time.

A report later than the external deadline is not rejected solely by the normalizer; later attestation/policy must decide the significance of that fact.

## Authority boundaries

CMP-5.2 does not:

- query a BOINC project or RPC service;
- authenticate project-server truth;
- establish scientific correctness;
- create canonical CMP verification state;
- reserve/release/settle/refund Vault value;
- create reward entitlement;
- slash stake;
- prevent duplicate rewards;
- grant governance, bridge, wallet, validator or scheduler authority.

CMP-5.6 owns **double-reward prevention**.  
CMP-5.7 owns **external-result attestation**.  
CMP-6 owns useful-computation reward economics.

## Level 2 milestone

CMP-5.1 explicitly deferred Level 2 until multiple external adapter families converged. CMP-5.2 introduces the second family and the shared provider-neutral adapter identity interface, so it is the first CMP-5 Level 2 integration milestone.

Required exact-head qualification therefore includes:

- affected Compute contract build;
- dedicated BOINC tests;
- cross-adapter Folding/BOINC integration tests;
- retained `Compute*.t.sol` suite;
- verifier compilation and CMP-5.1/CMP-5.2 mechanical verifiers;
- exact-head Compute Market Qualification.

Repository-wide Level 3 remains deferred to CMP-5.8.

## Exit criteria

CMP-5.2 is complete when one exact implementation SHA satisfies every machine-readable exit criterion and the retained app-specific qualification suite passes.

## Next canonical step

**CMP-5.3 — Research-cluster adapter**


## Qualification evidence

- exact implementation SHA: `f463deb41f5e9de396a81d5ffbe0fc205c72f5a0`;
- base/main SHA: `721a7f358e802bce91835851721eb93c4340f501`;
- Compute Market Qualification #446 / run `37518847675` / job `112459253007` — **SUCCESS**;
- exact-head verification — PASS;
- Compute Market build — PASS;
- retained `Compute*.t.sol` suite — PASS;
- verification-script compilation — PASS;
- CMP-5.1 verifier — PASS;
- CMP-5.2 verifier — PASS;
- first CMP-5 Level 2 retained app-integration milestone — PASS;
- Solidity Contracts #5173 compute-fast / run `37518847861` / job `112459015467` — **SUCCESS**;
- full repository Foundry inventory — correctly deferred to CMP-5.8 Level 3.

Durable evidence: [CMP-5.2 qualification evidence](CMP-5.2-QUALIFICATION-EVIDENCE.md).
