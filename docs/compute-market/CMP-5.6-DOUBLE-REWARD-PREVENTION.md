# CMP-5.6 — Double-reward prevention

Status: **IMPLEMENTATION COMPLETE — LEVEL 1 + THIRD CMP-5 LEVEL 2 EXACT-HEAD QUALIFICATION PENDING.**

Canonical roadmap step: **CMP-5.6 — Double-reward prevention**.

## Purpose

CMP-5.6 prevents the same canonical external work from becoming more than one 420 reward opportunity.

CMP-5.5 deliberately allowed multiple proof and credit records to describe one external contribution. CMP-5.6 adds the one-time stateful consumption boundary that those records previously lacked.

The guard does not decide whether external work is true or rewardable. It only enforces uniqueness once an authorized consumer supplies a canonical external-work commitment.

## Canonical claim identity

`ComputeExternalDoubleRewardGuard420.claimKeyFor()` derives one chain-scoped claim key from:

- the CMP-5.6 claim domain;
- current chain ID;
- the exact guard contract;
- one nonzero canonical external-work commitment.

The claim key deliberately excludes:

- proof ID;
- credit ID;
- reward reference;
- evidence commitment;
- external adapter/source wrapper.

Therefore alternate proof, credit, evidence, reward-reference or adapter wrappers cannot manufacture a second claim for the same canonical work commitment.

## External source evidence

Each successful consumption also records the CMP-5.5 provider-neutral `sourceBinding` derived from:

- adapter kind;
- external system ID;
- external contribution ID.

This preserves audit provenance while keeping source wrappers out of the uniqueness key.

## Front-run safety

Claim consumption is not permissionless.

Governance may authorize deployed consumer contracts only. Authorization pins the consumer runtime code hash, and every consumption rechecks that code hash. EOAs, unapproved contracts, revoked consumers and replaced runtime code fail closed.

This prevents an arbitrary caller from front-running a legitimate reward path and permanently burning an external-work claim.

## One-time consumption

The first authorized consumption stores:

- claim key;
- canonical external-work commitment;
- CMP-5.5 source binding;
- reward reference;
- evidence commitment;
- consuming contract;
- consumption timestamp.

A second consumption of the same canonical-work commitment reverts regardless of changed source, proof/credit representation, reward reference or evidence.

Distinct canonical-work commitments remain independently consumable.

## Authority boundaries

CMP-5.6 does **not**:

- attest external truth;
- decide whether external work was actually performed;
- decide reward eligibility;
- calculate reward amount;
- mint or transfer assets;
- create or release Vault obligations;
- mutate collateral;
- slash stake;
- validate proof semantics;
- issue external credit.

CMP-5.7 owns **external-result attestation and the authoritative mapping into canonical external-work identity**.

CMP-6 owns **useful-computation reward economics and payout integration**.

## Relationship to existing reward replay protection

Existing `ComputeStakeRewardAccounting420` already prevents replay of one exact authorized internal reward source/reference pair.

CMP-5.6 covers a different problem: preventing one external work identity from being represented by alternate proof/credit/source wrappers and rewarded again through a later external-compute reward path.

No existing stake-reward accounting authority is modified.

## Qualification milestone

CMP-5.6 is Level 1 for its implementation and the **third CMP-5 Level 2 milestone** because it introduces the shared stateful one-time-consumption authority that all later external reward integration must respect.

Required exact-head qualification includes:

- Compute contract build;
- dedicated one-time-consumption tests;
- cross-proof/credit/source replay tests;
- authorization, revocation and front-run tests;
- fail-closed zero/invalid-binding tests;
- retained Compute Solidity suite;
- verifier compilation;
- retained CMP-5.1 through CMP-5.5 verifiers;
- CMP-5.6 mechanical verifier.

Repository-wide Level 3 remains reserved for CMP-5.8.

## Exit criteria

CMP-5.6 is complete only when one exact implementation SHA satisfies every machine-readable exit criterion and the required Level 1 + app-focused Level 2 qualification passes.

## Limitations

The guard does not itself prove that two external representations refer to the same real-world computation. The canonical-work commitment supplied by an authorized consumer is the uniqueness identity enforced here. CMP-5.7 must establish the trustworthy external-result mapping into that identity.

Live reward-consumer deployment and ProtocolRegistry publication remain future deployment/testnet work.

## Next canonical step

**CMP-5.7 — External-result attestation**
