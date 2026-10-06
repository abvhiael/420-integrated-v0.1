# CMP-4.8 — Publication / retention policy

Status: **COMPLETE — LEVEL 1 EXACT-HEAD QUALIFIED ON `fae498b72b2693f4264df3f208ebbe6a1e1d44bf`.**

Canonical roadmap step: **CMP-4.8 — Publication / retention policy**.

CMP-4.8 adds a versioned, project-authorized publication and retention policy commitment layer over canonical CMP-4.7 scientific metadata/lineage records.

It does **not** store, retrieve, publish, delete or custody raw metadata, datasets, results, receipts or evidence.

## Existing authority boundaries

CMP-0.10 already requires raw instructions, datasets, outputs, proofs revealing private inputs, credentials and unredacted logs to remain off-chain by default. Public protocol state should contain bounded identities, commitments, policy versions and minimally necessary references.

CMP-3.10 already binds uploaded evidence objects to privacy/access/retention/provenance semantics at the worker upload boundary.

CMP-4.8 therefore records the scientific project's canonical publication/retention intent for a CMP-4.7 lineage object; off-chain storage/access systems remain responsible for enforcing the committed policy on bytes they actually control.

## Policy identity and publisher authority

Each canonical CMP-4.7 lineage object can have one deterministic CMP-4.8 policy identity bound to:

- chain ID;
- CMP-4.8 registry;
- exact CMP-4.7 registry;
- lineage ID;
- lineage provenance ID;
- scientific work-unit commitment;
- project-authenticated CMP-4.7 publisher.

Only the publisher already authenticated by CMP-4.7 may create or revise that lineage policy.

A policy revision never changes lineage, scientific work-unit identity or publisher.

## Publication modes

CMP-4.8 defines three nonempty publication modes:

- **PRIVATE** — no publication-manifest commitment and no embargo timestamp; publication authorization is always false;
- **RESTRICTED** — requires a publication-manifest commitment and access-policy commitment; disclosure may be limited by the committed off-chain access rules;
- **PUBLIC** — requires a publication-manifest commitment and explicitly authorizes public disclosure when temporal gates are satisfied.

Every mode requires nonzero access-policy and retention-policy commitments so privacy and retention semantics are never implicit.

A publication-manifest commitment binds the exact off-chain disclosure package/schema/content semantics. The contract does not dereference or validate mutable URLs.

## Embargo and retention

`notBefore` is an optional embargo timestamp for RESTRICTED/PUBLIC publication.

`retainUntil` is either:

- zero — committed indefinite retention; or
- a future timestamp later than any embargo timestamp.

`isPublicationAuthorized(policyId)` fails closed when:

- the policy is private or inactive;
- the underlying CMP-4.7 lineage is no longer canonical;
- an embargo has not ended;
- a finite retention window has expired.

Expiry means this registry no longer authorizes continuing publication/retention under that current policy. It does **not** claim that public copies can be recalled or that immutable blockchain history can be erased.

## Revision history

Policy revisions are append-only and predecessor-linked.

Revisions may tighten or broaden future disclosure intent only through the same authenticated publisher and exact-current-revision path. Historical policy commitments remain reconstructable.

Deactivation is explicit and versioned. Reactivation requires the underlying lineage to remain canonical.

## Privacy and legal boundary

CMP-4.8 stores commitments and timestamps only.

It does not:

- place raw research metadata or results on chain;
- create storage capacity or deletion authority;
- grant dataset/result access;
- guarantee third-party deletion after publication;
- replace consent, legal, institutional, contractual or jurisdictional retention duties;
- prove scientific truth or result correctness;
- select workers/verifiers;
- create funding, settlement, reward, slash or governance authority.

Low-entropy sensitive metadata should not be protected by a bare unsalted hash alone; hiding/salted commitments and access-controlled encrypted storage remain an off-chain responsibility under the CMP-0 privacy model.

## Security / adversarial behavior

Required fail-closed behavior covers:

- unknown/noncanonical lineage;
- outsider policy creation or mutation;
- duplicate policy creation for one lineage;
- zero access/retention commitments;
- missing publication manifest for RESTRICTED/PUBLIC;
- publication manifest or embargo attached to PRIVATE mode;
- stale revisions and no-op revisions;
- retention already expired or ending before embargo;
- lineage drift;
- inactive policy;
- exact commitment/revision mismatch;
- attempts to interpret policy as storage/deletion/access/correctness/economic authority.

## Qualification model

CMP-4.8 is an ordinary **Level 1** step.

CMP-4.6 remains the first CMP-4 Level 2 convergence milestone. CMP-4.8 adds a bounded policy layer over CMP-4.7 and does not introduce a new cross-service or economic authority requiring another Level 2 milestone.

Required on one exact SHA:

- affected Compute contracts compile;
- dedicated `ComputeScientificPublicationRetention420.t.sol` tests pass;
- retained CMP-4.1–CMP-4.7 compatibility verifiers pass;
- CMP-4.8 mechanical verifier passes;
- exact-head Compute Market Qualification passes.

Level 2 is not required again at CMP-4.8. Level 3 remains CMP-4.10.

## Intentionally deferred

- CMP-4.9 now owns the research dashboard/read-model composition over canonical CMP-4.2/4.6/4.7/4.8 state;
- comprehensive Level 3 scientific-framework closeout — CMP-4.10;
- SDK/API/indexer expansion — CMP-7;
- Compute UI — CMP-8;
- public/testnet storage enforcement and scientific demonstration — CMP-9.

## Qualification evidence

- qualified implementation/closeout SHA: `fae498b72b2693f4264df3f208ebbe6a1e1d44bf`;
- branch reconciliation base carried into CMP-4.8: `f5fe16414893a1e4bd4f3db22eb36b685a2030f5`;
- current `main` at evidence closeout: `23ebff000a471bfbc4439894f797f3b17a530867`;
- later `main` movement contains no Compute/CMP-4 surface changes and is deferred to CMP-4.10 Level 3 reconciliation;
- Compute Market Qualification: **#425** / run `37496866215` / job `112383527372` — **SUCCESS**;
- exact-head checkout and SHA verification — PASS;
- Compute Market contracts build — PASS;
- retained `Compute*.t.sol` suite — PASS;
- verifier-script compilation — PASS;
- CMP-4.1–CMP-4.7 retained compatibility verifiers — PASS;
- CMP-4.8 publication/retention verifier — PASS;
- Level 2 — not required again at this ordinary step;
- Level 3 — deferred to CMP-4.10.

The first CMP-4.8 qualification attempt at `786bb7a75b2e436b5c3545fd2eccaf75c8d711d0` passed the complete retained Solidity suite (**516 passed, 0 failed, 0 skipped**) and all earlier CMP-4 verifiers, but the CMP-4.8 mechanical verifier failed on a documentation-token mismatch. The verifier wording was aligned to the already-correct specification semantics, producing the exact qualified SHA above.

Durable evidence: [CMP-4.8 qualification evidence](CMP-4.8-QUALIFICATION-EVIDENCE.md).

## Next canonical step

**CMP-4.9 — Research dashboard**
