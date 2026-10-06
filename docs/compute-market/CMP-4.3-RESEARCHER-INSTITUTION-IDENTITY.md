# CMP-4.3 — Researcher / institution identity

Status: **COMPLETE — Level 1 exact-head qualified on `8e4199c7d1e8b883a3518167a4093dae4899598a`.**

Canonical roadmap step: **CMP-4.3 — Researcher / institution identity**.

## 1. Canonical identity source

CMP-4.3 does **not** create a second universal identity system. `Identity420` remains the canonical profile, issuer, credential and controller authority.

`ComputeResearchIdentity420` is a compute-scoped binding layer. It binds an exact `Identity420` profile and credential to one of two scientific roles:

- `RESEARCHER`;
- `INSTITUTION`.

A binding is evidence usable by Compute Market policy. It is not legal identity, universal reputation, job authority, funding authority, verifier authority or settlement authority.

## 2. Credential policy

Researcher bindings require:

- exact credential type `420/COMPUTE/RESEARCHER_CREDENTIAL/V1`;
- current canonical credential validity;
- exact subject profile match;
- current Identity assurance of at least `ATTESTED`.

Institution bindings require:

- exact credential type `420/COMPUTE/INSTITUTION_CREDENTIAL/V1`;
- current canonical credential validity;
- exact subject profile match;
- current Identity assurance of at least `CREDENTIALED`.

The policy deliberately relies on `Identity420`'s existing governed issuer/trust model. It does not promote a trust class into unsupported regulatory or legal status.

## 3. Stable role binding

The binding ID is:

`keccak256(abi.encode(BINDING_DOMAIN, block.chainid, address(registry), profileId, role))`

where:

`BINDING_DOMAIN = keccak256("420/COMPUTE/RESEARCH_IDENTITY_BINDING/V1")`.

Caller-supplied binding IDs are not accepted. One profile may have separate researcher and institution bindings, but each profile/role pair has one canonical binding identity.

Each revision commits:

- canonical `Identity420` address;
- binding ID;
- profile ID;
- exact credential ID;
- metadata commitment;
- predecessor commitment;
- revision;
- role;
- active state.

Revision history is append-only.

## 4. Controller, delegation and recovery

Mutation authority is the **current active `Identity420` profile controller**, rechecked at every action.

The compute binding deliberately does not freeze the controller address into the identity commitment. A canonical `Identity420` controller transfer therefore changes who may operate the binding without rewriting historical binding identity or prior commitments.

Institutional multisig, smart-account delegation, session authority and account recovery remain in the shared account/Identity control layers. CMP-4.3 does not invent a competing delegation or recovery system.

## 5. Fail-closed eligibility

`isCurrentEligible(bindingId, revision, exactCommitment, actor)` returns true only when:

- the compute binding exists and is active;
- revision is exactly current;
- the exact nonzero current binding commitment is supplied;
- the `Identity420` profile remains active;
- `actor` is the current profile controller;
- the exact credential remains currently valid;
- credential subject equals the bound profile;
- credential type matches the bound scientific role;
- current assurance meets the role minimum.

Credential revocation, rejection, expiry, issuer deactivation, profile deactivation, controller transfer, stale revision, wrong role/type, wrong subject, cross-binding commitment replay or local binding deactivation therefore fail closed.

## 6. Authority boundaries

CMP-4.3 grants no:

- project mutation or ownership authority;
- job lifecycle or scheduling authority;
- dataset access authority;
- worker/verifier selection or correctness authority;
- funding, custody, reward or settlement authority;
- stake/slash/dispute authority;
- governance, bridge, wallet or validator authority;
- legal/regulatory identity conclusion.

CMP-4.2 project ownership remains its own authority boundary. A later integration may require a current CMP-4.3 binding as policy evidence, but identity evidence does not silently seize project control.

## 7. Security properties

Required behavior:

- fake/zero identity source is rejected at deployment;
- source must identify as `Identity420` protocol version 3;
- only current active profile controller may create or mutate a binding;
- weak assurance cannot satisfy institution role;
- wrong subject or wrong credential type fails;
- credential lifecycle is rechecked dynamically;
- controller recovery changes current actor authority without rewriting historical commitments;
- stale revision and cross-binding replay fail;
- no-op revisions/activation changes fail;
- binding history is append-only and predecessor linked;
- compute identity cannot mutate Identity420 credentials, issuers or profiles.

## 8. Qualification boundary

CMP-4.3 is an ordinary **Level 1** step.

Required exact-head qualification:

- affected Compute contracts compile;
- retained `Compute*.t.sol` suite passes;
- dedicated CMP-4.3 tests cover researcher/institution role policy, controller recovery, credential lifecycle, authorization, stale revision and replay;
- CMP-4.1 and CMP-4.2 retained verifiers remain green;
- CMP-4.3 mechanical verifier passes;
- Compute Market Qualification passes the exact implementation SHA.

The existing `Identity420` contract/interface is consumed read-only and is not modified, so a separate 420Identity phase qualification is not required for this step. No Level 2 milestone is required yet. Level 3 remains CMP-4.10.

## 9. Intentionally deferred

- dataset manifests — CMP-4.4;
- reproducible execution environments — CMP-4.5;
- result provenance — CMP-4.6;
- scientific metadata and lineage — CMP-4.7;
- publication / retention policy — CMP-4.8;
- research dashboard — CMP-4.9;
- comprehensive scientific-framework phase closeout — CMP-4.10;
- useful-computation rewards — CMP-6;
- live scientific testnet demonstration — CMP-9.13.

## 10. Next canonical step

**CMP-4.4 — Dataset manifests**


## Qualification evidence

Retained exact-head qualification evidence: [CMP-4.3 qualification](CMP-4.3-QUALIFICATION-EVIDENCE.md). Compute Market Qualification **#400** / run `37405254531` passed on exact SHA `8e4199c7d1e8b883a3518167a4093dae4899598a`, including exact-head verification, Compute contract build, the retained `Compute*.t.sol` suite, verification-script compilation, and the CMP-4.3 verifier.
